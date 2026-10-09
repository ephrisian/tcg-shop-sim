import React, { createContext, useContext } from 'react';
import { DEVELOPER_SETTINGS, GAME_CONFIG } from './config';
import { gameDayForClock, MINUTES_PER_GAME_DAY, MINUTES_PER_GAME_HOUR } from './time';
import { duplicateCardInstanceIds } from './inventory';
import type { Binder, CardData, GameState, ImportedSet, StorageUnit } from './types';

export const SAVE_VERSION = 2;

const makeStorageUnit = (typeId: string, id: string, locationId: string): StorageUnit => {
  const definition = GAME_CONFIG.storageDefs[typeId as keyof typeof GAME_CONFIG.storageDefs];
  return {
    id,
    typeId,
    locationId,
    slots: Array.from({ length: definition.slots }, (_, index) => ({
      id: `${id}-drawer-${index + 1}`,
      cards: [],
    })),
  };
};

export const defaultGameState: GameState = {
  saveVersion: SAVE_VERSION,
  day: 1,
  clockMinutes: 8 * MINUTES_PER_GAME_HOUR,
  awakeHours: 0,
  exhausted: false,
  forcedSleepRecoveryDay: null,
  currency: GAME_CONFIG.startingState.currency,
  energy: GAME_CONFIG.energy.baseMax,
  maxEnergy: GAME_CONFIG.energy.baseMax,
  energyDrinks: 0,
  profitMargin: DEVELOPER_SETTINGS.game.starting_profit_margin,
  businessStats: { workers: 0 },
  shopStats: { itemsSold: 0, liveShows: 0, returnBuyers: 0 },
  liveState: { active: false, type: 'standard', viewers: 0, whales: 0, frugal: 0, requests: [], sellableBinderIds: [] },
  sealed: GAME_CONFIG.startingState.sealedProduct.flatMap(p => 
    Array.from({ length: p.quantity }).map(() => ({
      id: crypto.randomUUID(), type: p.type as 'pack'|'box', setId: p.setId, productId: `default-${p.type}`, locationId: 'bedroom'
    }))
  ),
  desk: [],
  storage: GAME_CONFIG.startingState.storageUnits.map((typeId, i) =>
    makeStorageUnit(typeId, `storage-${i}`, 'bedroom')
  ),
  selectedStorageId: 'storage-0',
  binders: [],
  shipments: [],
  properties: [],
  homeLocationId: 'bedroom',
  currentLocationId: 'bedroom',
  currentDistrictId: 'home',
  exploredLocations: ['bedroom', 'lgs-wolf', 'lgs-dragon'],
  exploredDistricts: ['home'],
  unlockedCities: ['home-city'],
  ownedLocations: ['bedroom'],
  traffic: 100,
  vendorOrders: {},
  printRuns: {},
  newsFeed: ["You inherited a small collection. Welcome to your bedroom Live Sale setup!"],
  reputation: { 'lgs-wolf': 0, 'lgs-dragon': 0 },
  donations: { 'lgs-wolf': {}, 'lgs-dragon': {} },
  lgsStock: { 
    'lgs-wolf': { '1': GAME_CONFIG.locations['lgs-wolf'].allocationCases * 6 }, 
    'lgs-dragon': { '1': GAME_CONFIG.locations['lgs-dragon'].allocationCases * 6 } 
  },
  marketModifiers: { '1': 1.0 }
};

const migrateLegacyStorage = (units: any[], locationId: string): StorageUnit[] => {
  const migrated: StorageUnit[] = [];
  for (const [unitIndex, oldUnit] of units.entries()) {
    const cards = (Array.isArray(oldUnit.slots) ? oldUnit.slots : [])
      .flatMap((slot: any) => Array.isArray(slot.cards) ? slot.cards : []);
    const typeId = GAME_CONFIG.storageDefs[oldUnit.typeId as keyof typeof GAME_CONFIG.storageDefs]
      ? oldUnit.typeId
      : 'basic-300';
    const capacity = GAME_CONFIG.storageDefs[typeId as keyof typeof GAME_CONFIG.storageDefs].capacityPerSlot;
    const perContainer = capacity * DEVELOPER_SETTINGS.storage.container_drawers;
    const containerCount = Math.max(1, Math.ceil(cards.length / perContainer));

    for (let containerIndex = 0; containerIndex < containerCount; containerIndex += 1) {
      const id = containerIndex === 0
        ? String(oldUnit.id || `storage-${unitIndex}`)
        : `migration-${unitIndex}-${containerIndex}`;
      const unit = makeStorageUnit(typeId, id, locationId);
      const containerCards = cards.slice(containerIndex * perContainer, (containerIndex + 1) * perContainer);
      containerCards.forEach((card: any, cardIndex: number) => {
        const drawerIndex = Math.floor(cardIndex / capacity);
        unit.slots[drawerIndex].cards.push(card);
      });
      migrated.push(unit);
    }
  }
  return migrated;
};

