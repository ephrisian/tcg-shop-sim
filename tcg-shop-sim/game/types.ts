// --- TYPES & INTERFACES ---
export interface CardData {
  id: string; setId: string; name: string; version: string; rarity: string;
  marketPrice: number; imageUrl: string; inkColor?: string; type?: string;
  cost?: number; strength?: number; willpower?: number; lore?: number;
  rulesText?: string; flavorText?: string;
}

export interface CardInstance { instanceId: string; cardId: string; isFoil: boolean; condition: number; grade?: number; gradingCompany?: string; }
export interface DeskCard extends CardInstance { pileIndex: number | null; }

export interface GameState {
  day: number;
  currency: number;
  energy: number;
  maxEnergy: number;
  energyDrinks: number;
  profitMargin: number;
  businessStats: { workers: number };
  shopStats: { itemsSold: number; liveShows: number; returnBuyers: number };
  liveState: { active: boolean; type: string; viewers: number; whales: number; frugal: number };
  sealed: { id: string; type: 'pack' | 'box'; setId: string }[];
  desk: DeskCard[];
  storage: { id: string; typeId: string; slots: { id: string; cards: CardInstance[] }[] }[];
  binder: CardInstance[];
  printRuns: Record<string, number>; 
  newsFeed: string[];
  reputation: Record<string, number>; 
  donations: Record<string, Record<string, number>>; 
  lgsStock: Record<string, Record<string, number>>; 
  marketModifiers: Record<string, number>; 
}
