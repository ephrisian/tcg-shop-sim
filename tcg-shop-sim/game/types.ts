// --- TYPES & INTERFACES ---
export interface CardData {
  id: string; setId: string; name: string; version: string; rarity: string;
  marketPrice: number; imageUrl: string; inkColor?: string; type?: string;
  cost?: number; strength?: number; willpower?: number; lore?: number;
  rulesText?: string; flavorText?: string;
  gameId?: string;
  sourceId?: string;
  cardData?: Record<string, unknown>;
  value?: Record<string, number>;
}

export interface ImportedSet {
  id: string;
  sourceId?: string;
  code: string;
  name: string;
  gameId?: string;
  gameName?: string;
  providerId?: string;
  company?: string;
  cardCount?: number;
  schemaVersion?: number;
  runSize?: number;
  products?: SetProduct[];
  redemptions?: unknown;
  credits?: unknown;
}

export interface SetProductSlot {
  rarity: string | string[];
  count: number;
  isFoil?: boolean;
}

export interface SetProduct {
  id: string;
  name: string;
  type: 'pack' | 'box';
  image?: string;
  imageUrl?: string;
  price?: number;
  cardsPerPack?: number;
  packsPerBox?: number;
  packProductId?: string;
  runSize?: number;
  slots?: SetProductSlot[];
  pullRates?: Record<string, number>;
}

export interface CardInstance { instanceId: string; cardId: string; isFoil: boolean; condition: number; grade?: number; gradingCompany?: string; }
export interface DeskCard extends CardInstance { pileIndex: number | null; targetDrawerId?: string; }

export interface StorageDrawer {
  id: string;
  cards: CardInstance[];
}

export interface StorageUnit {
  id: string;
  typeId: string;
  locationId: string;
  slots: StorageDrawer[];
}

export interface Binder {
  id: string;
  name: string;
  designId: string;
  pageCount: number;
  slotsPerPage: 1 | 4 | 9;
  purchasePrice: number;
  used: boolean;
  cards: CardInstance[];
}

export interface Shipment {
  id: string;
  vendorId: string;
  destinationLocationId: string;
  arrivalTime: number;
  items: { type: 'pack' | 'box'; setId: string; productId?: string; quantity: number }[];
  status: 'in-transit' | 'awaiting-capacity' | 'delivered';
}

export interface Property {
  id: string;
  type: 'garage' | 'shop' | 'warehouse';
  districtId: string;
}

export interface LiveRequest {
  id: string;
  description: string;
  matchBy: 'name' | 'character' | 'rarity' | 'set' | 'combination';
  matchValue: string;
  quantity: number;
  specificity: 'vague' | 'specific';
  source: { type: 'storage' | 'binder' | 'sealed'; storageId?: string; drawerId?: string; binderId?: string };
  candidateInstanceIds: string[];
  productId?: string;
  sealedType?: 'pack' | 'box';
}

export interface GameState {
  saveVersion: number;
  day: number;
  clockMinutes: number;
  awakeHours: number;
  exhausted: boolean;
  forcedSleepRecoveryDay: number | null;
  currency: number;
  energy: number;
  maxEnergy: number;
  energyDrinks: number;
  profitMargin: number;
  businessStats: { workers: number };
  shopStats: { itemsSold: number; liveShows: number; returnBuyers: number };
  liveState: {
    active: boolean;
    type: string;
    viewers: number;
    whales: number;
    frugal: number;
    requests: LiveRequest[];
    sellableBinderIds: string[];
  };
  sealed: { id: string; type: 'pack' | 'box'; setId: string; productId?: string; locationId?: string }[];
  desk: DeskCard[];
  storage: StorageUnit[];
  selectedStorageId: string | null;
  binders: Binder[];
  shipments: Shipment[];
  properties: Property[];
  homeLocationId: string;
  currentLocationId: string;
  currentDistrictId: string;
  exploredLocations: string[];
  exploredDistricts: string[];
  unlockedCities: string[];
  ownedLocations: string[];
  traffic: number;
  vendorOrders: Record<string, number>;
  printRuns: Record<string, number>; 
  newsFeed: string[];
  reputation: Record<string, number>; 
  donations: Record<string, Record<string, number>>; 
  lgsStock: Record<string, Record<string, number>>; 
  marketModifiers: Record<string, number>; 
}