export const migrateGameState = (savedValue: unknown): GameState => {
  if (!savedValue || typeof savedValue !== 'object' || Array.isArray(savedValue)) {
    throw new Error('The saved game data is not a valid object.');
  }

  const saved = savedValue as Record<string, any>;
  const state = { ...defaultGameState, ...saved } as GameState;
  if (saved.sealed) {
    state.sealed = saved.sealed.map((item: any) => ({
      ...item,
      setId: item.setId === 'TFC' ? '1' : item.setId,
      productId: item.productId || `default-${item.type}`,
      locationId: item.locationId || 'bedroom',
    }));
  }
  state.reputation = saved.reputation || defaultGameState.reputation;
  state.donations = saved.donations || defaultGameState.donations;
  state.lgsStock = saved.lgsStock || defaultGameState.lgsStock;
  state.marketModifiers = saved.marketModifiers || defaultGameState.marketModifiers;
  state.businessStats = saved.businessStats || defaultGameState.businessStats;
  state.shopStats = saved.shopStats || defaultGameState.shopStats;
  state.liveState = {
    ...defaultGameState.liveState,
    ...saved.liveState,
    requests: Array.isArray(saved.liveState?.requests) ? saved.liveState.requests : [],
    sellableBinderIds: Array.isArray(saved.liveState?.sellableBinderIds) ? saved.liveState.sellableBinderIds : [],
  };
  if (state.liveState.active) {
    state.liveState = {
      ...state.liveState,
      active: false,
      requests: [],
      sellableBinderIds: [],
      viewers: 0,
      whales: 0,
      frugal: 0,
    };
  }
  state.day = Number.isFinite(saved.day) && saved.day > 0 ? saved.day : defaultGameState.day;
  state.clockMinutes = Number.isFinite(saved.clockMinutes) && saved.clockMinutes >= 0
    ? saved.clockMinutes
    : (state.day - 1) * MINUTES_PER_GAME_DAY + 8 * MINUTES_PER_GAME_HOUR;
  state.day = gameDayForClock(state.clockMinutes);
  state.awakeHours = Number.isFinite(saved.awakeHours) ? saved.awakeHours : 0;
  state.exhausted = saved.exhausted === true;
  state.forcedSleepRecoveryDay = Number.isFinite(saved.forcedSleepRecoveryDay)
    ? saved.forcedSleepRecoveryDay
    : null;
  state.currentLocationId = saved.currentLocationId || 'bedroom';
  state.homeLocationId = saved.homeLocationId || 'bedroom';
  state.currentDistrictId = saved.currentDistrictId || 'home';
  state.exploredLocations = Array.isArray(saved.exploredLocations)
    ? saved.exploredLocations
    : ['bedroom', 'lgs-wolf', 'lgs-dragon'];
  state.exploredDistricts = Array.isArray(saved.exploredDistricts) ? saved.exploredDistricts : ['home'];
  state.unlockedCities = Array.isArray(saved.unlockedCities) ? saved.unlockedCities : ['home-city'];
  state.ownedLocations = Array.isArray(saved.ownedLocations) ? saved.ownedLocations : ['bedroom'];
  state.traffic = Number.isFinite(saved.traffic) ? saved.traffic : 100;
  state.vendorOrders = saved.vendorOrders && typeof saved.vendorOrders === 'object' ? saved.vendorOrders : {};
  state.shipments = Array.isArray(saved.shipments) ? saved.shipments : [];
  state.properties = Array.isArray(saved.properties) ? saved.properties : [];
  state.storage = Array.isArray(saved.storage)
    ? saved.saveVersion >= SAVE_VERSION
      ? saved.storage.flatMap((unit: any) => migrateLegacyStorage(
        [unit],
        typeof unit.locationId === 'string' ? unit.locationId : state.homeLocationId,
      ))
      : migrateLegacyStorage(saved.storage, state.homeLocationId)
    : defaultGameState.storage;
  if (Array.isArray(saved.binders)) {
    state.binders = saved.binders.map((binder: any) => {
      const design = GAME_CONFIG.binders.designs.find(item => item.id === binder.designId) ||
        GAME_CONFIG.binders.designs[0];
      const slotsPerPage = [1, 4, 9].includes(binder.slotsPerPage) ? binder.slotsPerPage : design.slotsPerPage;
      const pageCount = Number.isInteger(binder.pageCount)
        ? Math.max(25, Math.min(45, binder.pageCount))
        : design.pages;
      return { ...binder, designId: design.id, slotsPerPage, pageCount };
    });
  } else {
    const legacyCards = Array.isArray(saved.binder) ? saved.binder : [];
    const legacyBinder: Binder[] = legacyCards.length > 0 ? [{
      id: 'migrated-personal-binder',
      name: 'Personal Binder',
      designId: 'classic-25',
      pageCount: Math.max(25, Math.min(45, Math.ceil(legacyCards.length / 9))),
      slotsPerPage: 9,
      purchasePrice: 0,
      used: legacyCards.length > 0,
      cards: legacyCards,
    }] : [];
    state.binders = legacyBinder;
  }
  state.selectedStorageId = state.storage.some(unit => unit.id === saved.selectedStorageId)
    ? saved.selectedStorageId
    : state.storage[0]?.id || null;
  const duplicateIds = duplicateCardInstanceIds(state);
  if (duplicateIds.length > 0) {
    throw new Error(`The save contains card instances in multiple locations: ${duplicateIds.join(', ')}.`);
  }
  state.saveVersion = SAVE_VERSION;
  return state;
};

export const GameContext = createContext<{
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  dictionary: Record<string, CardData>;
  availableSets: ImportedSet[];
  consumeEnergy: (cost: number, actionMinutes?: number) => boolean;
  sleep: (hours?: number) => void;
  advanceTime: (minutes: number) => void;
} | null>(null);

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
};
