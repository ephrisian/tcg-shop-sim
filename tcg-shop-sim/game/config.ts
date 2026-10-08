// --- UTILS ---
export const normalizeRarity = (r: string) => {
  if (!r) return 'Common';
  return r.toLowerCase().replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// --- CONFIGURATION ---
export const GAME_CONFIG = {
  startingState: {
    currency: 500.00,
    sealedProduct: [
      { type: 'box', setId: '1', quantity: 2 },
      { type: 'pack', setId: '1', quantity: 5 }
    ],
    storageUnits: ['basic-8-drawer'],
  },
  economy: {
    retailPrices: {
      pack: 5.99,
      box: 143.76, 
    },
    storagePrices: {
      'basic-8-drawer': 50.00,
      'pro-5000-count': 120.00,
    }
  },
  energy: {
    baseMax: 100,
    costs: {
      ripPack: 5,
      liveRipPack: 1,
      sortCard: 1,
      visitStore: 5,
      disneyTrip: 40,
      openBox: 2
    },
    supplies: {
      energyDrink: { price: 10.00, restores: 50, repGain: 5 }
    }
  },
  businessUpgrades: {
    worker: { cost: 1500, maxEnergyBoost: 100, marginPenalty: 0.10, name: "Hire Worker", desc: "Adds 100 Max Energy. Takes 10% of gross profits." }
  },
  liveShows: {
    types: {
      'standard': { name: 'Standard Rip', cost: 10, whaleAttraction: 1.5, frugalAttraction: 1.0, desc: "Balanced viewership." },
      'singles': { name: 'Singles Show', cost: 5, whaleAttraction: 0.8, frugalAttraction: 2.5, desc: "Attracts deal-hunters." },
      'rtyh': { name: 'Rip Till You Hit', cost: 15, whaleAttraction: 2.5, frugalAttraction: 1.2, desc: "Attracts high-rollers." }
    }
  },
  grading: {
    companies: {
      'CGC': { name: 'CGC', cost: 10, repMultiplier: 0.8, color: 'text-blue-400' },
      'PSA': { name: 'PSA', cost: 20, repMultiplier: 1.0, color: 'text-red-500' },
      'BGS': { name: 'BGS', cost: 30, repMultiplier: 1.2, color: 'text-yellow-500' }
    },
    odds: [
      { threshold: 0.05, grade: 10.0, valueMult: 10.0 }, // 5% chance for a 10
      { threshold: 0.20, grade: 9.5, valueMult: 4.0 },   // 15% chance
      { threshold: 0.50, grade: 9.0, valueMult: 2.0 },   // 30% chance
      { threshold: 0.80, grade: 8.0, valueMult: 1.0 },   // 30% chance
      { threshold: 0.95, grade: 7.0, valueMult: 0.5 },   // 15% chance
      { threshold: 1.00, grade: 5.0, valueMult: 0.1 }    // 5% chance
    ]
  },
  locations: {
    'lgs-wolf': { 
      id: 'lgs-wolf', name: 'Wolf Cards', type: 'lgs', 
      baseMarkup: 0.20, 
      allocationCases: 15, 
      affiliateTiers: [
        { rep: 0, discount: 0, name: 'Customer' },
        { rep: 50, discount: 0.05, name: 'Regular' },
        { rep: 250, discount: 0.10, name: 'Affiliate' },
        { rep: 1000, discount: 0.20, name: 'VIP' }
      ]
    },
    'lgs-dragon': { 
      id: 'lgs-dragon', name: "Dragon's Lair", type: 'lgs', 
      baseMarkup: 0.15,
      allocationCases: 50, 
      affiliateTiers: [
        { rep: 0, discount: 0, name: 'Customer' },
        { rep: 100, discount: 0.05, name: 'Bronze' },
        { rep: 500, discount: 0.15, name: 'Silver' }
      ]
    },
    'bb-tarj': { 
      id: 'bb-tarj', name: 'TarJ', type: 'bigbox', 
      unlockDay: 8, baseMarkup: 0 
    },
    'bb-wally': { 
      id: 'bb-wally', name: 'WallyMart', type: 'bigbox', 
      unlockDay: 8, baseMarkup: 0 
    },
    'resort-disney': {
      id: 'resort-disney', name: 'Disney Resort', type: 'resort',
      entryFee: 1000, baseMarkup: 0
    }
  },
  reputation: {
    basePointsPerRarity: {
      'Common': 1, 'Uncommon': 2, 'Rare': 5, 
      'Super Rare': 15, 'Legendary': 50, 'Enchanted': 200
    },
    diminishingReturnsCurve: [1.0, 0.8, 0.5, 0.2, 0.05, 0.0] 
  },
  packConfiguration: {
    cardsPerPack: 12,
    packsPerBox: 24,
    slots: [
      { rarity: ['Common'], count: 6 },
      { rarity: ['Uncommon'], count: 3 },
      { rarity: ['Rare', 'Super Rare', 'Legendary'], count: 2 },
      { rarity: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Enchanted'], count: 1, isFoil: true }
    ],
    pullRates: {
      'Rare': 60, 'Super Rare': 30, 'Legendary': 9, 'Enchanted': 1 
    }
  },
  world: {
    deskCapacity: 50,
    deskDecayRate: 0.05, 
    printRunBase: {
      'Common': 100000, 'Uncommon': 50000, 'Rare': 25000,
      'Super Rare': 10000, 'Legendary': 2500, 'Enchanted': 500,
    },
    npcDailyRipVolumeBase: 500, 
  },
  storageDefs: {
    'basic-8-drawer': { name: 'Basic Storage', capacityPerSlot: 600, slots: 8, type: 'drawer' },
    'pro-5000-count': { name: 'Pro 5k Box', capacityPerSlot: 1250, slots: 4, type: 'row' }
  }
};

// --- SET THEMES & LOGOS ---
export const SET_THEMES: Record<string, { bg: string, text: string, border: string, symbol: string }> = {
  '1': { bg: 'from-amber-600 to-yellow-800', text: 'text-amber-100', border: 'border-amber-400/50', symbol: '✧' },
  '2': { bg: 'from-blue-600 to-indigo-800', text: 'text-blue-100', border: 'border-blue-400/50', symbol: '🌊' },
  '3': { bg: 'from-emerald-600 to-teal-800', text: 'text-emerald-100', border: 'border-emerald-400/50', symbol: '🗺️' },
  '4': { bg: 'from-purple-600 to-fuchsia-800', text: 'text-purple-100', border: 'border-purple-400/50', symbol: '👑' },
  '5': { bg: 'from-red-600 to-rose-800', text: 'text-red-100', border: 'border-red-400/50', symbol: '✨' },
  'p1': { bg: 'from-slate-700 to-slate-900', text: 'text-slate-200', border: 'border-slate-500/50', symbol: '★' }
};
export const getSetTheme = (setId: string) => SET_THEMES[setId.toLowerCase()] || { bg: 'from-blue-600 to-purple-700', text: 'text-white', border: 'border-blue-400/50', symbol: '♦' };
