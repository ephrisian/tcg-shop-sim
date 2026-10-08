import React, { createContext, useContext } from 'react';
import { GAME_CONFIG } from './config';
import type { CardData, GameState } from './types';

export const defaultGameState: GameState = {
  day: 1,
  currency: GAME_CONFIG.startingState.currency,
  energy: GAME_CONFIG.energy.baseMax,
  maxEnergy: GAME_CONFIG.energy.baseMax,
  energyDrinks: 0,
  profitMargin: 1.0,
  businessStats: { workers: 0 },
  shopStats: { itemsSold: 0, liveShows: 0, returnBuyers: 0 },
  liveState: { active: false, type: 'standard', viewers: 0, whales: 0, frugal: 0 },
  sealed: GAME_CONFIG.startingState.sealedProduct.flatMap(p => 
    Array.from({ length: p.quantity }).map(() => ({
      id: crypto.randomUUID(), type: p.type as 'pack'|'box', setId: p.setId
    }))
  ),
  desk: [],
  storage: GAME_CONFIG.startingState.storageUnits.map((typeId, i) => {
    const def = (GAME_CONFIG.storageDefs as any)[typeId];
    return {
      id: `storage-${i}`, typeId,
      slots: Array.from({ length: def.slots }).map((_, j) => ({ id: `slot-${j}`, cards: [] }))
    };
  }),
  binder: [],
  printRuns: {},
  newsFeed: ["You inherited a small collection. Welcome to your new shop!"],
  reputation: { 'lgs-wolf': 0, 'lgs-dragon': 0 },
  donations: { 'lgs-wolf': {}, 'lgs-dragon': {} },
  lgsStock: { 
    'lgs-wolf': { '1': GAME_CONFIG.locations['lgs-wolf'].allocationCases * 6 }, 
    'lgs-dragon': { '1': GAME_CONFIG.locations['lgs-dragon'].allocationCases * 6 } 
  },
  marketModifiers: { '1': 1.0 }
};

export const GameContext = createContext<{
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  dictionary: Record<string, CardData>;
  availableSets: any[];
  refreshData: () => Promise<void>;
  importSet: (setId: string) => Promise<void>;
  consumeEnergy: (cost: number) => boolean;
} | null>(null);

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
};
