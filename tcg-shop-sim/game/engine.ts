// --- GAME ENGINE ---
import { DEVELOPER_SETTINGS, normalizeRarity, GAME_CONFIG } from './config';
import { idbGetAll, idbGetAllByIndex, STORE_CARDS, STORE_SETS } from './database';
import type { CardData, CardInstance, ImportedSet, SetProductSlot } from './types';
import { packProductFor } from './products';
import { rollRedemption } from './redemptions';

export const generatePack = async (setId: string, printRuns: Record<string, number>, productId?: string): Promise<{
  pack: CardInstance[];
  runUpdates: Record<string, number>;
  redemption?: { prizeType: 'card' | 'binder'; prizeId: string; tierId: string };
}> => {
  const actualSetId = setId;
  const importedSets = await idbGetAll(STORE_SETS) as ImportedSet[];
  const setData = importedSets.find(item => item.id === setId || item.code.toUpperCase() === setId.toUpperCase());
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

  const pickCard = (allowedRarities: string[], rates: Record<string, number>) => {
    let selectedRarity = allowedRarities[0];
    if (allowedRarities.length > 1) {
      const weights = allowedRarities.map(rarity => Math.max(0, rates[rarity] || 0));
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      if (totalWeight > 0) {
        let roll = Math.random() * totalWeight;
        for (let i = 0; i < allowedRarities.length; i += 1) {
          roll -= weights[i];
          if (roll <= 0) {
            selectedRarity = allowedRarities[i];
            break;
          }
        }
      } else {
        selectedRarity = allowedRarities[Math.floor(Math.random() * allowedRarities.length)];
      }
    }
    const pool = cardsByRarity[normalizeRarity(selectedRarity)] || [];
    const validPool = pool.filter((c: any) => getRemaining(c.id, c.rarity) > 0);
    if (validPool.length > 0) return validPool[Math.floor(Math.random() * validPool.length)];
    const allAvailable = Object.values(cardsByRarity).flat();
    if (allAvailable.length > 0) return allAvailable[Math.floor(Math.random() * allAvailable.length)];
    return null; 
  };

  packSlots.forEach(slot => {
    for (let i = 0; i < slot.count; i++) {
      const allowedRarities = Array.isArray(slot.rarity) ? slot.rarity : [slot.rarity];
      const card = pickCard(allowedRarities, pullRates);
      if (card) {
        pack.push({ instanceId: crypto.randomUUID(), cardId: card.id, isFoil: slot.isFoil || false, condition: 1.0 });
        runUpdates[card.id] = getRemaining(card.id, card.rarity) - 1;
      }
    }
  });

  const redemptionData = setData?.redemptions as Parameters<typeof rollRedemption>[0];
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
