// --- GAME ENGINE ---
import { normalizeRarity, GAME_CONFIG } from './config';
import { idbGetAllByIndex, STORE_CARDS } from './database';
import type { CardData, CardInstance } from './types';

export const generatePack = async (setId: string, printRuns: Record<string, number>): Promise<{ pack: CardInstance[], runUpdates: Record<string, number> }> => {
  const actualSetId = setId;
  let allSetCards = await idbGetAllByIndex(STORE_CARDS, 'setId', actualSetId);
  if (allSetCards.length === 0) allSetCards = await idbGetAllByIndex(STORE_CARDS, 'setId', actualSetId.toLowerCase());
  if (allSetCards.length === 0) allSetCards = await idbGetAllByIndex(STORE_CARDS, 'setId', actualSetId.toUpperCase());
  if (allSetCards.length === 0) throw new Error(`Set data not found for ${actualSetId}. Please import it in Settings.`);

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

  const pickCard = (allowedRarities: string[]) => {
    let selectedRarity = allowedRarities[0];
    if (allowedRarities.length > 1) {
      const roll = Math.random() * 100;
      let cumulative = 0;
      for (const r of allowedRarities) {
        cumulative += (GAME_CONFIG.packConfiguration.pullRates as any)[r] || 0;
        if (roll <= cumulative) { selectedRarity = r; break; }
      }
    }
    const pool = cardsByRarity[selectedRarity] || [];
    const validPool = pool.filter((c: any) => getRemaining(c.id, c.rarity) > 0);
    if (validPool.length > 0) return validPool[Math.floor(Math.random() * validPool.length)];
    const allAvailable = Object.values(cardsByRarity).flat();
    if (allAvailable.length > 0) return allAvailable[Math.floor(Math.random() * allAvailable.length)];
    return null; 
  };

  GAME_CONFIG.packConfiguration.slots.forEach(slot => {
    for (let i = 0; i < slot.count; i++) {
      const card = pickCard(slot.rarity);
      if (card) {
        pack.push({ instanceId: crypto.randomUUID(), cardId: card.id, isFoil: slot.isFoil || false, condition: 1.0 });
        runUpdates[card.id] = getRemaining(card.id, card.rarity) - 1;
      }
    }
  });

  return { pack, runUpdates };
};

export const fetchLorcastSets = async () => {
  const res = await fetch("https://api.lorcast.com/v0/sets");
  if (!res.ok) throw new Error("Failed to fetch sets from Lorcast API.");
  const data = await res.json();
  if (!data.results) throw new Error("Invalid response format.");
  return data.results.map((s: any) => ({ id: s.code.toUpperCase(), name: s.name, code: s.code.toUpperCase() }));
};

export const fetchLorcastCardsForSet = async (setCode: string) => {
  let url: string | null = `https://api.lorcast.com/v0/cards/search?q=set:${setCode.toLowerCase()}`;
  let allCards: any[] = [];
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch cards for set ${setCode}`);
    const data = await res.json();
    if (data.results) allCards = allCards.concat(data.results);
    if (data.has_more && data.next_page) url = data.next_page;
    else url = null; 
  }
  if (allCards.length === 0) return [];
  return allCards.map((c: any) => ({
    id: c.id, setId: setCode.toUpperCase(), name: c.name, version: c.version || '',
    rarity: normalizeRarity(c.rarity), marketPrice: c.prices?.usd || 0.10,
    imageUrl: c.image_uris?.digital?.normal || c.image_uris?.digital?.large || c.image_uris?.normal || c.image_uris?.large || '', 
    inkColor: c.ink, type: c.type, cost: c.cost, strength: c.strength, willpower: c.willpower, lore: c.lore,
    rulesText: c.text, flavorText: c.flavor_text
  }));
};

export const getCalculatedCardValue = (cardData: CardData, condition: number, grade?: number, gradingCompany?: string) => {
  let baseValue = cardData.marketPrice || 0.10;
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
