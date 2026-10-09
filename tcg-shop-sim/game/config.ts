import { DEVELOPER_SETTINGS } from './generatedSettings';

export { DEVELOPER_SETTINGS };

// --- UTILS ---
export const normalizeRarity = (r: string) => {
  if (!r) return 'Common';
  return r.toLowerCase().replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// --- CONFIGURATION ---
export const GAME_CONFIG = {
  startingState: {
    currency: DEVELOPER_SETTINGS.game.starting_currency,
    sealedProduct: [
      { type: 'box', setId: '1', quantity: 2 },
      { type: 'pack', setId: '1', quantity: 5 }
    ],
    storageUnits: ['basic-300'],
  },
  economy: {
    retailPrices: {
      pack: DEVELOPER_SETTINGS.products.default_pack_price,
      box: DEVELOPER_SETTINGS.products.default_box_price,
    },
    storagePrices: {
      'basic-8-drawer': 50.00,
      'pro-5000-count': 120.00,
    }
  },
  energy: {
    baseMax: DEVELOPER_SETTINGS.energy.max_energy,
    costs: {
      ripPack: DEVELOPER_SETTINGS.energy.pack_rip_cost,
      liveRipPack: DEVELOPER_SETTINGS.energy.live_pack_rip_cost,
      sortCard: DEVELOPER_SETTINGS.energy.card_sort_cost,
      visitStore: DEVELOPER_SETTINGS.energy.store_visit_cost,
      disneyTrip: DEVELOPER_SETTINGS.energy.disney_trip_cost,
      openBox: DEVELOPER_SETTINGS.energy.box_open_cost
    },
    supplies: {
      energyDrink: {
        price: DEVELOPER_SETTINGS.economy.energy_drink_price,
        restores: DEVELOPER_SETTINGS.energy.energy_drink_restore,
        repGain: DEVELOPER_SETTINGS.energy.energy_drink_reputation,
      }
    }
  },
  businessUpgrades: {
    worker: {
      cost: DEVELOPER_SETTINGS.business.worker_hire_cost,
      maxEnergyBoost: DEVELOPER_SETTINGS.business.worker_energy_boost,
      marginPenalty: DEVELOPER_SETTINGS.business.worker_margin_penalty,
      name: "Hire Worker",
      desc: `Adds ${DEVELOPER_SETTINGS.business.worker_energy_boost} Max Energy. Takes ${Math.round(DEVELOPER_SETTINGS.business.worker_margin_penalty * 100)}% of gross profits.`,
    }
  },
  liveShows: {
    types: {
      'standard': { name: 'Standard Rip', cost: DEVELOPER_SETTINGS.live.standard_show_energy, whaleAttraction: 1.5, frugalAttraction: 1.0, desc: "Balanced viewership." },
      'singles': { name: 'Singles Show', cost: DEVELOPER_SETTINGS.live.singles_show_energy, whaleAttraction: 0.8, frugalAttraction: 2.5, desc: "Attracts deal-hunters." },
      'rtyh': { name: 'Rip Till You Hit', cost: DEVELOPER_SETTINGS.live.rtyh_show_energy, whaleAttraction: 2.5, frugalAttraction: 1.2, desc: "Attracts high-rollers." }
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
      districtId: 'home',
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
      districtId: 'home',
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
      districtId: 'city-center',
      unlockDay: 8, baseMarkup: 0 
    },
    'bb-wally': { 
      id: 'bb-wally', name: 'WallyMart', type: 'bigbox', 
      districtId: 'uptown',
      unlockDay: 8, baseMarkup: 0 
    },
    'resort-disney': {
      id: 'resort-disney', name: 'Disney Resort', type: 'resort',
      districtId: 'apple-shire',
      entryFee: 1000, baseMarkup: 0
    }
  },
  worldMap: {
    districts: [
      { id: 'home', name: 'Home District', cityId: 'home-city', x: 0, y: 0, availableProperties: ['garage'] as const },
      { id: 'uptown', name: 'Uptown', cityId: 'home-city', x: 1, y: 0, availableProperties: ['shop'] as const },
      { id: 'downtown', name: 'Downtown', cityId: 'home-city', x: -1, y: 0, availableProperties: ['shop'] as const },
      { id: 'city-center', name: 'City Center', cityId: 'home-city', x: 0, y: 1, availableProperties: ['shop', 'warehouse'] as const },
      { id: 'suburbs', name: 'Suburbs', cityId: 'home-city', x: 0, y: -1, availableProperties: ['garage', 'warehouse'] as const },
      { id: 'sodo', name: 'SODO', cityId: 'home-city', x: -1, y: -1, availableProperties: ['shop', 'warehouse'] as const },
      { id: 'portlandia', name: 'Portlandia', cityId: 'portlandia', x: 0, y: 0, availableProperties: ['shop'] as const },
      { id: 'seatown', name: 'SeaTown', cityId: 'seatown', x: 0, y: 0, availableProperties: ['shop', 'warehouse'] as const },
      { id: 'midwesteria', name: 'MidWesteria', cityId: 'midwesteria', x: 0, y: 0, availableProperties: ['warehouse'] as const },
      { id: 'shytown', name: 'ShyTown', cityId: 'shytown', x: 0, y: 0, availableProperties: ['shop'] as const },
      { id: 'apple-shire', name: 'AppleShire', cityId: 'apple-shire', x: 0, y: 0, availableProperties: ['warehouse'] as const },
    ],
    cities: [
      { id: 'home-city', name: 'Starting City', unlocked: true },
      { id: 'portlandia', name: 'Portlandia', unlockExplorations: 4, travelHops: 3 },
      { id: 'seatown', name: 'SeaTown', unlockExplorations: 6, travelHops: 4 },
      { id: 'midwesteria', name: 'MidWesteria', unlockExplorations: 8, travelHops: 5 },
      { id: 'shytown', name: 'ShyTown', unlockExplorations: 10, travelHops: 6 },
      { id: 'apple-shire', name: 'AppleShire', unlockExplorations: 12, travelHops: 7 },
    ],
  },
  onlineVendors: [
    { id: 'panazon', name: 'Panazon', warehouseDistrictId: 'home' },
    { id: 'notwhat', name: 'NotWhat', warehouseDistrictId: 'uptown' },
    { id: 'baybay', name: 'BayBay', warehouseDistrictId: 'downtown' },
  ],
  propertyDefs: {
    garage: { name: 'Garage', purchaseCost: DEVELOPER_SETTINGS.business.garage_purchase_cost, dailyCost: DEVELOPER_SETTINGS.business.garage_daily_cost },
    shop: { name: 'Shop', purchaseCost: DEVELOPER_SETTINGS.business.shop_purchase_cost, dailyCost: DEVELOPER_SETTINGS.business.shop_daily_cost },
    warehouse: { name: 'Warehouse', purchaseCost: DEVELOPER_SETTINGS.business.warehouse_purchase_cost, dailyCost: DEVELOPER_SETTINGS.business.warehouse_daily_cost },
  },
  reputation: {
    basePointsPerRarity: {
      'Common': 1, 'Uncommon': 2, 'Rare': 5, 
      'Super Rare': 15, 'Legendary': 50, 'Enchanted': 200
    },
    diminishingReturnsCurve: [1.0, 0.8, 0.5, 0.2, 0.05, 0.0] 
  },
  packConfiguration: {
    cardsPerPack: DEVELOPER_SETTINGS.products.default_cards_per_pack,
    packsPerBox: DEVELOPER_SETTINGS.products.default_packs_per_box,
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
    deskCapacity: DEVELOPER_SETTINGS.storage.desk_capacity,
    deskDecayRate: DEVELOPER_SETTINGS.world.desk_card_decay_rate,
    printRunBase: {
      'Common': DEVELOPER_SETTINGS.world.common_print_run_base,
      'Uncommon': DEVELOPER_SETTINGS.world.uncommon_print_run_base,
      'Rare': DEVELOPER_SETTINGS.world.rare_print_run_base,
      'Super Rare': DEVELOPER_SETTINGS.world.super_rare_print_run_base,
      'Legendary': DEVELOPER_SETTINGS.world.legendary_print_run_base,
      'Enchanted': DEVELOPER_SETTINGS.world.enchanted_print_run_base,
    },
    npcDailyRipVolumeBase: DEVELOPER_SETTINGS.world.npc_daily_rip_volume_base,
  },
  storageDefs: {
    'basic-300': { name: 'Bedroom Storage', capacityPerSlot: DEVELOPER_SETTINGS.storage.bedroom_cards_per_drawer, slots: DEVELOPER_SETTINGS.storage.container_drawers, type: 'drawer', price: 0 },
    'compact-600': { name: 'Compact Container', capacityPerSlot: DEVELOPER_SETTINGS.storage.compact_cards_per_drawer, slots: DEVELOPER_SETTINGS.storage.container_drawers, type: 'drawer', price: DEVELOPER_SETTINGS.storage.compact_container_price },
    'standard-1800': { name: 'Standard Container', capacityPerSlot: DEVELOPER_SETTINGS.storage.standard_cards_per_drawer, slots: DEVELOPER_SETTINGS.storage.container_drawers, type: 'drawer', price: DEVELOPER_SETTINGS.storage.standard_container_price },
    'large-3600': { name: 'Large Container', capacityPerSlot: DEVELOPER_SETTINGS.storage.large_cards_per_drawer, slots: DEVELOPER_SETTINGS.storage.container_drawers, type: 'drawer', price: DEVELOPER_SETTINGS.storage.large_container_price },
    'warehouse-5400': { name: 'Warehouse Container', capacityPerSlot: DEVELOPER_SETTINGS.storage.warehouse_cards_per_drawer, slots: DEVELOPER_SETTINGS.storage.container_drawers, type: 'drawer', price: DEVELOPER_SETTINGS.storage.warehouse_container_price }
  },
  binders: {
    designs: [
      { id: 'classic-25', name: 'Classic', pages: 25, slotsPerPage: 9 as const, price: DEVELOPER_SETTINGS.binders.classic_25_price, resaleFraction: DEVELOPER_SETTINGS.binders.classic_25_resale_fraction },
      { id: 'portfolio-35', name: 'Portfolio', pages: 35, slotsPerPage: 4 as const, price: DEVELOPER_SETTINGS.binders.portfolio_35_price, resaleFraction: DEVELOPER_SETTINGS.binders.portfolio_35_resale_fraction },
      { id: 'showcase-45', name: 'Showcase', pages: 45, slotsPerPage: 1 as const, price: DEVELOPER_SETTINGS.binders.showcase_45_price, resaleFraction: DEVELOPER_SETTINGS.binders.showcase_45_resale_fraction }
    ]
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
