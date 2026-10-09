export interface RedemptionTier {
  id: string;
  quantity: number;
  prizeType: 'card' | 'binder';
  prizeId: string;
}

export interface RedemptionDistribution {
  caseCount: number;
  packsPerCase?: number;
  tiers: RedemptionTier[];
}

export const rollRedemption = (
  distribution: RedemptionDistribution | undefined,
  defaultPacksPerCase: number,
  random: () => number = Math.random,
): RedemptionTier | undefined => {
  if (!distribution) return undefined;
  if (!Number.isInteger(distribution.caseCount) || distribution.caseCount < 1) {
    throw new Error('Redemption case count must be a positive integer.');
  }
  if (!Array.isArray(distribution.tiers) || distribution.tiers.length === 0) {
    throw new Error('Redemption distribution must contain at least one tier.');
  }
  if (distribution.tiers.some(tier =>
    !tier.id || !Number.isInteger(tier.quantity) || tier.quantity < 0 ||
    !['card', 'binder'].includes(tier.prizeType) || !tier.prizeId,
  )) {
    throw new Error('Redemption tiers must have valid IDs, quantities, and prizes.');
  }
  const total = distribution.tiers.reduce((sum, tier) => sum + tier.quantity, 0);
  if (total !== distribution.caseCount) {
    throw new Error(`Redemption distribution totals ${total}; expected ${distribution.caseCount} cases.`);
  }

  const packsPerCase = distribution.packsPerCase ?? defaultPacksPerCase;
  if (!Number.isInteger(packsPerCase) || packsPerCase < 1) {
    throw new Error('Packs per redemption case must be a positive integer.');
  }
  const chanceRoll = random();
  if (!Number.isFinite(chanceRoll) || chanceRoll < 0 || chanceRoll >= 1) {
    throw new Error('Redemption random values must be in the range [0, 1).');
  }
  if (chanceRoll >= 1 / packsPerCase) return undefined;

  const prizeRoll = random();
  if (!Number.isFinite(prizeRoll) || prizeRoll < 0 || prizeRoll >= 1) {
    throw new Error('Redemption random values must be in the range [0, 1).');
  }
  const prizeIndex = prizeRoll * distribution.caseCount;
  let cumulative = 0;
  return distribution.tiers.find(tier => {
    cumulative += tier.quantity;
    return prizeIndex < cumulative;
  });
};
