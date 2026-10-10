import { GAME_CONFIG, normalizeRarity } from './config';
import type { ImportedSet, PullPlan, SetProduct, SetProductSlot } from './types';

const rarityList = (slot: SetProductSlot) => (Array.isArray(slot.rarity) ? slot.rarity : [slot.rarity]).map(normalizeRarity);

export const rarityWeight = (rates: Record<string, number>, rarity: string): number => {
  const normalized = normalizeRarity(rarity);
  for (const [key, weight] of Object.entries(rates)) {
    if (normalizeRarity(key) === normalized) return Math.max(0, weight);
  }
  return 0;
};

// Chance that one pack contains the rarity at least once through its normal slot rolls.
export const packRarityChance = (slots: SetProductSlot[], rates: Record<string, number>, rarity: string): number => {
  const target = normalizeRarity(rarity);
  let expected = 0;
  for (const slot of slots) {
    const options = rarityList(slot);
    if (!options.includes(target)) continue;
    if (options.length === 1) {
      expected += slot.count;
      continue;
    }
    const weights = options.map(option => rarityWeight(rates, option));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    expected += slot.count * (total > 0 ? weights[options.indexOf(target)] / total : 1 / options.length);
  }
  return Math.min(1, expected);
};

const binomial = (trials: number, chance: number): number => {
  let hits = 0;
  for (let index = 0; index < trials; index += 1) if (Math.random() < chance) hits += 1;
  return hits;
};

const sample = (count: number, size: number): number[] => {
  const indexes = Array.from({ length: size }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  return indexes.slice(0, count);
};

// Decides, for every pack in a box, which rarities are forced into it and which can't roll
// normally, so box-wide limits (boxLimits) and case-wide hits (set.caseHitRates) are honored.
export const planBoxPulls = (
  set: ImportedSet | undefined,
  box: SetProduct | undefined,
  pack: SetProduct,
  packCount: number,
): PullPlan[] => {
  const slots = pack.slots || GAME_CONFIG.packConfiguration.slots;
  const rates = pack.pullRates || GAME_CONFIG.packConfiguration.pullRates;
  const plans: PullPlan[] = Array.from({ length: packCount }, () => ({ force: [], ban: [] }));
  const caseSize = Math.max(1, set?.caseSize || 1);

  for (const [rarity, perCase] of Object.entries(set?.caseHitRates || {})) {
    plans.forEach(plan => plan.ban.push(normalizeRarity(rarity)));
    const boxChance = Math.min(1, Math.max(0, perCase) / caseSize);
    if (Math.random() < boxChance) plans[Math.floor(Math.random() * packCount)].force.push(normalizeRarity(rarity));
  }

  for (const [rarity, limit] of Object.entries(box?.boxLimits || {})) {
    const normalized = normalizeRarity(rarity);
    plans.forEach(plan => { if (!plan.ban.includes(normalized)) plan.ban.push(normalized); });
    const hits = Math.min(Math.max(0, Math.floor(limit)), binomial(packCount, packRarityChance(slots, rates, rarity)));
    sample(hits, packCount).forEach(index => plans[index].force.push(normalized));
  }
  return plans;
};
