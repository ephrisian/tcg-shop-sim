import type { CardData, GameState, ImportedSet } from './types';

export const HERO_RUSH_STARTER_SET_SOURCE_ID = 'hr-sd01';

// Hero Rush unlocks once the player owns anything from the SD01 starter deck set.
export const ownsHeroRushStarterDeck = (
  state: GameState,
  sets: ImportedSet[],
  dictionary: Record<string, CardData>,
): boolean => {
  const starterSetIds = new Set(sets.filter(set => set.sourceId === HERO_RUSH_STARTER_SET_SOURCE_ID).map(set => set.id));
  if (starterSetIds.size === 0) return false;
  const inStarterSet = (cardId: string) => starterSetIds.has(dictionary[cardId]?.setId);
  return state.sealed.some(item => starterSetIds.has(item.setId)) ||
    state.desk.some(card => inStarterSet(card.cardId)) ||
    state.binders.some(binder => binder.cards.some(card => inStarterSet(card.cardId))) ||
    state.storage.some(unit => unit.slots.some(drawer => drawer.cards.some(card => inStarterSet(card.cardId))));
};
