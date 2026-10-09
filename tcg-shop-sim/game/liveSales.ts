export interface LiveSaleOutcome {
  netProceeds: number;
  trafficPenalty: number;
}

export const calculateLiveSaleOutcome = (
  salePrice: number,
  marketPrice: number,
  platformFeeFraction: number,
  priceGapFraction: number,
  priceGapTrafficPenalty: number,
): LiveSaleOutcome => {
  if (!Number.isFinite(salePrice) || salePrice < 0) throw new Error('Sale price must be a non-negative number.');
  if (!Number.isFinite(marketPrice) || marketPrice < 0) throw new Error('Market price must be a non-negative number.');
  if (!Number.isFinite(platformFeeFraction) || platformFeeFraction < 0 || platformFeeFraction > 1) {
    throw new Error('Platform fee must be between zero and one.');
  }
  if (!Number.isFinite(priceGapFraction) || priceGapFraction < 0) {
    throw new Error('Price gap must be a non-negative number.');
  }
  if (!Number.isFinite(priceGapTrafficPenalty) || priceGapTrafficPenalty < 0) {
    throw new Error('Price-gap traffic penalty must be a non-negative number.');
  }

  const priceGap = marketPrice > 0 && Math.abs(salePrice - marketPrice) / marketPrice > priceGapFraction;
  return {
    netProceeds: Math.round(salePrice * (1 - platformFeeFraction) * 100) / 100,
    trafficPenalty: priceGap ? priceGapTrafficPenalty : 0,
  };
};
