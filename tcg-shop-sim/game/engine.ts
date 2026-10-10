// --- GAME ENGINE ---
import { DEVELOPER_SETTINGS, normalizeRarity, GAME_CONFIG } from './config';
import { idbGetAll, idbGetAllByIndex, STORE_CARDS, STORE_SETS } from './database';
import type { CardData, CardInstance, ImportedSet, SetProductSlot } from './types';
import { packProductFor } from './products';
import { rarityWeight } from './pulls';
import type { PullPlan } from './types';
import { rollRedemption } from './redemptions';

export const generatePack = async (setId: string, printRuns: Record<string, number>, productId?: string, plan?: PullPlan): Promise<{
  pack: CardInstance[];
  runUpdates: Record<string, number>;
  redemption?: { prizeType: 'card' | 'binder'; prizeId: string; tierId: string };
}> => {
  const importedSets = await idbGetAll(STORE_SETS) as ImportedSet[];
  const setData = importedSets.find(item => item.id === setId || item.code.toUpperCase() === setId.toUpperCase());
  const actualSetId = setData?.id ?? setId;
  const product = packProductFor(setData, productId);
  const packSlots: SetProductSlot[] = product.slots || GAME_CONFIG.packConfiguration.slots;
  const pullRates = product.pullRates || GAME_CONFIG.packConfiguration.pullRates;
  let allSetCards = await idbGetAllByIndex(STORE_CARDS, 'setId', actualSetId);
  if (allSetCards.length === 0) allSetCards = await idbGetAllByIndex(STORE_CARDS, 'setId', actualSetId.toLowerCase());
  if (allSetCards.length === 0) allSetCards = await idbGetAllByIndex(STORE_CARDS, 'setId', actualSetId.toUpperCase());
  if (allSetCards.length === 0) throw new Error(`Set data not found for ${actualSetId}. Import it in the developer authoring tool and rebuild.`);

  const cardsByRarity = allSetCards.reduce((acc: any, c: any) => {
    const norm = normalizeRarity(c.rarity);
    acc[norm] = acc[norm] || [];
    acc[norm].push(c);
    return acc;
  }, {});

  const pack: CardInstance[] = [];
  const runUpdates: Record<string, number> = {};

  const getRemaining = (cardId: string, rarity: string) => {
      if (printRuns[cardId] !== undefined) return printRuns[cardId];
      if (runUpdates[cardId] !== undefined) return runUpdates[cardId];
      const norm = normalizeRarity(rarity);
      return (GAME_CONFIG.world.printRunBase as any)[norm] || 10000;
  };

  const usedCardIds = new Set<string>();
  const banned = new Set((plan?.ban || []).map(normalizeRarity));

  const pickCard = (allowedRarities: string[], rates: Record<string, number>) => {
    const permitted = allowedRarities.filter(rarity => !banned.has(normalizeRarity(rarity)));
    const options = permitted.length > 0 ? permitted : [];
    let selectedRarity = options[0];
    if (options.length > 1) {
      const weights = options.map(rarity => rarityWeight(rates, rarity));
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      if (totalWeight > 0) {
        let roll = Math.random() * totalWeight;
        for (let i = 0; i < options.length; i += 1) {
          roll -= weights[i];
          if (roll <= 0) {
            selectedRarity = options[i];
            break;
          }
        }
      } else {
        selectedRarity = options[Math.floor(Math.random() * options.length)];
      }
    }
    const pool = selectedRarity ? cardsByRarity[normalizeRarity(selectedRarity)] || [] : [];
    const validPool = pool.filter((c: any) => !usedCardIds.has(c.id) && getRemaining(c.id, c.rarity) > 0);
    if (validPool.length > 0) return validPool[Math.floor(Math.random() * validPool.length)];
    const fallback = (Object.entries(cardsByRarity) as [string, any[]][])
      .filter(([rarity]) => !banned.has(rarity))
      .flatMap(([, cards]) => cards)
      .filter(card => !usedCardIds.has(card.id));
    if (fallback.length > 0) return fallback[Math.floor(Math.random() * fallback.length)];
    return null; 
  };

  const addToPack = (card: any, isFoil: boolean) => {
    pack.push({ instanceId: crypto.randomUUID(), cardId: card.id, isFoil, condition: 1.0 });
    usedCardIds.add(card.id);
    runUpdates[card.id] = getRemaining(card.id, card.rarity) - 1;
  };

  // Forced rarities (case hits and box-limited pulls) replace a slot that could hold that rarity.
  const slotAssignments = packSlots.flatMap(slot => Array.from({ length: slot.count }, () => ({ slot, forced: null as string | null })));
  for (const rarity of plan?.force || []) {
    const normalized = normalizeRarity(rarity);
    const open = slotAssignments.filter(item => !item.forced);
    const matching = open.filter(item => (Array.isArray(item.slot.rarity) ? item.slot.rarity : [item.slot.rarity]).map(normalizeRarity).includes(normalized));
    const candidates = matching.length > 0 ? matching : open.filter(item => item.slot.isFoil).concat(open.slice(-1));
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    if (target) target.forced = normalized;
  }

  const slotCards: (any | null)[] = slotAssignments.map(() => null);
  slotAssignments.forEach((assignment, index) => {
    if (!assignment.forced) return;
    const pool = (cardsByRarity[assignment.forced] || []).filter((card: any) => !usedCardIds.has(card.id));
    if (pool.length === 0) {
      assignment.forced = null;
      return;
    }
    slotCards[index] = pool[Math.floor(Math.random() * pool.length)];
    usedCardIds.add(slotCards[index].id);
  });
  slotAssignments.forEach((assignment, index) => {
    if (!slotCards[index]) {
      const allowedRarities = Array.isArray(assignment.slot.rarity) ? assignment.slot.rarity : [assignment.slot.rarity];
      slotCards[index] = pickCard(allowedRarities, pullRates);
      if (slotCards[index]) usedCardIds.add(slotCards[index].id);
    }
  });
  slotCards.forEach((card, index) => {
    if (card) addToPack(card, slotAssignments[index].slot.isFoil || false);
  });

  const redemptionData = (Array.isArray(setData?.redemptions) ? undefined : setData?.redemptions) as
    Parameters<typeof rollRedemption>[0];
  const tier = rollRedemption(redemptionData, DEVELOPER_SETTINGS.redemption.packs_per_case);
  const redemption = tier
    ? { prizeType: tier.prizeType, prizeId: tier.prizeId, tierId: tier.id }
    : undefined;
  if (tier?.prizeType === 'card') {
    const prizeCard = allSetCards.find(card => card.sourceId === tier.prizeId || card.id === tier.prizeId);
    if (!prizeCard) throw new Error(`Redemption card ${tier.prizeId} is missing from set ${setId}.`);
    pack.push({ instanceId: crypto.randomUUID(), cardId: prizeCard.id, isFoil: false, condition: 1 });
  }

  return { pack, runUpdates, redemption };
};

export const getCalculatedCardValue = (cardData: CardData, condition: number, grade?: number, gradingCompany?: string) => {
  let baseValue = Number.isFinite(cardData.marketPrice) ? Math.max(0, cardData.marketPrice) : 0;
  let multiplier = 1.0;
  
  if (grade && gradingCompany) {
    const gradeOdds = GAME_CONFIG.grading.odds.find(o => o.grade === grade);
    const company = (GAME_CONFIG.grading.companies as any)[gradingCompany];
    if (gradeOdds && company) {
      multiplier = gradeOdds.valueMult * company.repMultiplier;
    }
  }
  
  return baseValue * condition * multiplier;
};
