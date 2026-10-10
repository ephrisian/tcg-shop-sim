import type { GameState } from './types';

const INDEX_KEY = 'tcg_sim_save_index';
const SLOT_PREFIX = 'tcg_sim_save_slot_';
const LAST_SLOT_KEY = 'tcg_sim_last_slot';
const LEGACY_KEY = 'tcg_sim_save';

export interface SaveSlotInfo {
  id: string;
  name: string;
  updatedAt: number;
  day: number;
  currency: number;
}

const readIndex = (): SaveSlotInfo[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeIndex = (index: SaveSlotInfo[]) => localStorage.setItem(INDEX_KEY, JSON.stringify(index));

// Moves the single pre-slot save into the first slot so existing players keep their progress.
const migrateLegacySave = () => {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === null) return;
  let day = 1;
  let currency = 0;
  try {
    const parsed = JSON.parse(legacy);
    day = Number(parsed.day) || 1;
    currency = Number(parsed.currency) || 0;
  } catch {
    // The raw text is still preserved; loading will report the parse failure.
  }
  const id = crypto.randomUUID();
  localStorage.setItem(SLOT_PREFIX + id, legacy);
  writeIndex([...readIndex(), { id, name: 'Save 1', updatedAt: Date.now(), day, currency }]);
  localStorage.setItem(LAST_SLOT_KEY, id);
  localStorage.removeItem(LEGACY_KEY);
};

export const listSaves = (): SaveSlotInfo[] => {
  migrateLegacySave();
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
};

export const lastSaveId = (): string | null => {
  const id = localStorage.getItem(LAST_SLOT_KEY);
  return id && readIndex().some(slot => slot.id === id) ? id : null;
};

export const readSave = (id: string): string | null => localStorage.getItem(SLOT_PREFIX + id);

export const createSave = (): SaveSlotInfo => {
  const index = readIndex();
  const used = new Set(index.map(slot => slot.name));
  let number = index.length + 1;
  while (used.has(`Save ${number}`)) number += 1;
  const slot: SaveSlotInfo = { id: crypto.randomUUID(), name: `Save ${number}`, updatedAt: Date.now(), day: 1, currency: 0 };
  writeIndex([...index, slot]);
  localStorage.setItem(LAST_SLOT_KEY, slot.id);
  return slot;
};

export const writeSave = (id: string, state: GameState) => {
  const index = readIndex();
  if (!index.some(slot => slot.id === id)) return;
  localStorage.setItem(SLOT_PREFIX + id, JSON.stringify(state));
  writeIndex(index.map(slot => slot.id === id
    ? { ...slot, updatedAt: Date.now(), day: state.day, currency: state.currency }
    : slot));
  localStorage.setItem(LAST_SLOT_KEY, id);
};

export const markLastSave = (id: string) => localStorage.setItem(LAST_SLOT_KEY, id);

export const deleteSave = (id: string) => {
  localStorage.removeItem(SLOT_PREFIX + id);
  writeIndex(readIndex().filter(slot => slot.id !== id));
  if (localStorage.getItem(LAST_SLOT_KEY) === id) localStorage.removeItem(LAST_SLOT_KEY);
};

export const deleteAllSaves = () => {
  readIndex().forEach(slot => localStorage.removeItem(SLOT_PREFIX + slot.id));
  localStorage.removeItem(INDEX_KEY);
  localStorage.removeItem(LAST_SLOT_KEY);
  localStorage.removeItem(LEGACY_KEY);
};
