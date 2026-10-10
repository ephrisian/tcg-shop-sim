import type { CardData } from '../types';
import type { HRCardDef } from './engine';

export const HERO_RUSH_GAME_ID = 'marvel-hero-rush';

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Character cards only; Rush Point cards have no level and are not part of the 50-card deck.
export const heroRushPool = (dictionary: Record<string, CardData>): HRCardDef[] =>
  Object.values(dictionary)
    .filter(card => card.gameId === HERO_RUSH_GAME_ID && card.cardData && num(card.cardData.level) > 0)
    .map(card => {
      const data = card.cardData as Record<string, unknown>;
      return {
        defId: card.id,
        name: card.name,
        number: String(data.number ?? ''),
        rarity: card.rarity,
        level: num(data.level),
        range: num(data.attack_range),
        power: num(data.battle_power),
        color: String(data.color ?? ''),
        trait: String(data.trait ?? ''),
        effect: String(data.effect ?? ''),
        imageUrl: card.imageUrl,
      };
    });
