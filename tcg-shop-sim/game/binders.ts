import type { Binder, CardInstance } from './types';

export const binderCapacity = (binder: Binder) => binder.pageCount * binder.slotsPerPage;

// Cards without a valid, unique binderSlot (e.g. from older saves) fill the first free slots.
export const binderSlots = (binder: Binder): (CardInstance | undefined)[] => {
  const capacity = binderCapacity(binder);
  const slots: (CardInstance | undefined)[] = Array.from({ length: capacity }, () => undefined);
  const unplaced: CardInstance[] = [];
  for (const card of binder.cards) {
    const slot = card.binderSlot;
    if (typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < capacity && !slots[slot]) slots[slot] = card;
    else unplaced.push(card);
  }
  for (const card of unplaced) {
    const free = slots.findIndex(item => !item);
    if (free >= 0) slots[free] = card;
  }
  return slots;
};

export const firstFreeSlot = (binder: Binder) => binderSlots(binder).findIndex(card => !card);

// Returns the binder's cards with every card pinned to its resolved slot.
export const normalizeBinderCards = (binder: Binder): CardInstance[] =>
  binderSlots(binder).flatMap((card, slot) => card ? [{ ...card, binderSlot: slot }] : []);

export const placeInBinder = (binder: Binder, card: CardInstance, slot: number): Binder => {
  const cards = normalizeBinderCards(binder);
  if (slot < 0 || slot >= binderCapacity(binder) || cards.some(item => item.binderSlot === slot)) return binder;
  return { ...binder, used: true, cards: [...cards, { ...card, binderSlot: slot }] };
};

export const moveInBinder = (binder: Binder, from: number, to: number): Binder => {
  if (from === to || to < 0 || to >= binderCapacity(binder)) return binder;
  const cards = normalizeBinderCards(binder).map(card => {
    if (card.binderSlot === from) return { ...card, binderSlot: to };
    if (card.binderSlot === to) return { ...card, binderSlot: from };
    return card;
  });
  return { ...binder, cards };
};
