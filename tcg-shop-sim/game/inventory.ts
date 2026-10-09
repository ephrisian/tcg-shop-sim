import type { CardInstance, GameState } from './types';
import { DEVELOPER_SETTINGS, GAME_CONFIG } from './config';

export const storeDeskPiles = (
  state: GameState,
  pileTargets: Record<number, string>,
  defaultDrawerId?: string,
): { state: GameState; moved: number; remaining: number } => {
  const sortedCards = state.desk.filter(card => card.pileIndex !== null);
  const placements = new Map<string, typeof sortedCards>();
  const freeSpace = new Map<string, number>();
  for (const unit of state.storage) {
    const definition = GAME_CONFIG.storageDefs[unit.typeId as keyof typeof GAME_CONFIG.storageDefs];
    for (const drawer of unit.slots) {
      freeSpace.set(drawer.id, definition ? Math.max(0, definition.capacityPerSlot - drawer.cards.length) : 0);
    }
  }

  for (const card of sortedCards) {
    const drawerId = pileTargets[card.pileIndex!] || defaultDrawerId;
    if (!drawerId || (freeSpace.get(drawerId) || 0) < 1) continue;
    placements.set(drawerId, [...(placements.get(drawerId) || []), card]);
    freeSpace.set(drawerId, freeSpace.get(drawerId)! - 1);
  }

  const movedIds = new Set([...placements.values()].flat().map(card => card.instanceId));
  const storage = state.storage.map(unit => ({
    ...unit,
    slots: unit.slots.map(drawer => {
      const movedCards = placements.get(drawer.id) || [];
      return movedCards.length > 0
        ? { ...drawer, cards: [...drawer.cards, ...movedCards.map(({ pileIndex, targetDrawerId, ...instance }) => instance)] }
        : drawer;
    }),
  }));
  return {
    state: {
      ...state,
      storage,
      desk: state.desk.filter(card => !movedIds.has(card.instanceId)),
    },
    moved: movedIds.size,
    remaining: sortedCards.length - movedIds.size,
  };
};

export const availableCardCapacity = (state: GameState, locationId: string): number => {
  const isHome = locationId === state.homeLocationId;
  const deskCapacity = isHome
    ? Math.max(0, DEVELOPER_SETTINGS.storage.desk_capacity - state.desk.length)
    : 0;
  const storageCapacity = state.storage
    .filter(unit => unit.locationId === locationId)
    .reduce((total, unit) => {
      const definition = GAME_CONFIG.storageDefs[unit.typeId as keyof typeof GAME_CONFIG.storageDefs];
      return total + (definition
        ? unit.slots.reduce((sum, drawer) => sum + Math.max(0, definition.capacityPerSlot - drawer.cards.length), 0)
        : 0);
    }, 0);
  return deskCapacity + storageCapacity;
};

export const addCardsToInventory = (
  state: GameState,
  cards: CardInstance[],
  locationId: string,
): GameState | null => {
  if (availableCardCapacity(state, locationId) < cards.length) return null;
  const isHome = locationId === state.homeLocationId;
  let remaining = [...cards];
  const availableDesk = isHome
    ? Math.max(0, DEVELOPER_SETTINGS.storage.desk_capacity - state.desk.length)
    : 0;
  const toDesk = remaining.slice(0, availableDesk).map(card => ({ ...card, pileIndex: null }));
  remaining = remaining.slice(toDesk.length);
  const storage = state.storage.map(unit => {
    if (unit.locationId !== locationId || remaining.length === 0) return unit;
    const definition = GAME_CONFIG.storageDefs[unit.typeId as keyof typeof GAME_CONFIG.storageDefs];
    if (!definition) return unit;
    return {
      ...unit,
      slots: unit.slots.map(drawer => {
        const amount = Math.min(remaining.length, Math.max(0, definition.capacityPerSlot - drawer.cards.length));
        const storedCards = remaining.slice(0, amount);
        remaining = remaining.slice(amount);
        return amount > 0 ? { ...drawer, cards: [...drawer.cards, ...storedCards] } : drawer;
      }),
    };
  });
  return {
    ...state,
    desk: [...state.desk, ...toDesk],
    storage,
  };
};

export const duplicateCardInstanceIds = (state: GameState): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const instances = [
    ...state.desk,
    ...state.storage.flatMap(unit => unit.slots.flatMap(drawer => drawer.cards)),
    ...state.binders.flatMap(binder => binder.cards),
  ];
  for (const instance of instances) {
    if (seen.has(instance.instanceId)) duplicates.add(instance.instanceId);
    seen.add(instance.instanceId);
  }
  return [...duplicates];
};
