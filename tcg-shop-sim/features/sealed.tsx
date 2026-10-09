import React, { useState, useEffect } from 'react';
import { GAME_CONFIG, getSetTheme } from '../game/config';
import type { CardInstance, GameState, LiveRequest } from '../game/types';
import { useGame } from '../game/state';
import { generatePack } from '../game/engine';
import { DEVELOPER_SETTINGS } from '../game/config';
import { boxPackProductFor, packProductFor, productsForSet } from '../game/products';
import { getCalculatedCardValue } from '../game/engine';
import { Archive, Box, AlertTriangle, X, Zap, MonitorPlay, DollarSign, Users } from 'lucide-react';
import { addCardsToInventory, availableCardCapacity } from '../game/inventory';
import { calculateLiveSaleOutcome } from '../game/liveSales';

type SinglesMatchField = 'name' | 'character' | 'rarity' | 'set';

const characterValuesFor = (card: CardInstance, dictionary: Record<string, { cardData?: Record<string, unknown> }>) => {
  const raw = dictionary[card.cardId]?.cardData;
  if (!raw) return [];
  const value = raw.character ?? raw.characters ?? raw.characterName ?? raw.character_name;
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string' && item.name.trim()) {
      return [item.name.trim()];
    }
    return [];
  });
};

const hasCardRedemption = (redemptions: unknown): boolean => {
  if (!redemptions || typeof redemptions !== 'object' || Array.isArray(redemptions)) return false;
  const tiers = (redemptions as { tiers?: unknown }).tiers;
  return Array.isArray(tiers) && tiers.some(tier =>
    Boolean(tier && typeof tier === 'object' && 'prizeType' in tier && tier.prizeType === 'card'));
};

export const ScreenSealed = ({ onRipPack }: { onRipPack: (id: string, setId: string, productId?: string) => void }) => {
  const { state, setState, availableSets, dictionary, consumeEnergy } = useGame();
  const [showConfig, setShowConfig] = useState(false);
  const [includedBinderIds, setIncludedBinderIds] = useState<string[]>([]);
  const [includedSealedIds, setIncludedSealedIds] = useState<string[]>([]);
  const sellableSealedAtHome = state.sealed.filter(item => (item.locationId || state.homeLocationId) === state.homeLocationId);
  const getSet = (id: string) => availableSets.find(s => s.id.toUpperCase() === id.toUpperCase() || s.code.toUpperCase() === id.toUpperCase());
  const getSetName = (id: string) => getSet(id)?.name || id;

  const openBox = (boxId: string, setId: string, boxProductId?: string) => {
    const box = productsForSet(getSet(setId)).find(product => product.id === boxProductId && product.type === 'box');
    const packCount = box?.packsPerBox || GAME_CONFIG.packConfiguration.packsPerBox;
    const boxItem = state.sealed.find(item => item.id === boxId);
    const locationId = boxItem?.locationId || state.homeLocationId;
    const reservedProducts = state.shipments.filter(shipment => shipment.destinationLocationId === locationId && shipment.status !== 'delivered')
      .reduce((sum, shipment) => sum + shipment.items.reduce((count, shipmentItem) => count + shipmentItem.quantity, 0), 0);
    const currentProducts = state.sealed.filter(item => item.locationId === locationId).length;
    if (currentProducts - 1 + packCount + reservedProducts > DEVELOPER_SETTINGS.storage.sealed_products_per_location) {
      alert('There is not enough sealed-product capacity to open this box. Clear inventory space first.');
      return;
    }
    if (consumeEnergy(GAME_CONFIG.energy.costs.openBox)) {
      setState(prev => {
        const set = getSet(setId);
        const currentBox = productsForSet(set).find(product => product.id === boxProductId && product.type === 'box');
        const pack = currentBox ? boxPackProductFor(set, currentBox) : packProductFor(set);
        const currentBoxItem = prev.sealed.find(s => s.id === boxId);
        const newSealed = prev.sealed.filter(s => s.id !== boxId);
        const newPacks = Array.from({ length: currentBox?.packsPerBox || GAME_CONFIG.packConfiguration.packsPerBox }).map(() => ({
          id: crypto.randomUUID(), type: 'pack' as const, setId, productId: pack.id, locationId: currentBoxItem?.locationId
        }));
        return { ...prev, sealed: [...newSealed, ...newPacks] };
      });
    }
  };

  const hasRoomForPack = (packId: string, productId: string | undefined, setId: string) => {
    const product = packProductFor(getSet(setId), productId);
    const requiredCards = (product.slots?.reduce((sum, slot) => sum + slot.count, 0) || product.cardsPerPack || GAME_CONFIG.packConfiguration.cardsPerPack) +
      (hasCardRedemption(getSet(setId)?.redemptions) ? 1 : 0);
    const locationId = state.sealed.find(item => item.id === packId)?.locationId || state.currentLocationId;
    if (availableCardCapacity(state, locationId) < requiredCards) {
      alert(`Not enough inventory capacity for ${requiredCards} cards. Store or sell cards, move cards to a binder, or buy eligible storage.`);
      return false;
    }
    return true;
  };

  const handleRipPack = (pId: string, setId: string, productId?: string) => {
    if (!hasRoomForPack(pId, productId, setId)) return;
    const cost = state.liveState.active ? GAME_CONFIG.energy.costs.liveRipPack : GAME_CONFIG.energy.costs.ripPack;
    if (consumeEnergy(cost)) {
      onRipPack(pId, setId, productId);
    }
  };

  const generateSinglesRequests = (typeId: string): LiveRequest[] => {
    const isSingles = typeId === 'singles';
    const sources = [
      ...state.storage.flatMap(unit => unit.slots.map(drawer => ({
        type: 'storage' as const,
        storageId: unit.id,
        drawerId: drawer.id,
        cards: drawer.cards,
      }))),
      ...state.binders.filter(binder => isSingles && includedBinderIds.includes(binder.id)).map(binder => ({
        type: 'binder' as const,
        binderId: binder.id,
        cards: binder.cards,
      })),
    ].filter(source => source.cards.some(instance => dictionary[instance.cardId]));
    const selectedProducts = isSingles
      ? sellableSealedAtHome.filter(item => includedSealedIds.includes(item.id))
      : sellableSealedAtHome;
    const productQueueReserve = selectedProducts.length > 0 ? 1 : 0;
    const requests: LiveRequest[] = [];
    for (let attempt = 0; attempt < DEVELOPER_SETTINGS.live.queue_limit * 4 && sources.length > 0 && requests.length < DEVELOPER_SETTINGS.live.queue_limit - productQueueReserve; attempt += 1) {
      const source = sources[Math.floor(Math.random() * sources.length)];
      const available = source.cards.filter(instance => dictionary[instance.cardId]);
      if (available.length === 0) continue;
      const chosen = available[Math.floor(Math.random() * available.length)];
      const cardData = dictionary[chosen.cardId];
      const getValue = (instance: CardInstance, field: SinglesMatchField): string[] => {
        const candidate = dictionary[instance.cardId];
        if (field === 'name') return [candidate.name];
        if (field === 'rarity') return [candidate.rarity];
        if (field === 'set') return [candidate.setId];
        return characterValuesFor(instance, dictionary);
      };
      const fields: SinglesMatchField[] = ['name', 'rarity', 'set'];
      if (characterValuesFor(chosen, dictionary).length > 0) fields.push('character');
      const matchFields = Math.random() < 0.25 && fields.length > 1
        ? fields.sort(() => Math.random() - 0.5).slice(0, 2)
        : [fields[Math.floor(Math.random() * fields.length)]];
      const criteria = matchFields.map(field => ({
        field,
        value: getValue(chosen, field)[0],
      }));
      const matchingCards = available.filter(instance => criteria.every(({ field, value }) => getValue(instance, field).includes(value)));
      if (matchingCards.length === 0) continue;
      const quantity = Math.min(matchingCards.length, Math.floor(Math.random() * 3) + 1);
      const specificity = criteria.some(({ field }) => field === 'name' || field === 'character') ? 'specific' : 'vague';
      const description = `${quantity} ${criteria.map(({ field, value }) => {
        if (field === 'name') return value;
        if (field === 'character') return `featuring ${value}`;
        if (field === 'rarity') return `${value} rarity`;
        return `from ${getSetName(value)}`;
      }).join(' · ')}`;
      const matchBy = matchFields.length > 1 ? 'combination' : matchFields[0];
      const matchValue = criteria.map(criterion => criterion.value).join('|');
      requests.push({
        id: crypto.randomUUID(),
        description,
        matchBy,
        matchValue,
        quantity,
        specificity,
        source: source.type === 'storage'
          ? { type: source.type, storageId: source.storageId, drawerId: source.drawerId }
          : { type: source.type, binderId: source.binderId },
        candidateInstanceIds: matchingCards.map(instance => instance.instanceId),
      });
    }
    const productsByKind = new Map<string, typeof selectedProducts>();
    selectedProducts.forEach(item => {
      const key = `${item.setId}:${item.productId || item.type}:${item.type}`;
      productsByKind.set(key, [...(productsByKind.get(key) || []), item]);
    });
    for (const productItems of productsByKind.values()) {
      if (requests.length >= DEVELOPER_SETTINGS.live.queue_limit) break;
      const item = productItems[0];
      const set = getSet(item.setId);
      const product = productsForSet(set).find(candidate => candidate.id === item.productId);
      const count = Math.min(productItems.length, Math.floor(Math.random() * 3) + 1);
      requests.push({
        id: crypto.randomUUID(),
        description: `${count} ${product?.name || item.type} from ${getSetName(item.setId)}`,
        matchBy: 'set',
        matchValue: item.setId,
        quantity: count,
        specificity: 'specific',
        source: { type: 'sealed' },
        candidateInstanceIds: productItems.slice(0, count).map(productItem => productItem.id),
        productId: item.productId,
        sealedType: item.type,
      });
    }
    return requests;
  };

  const startLiveShow = (typeId: string) => {
    if (state.currentLocationId !== state.homeLocationId) {
      alert('Live Sales take place in your bedroom. Return home before starting a show.');
      return;
    }
    const typeDef = (GAME_CONFIG.liveShows.types as any)[typeId];
    const requests = generateSinglesRequests(typeId);
    if (typeId === 'singles' && requests.length === 0) {
      alert('Your customer queue would be empty. Add cards to storage drawers, or tick binders or sealed products under "Singles sellable inventory", then try again.');
      return;
    }
    if (consumeEnergy(typeDef.cost)) {
      const baseViewers = Math.floor(Math.random() * 10) + 5;
      const shopBonus = Math.floor((state.shopStats.itemsSold * 0.1) + (state.shopStats.liveShows * 2) + state.shopStats.returnBuyers);
      const totalViewers = baseViewers + shopBonus;
      
      const whales = Math.floor(totalViewers * 0.05 * typeDef.whaleAttraction);
      const frugal = Math.floor(totalViewers * 0.40 * typeDef.frugalAttraction);

      setState(prev => ({ 
        ...prev, 
        shopStats: { ...prev.shopStats, liveShows: prev.shopStats.liveShows + 1 },
        liveState: { active: true, type: typeId, viewers: totalViewers, whales, frugal, requests, sellableBinderIds: typeId === 'singles' ? includedBinderIds : [] } 
      }));
      setShowConfig(false);
    }
  };

  const endLiveShow = () => setState(prev => ({ ...prev, liveState: { ...prev.liveState, active: false, requests: [], sellableBinderIds: [] } }));

  const locationSealed = state.sealed.filter(item => (item.locationId || state.homeLocationId) === state.currentLocationId);
  const boxes = locationSealed.filter(s => s.type === 'box');
  const packs = locationSealed.filter(s => s.type === 'pack');

  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      
      {state.liveState.active ? (
        <div className="bg-slate-900 rounded-xl p-4 mb-4 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-in slide-in-from-top-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center">
                <span className="bg-red-600 text-white text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded animate-pulse mr-2">LIVE</span>
                <h3 className="text-white font-bold text-lg">Rip Ship Stream</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 capitalize">{GAME_CONFIG.liveShows.types[state.liveState.type as keyof typeof GAME_CONFIG.liveShows.types]?.name}</p>
            </div>
            <button onClick={endLiveShow} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded border border-slate-700">End Stream</button>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
              <Users size={16} className="mx-auto text-blue-400 mb-1" />
              <div className="text-sm font-bold text-white">{state.liveState.viewers}</div>
              <div className="text-[10px] text-slate-500 uppercase">Viewers</div>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
              <DollarSign size={16} className="mx-auto text-yellow-400 mb-1" />
              <div className="text-sm font-bold text-white">{state.liveState.whales}</div>
              <div className="text-[10px] text-slate-500 uppercase">Whales</div>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
              <Archive size={16} className="mx-auto text-green-400 mb-1" />
              <div className="text-sm font-bold text-white">{state.liveState.frugal}</div>
              <div className="text-[10px] text-slate-500 uppercase">Frugal</div>
            </div>
          </div>
        </div>
      ) : showConfig ? (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700 shadow-lg animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-white font-bold flex items-center"><MonitorPlay size={18} className="mr-2 text-blue-400" /> Start Live Show</h3>
             <button onClick={() => setShowConfig(false)} className="text-slate-400"><X size={20}/></button>
          </div>
          <div className="space-y-3">
             {Object.entries(GAME_CONFIG.liveShows.types).map(([id, type]) => (
                <div key={id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                   <div>
                      <div className="text-sm font-bold text-white">{type.name}</div>
                      <div className="text-xs text-slate-400">{type.desc} Customer queue is built from {id === 'singles' ? 'the sellable inventory you choose below.' : 'your stored singles and sealed products at home.'}</div>
                   </div>
                   <button onClick={() => startLiveShow(id)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded shadow flex items-center shrink-0 ml-2">
                     Go Live <Zap size={10} className="ml-1 mr-0.5 text-yellow-300"/>{type.cost}
                   </button>
                </div>
             ))}
             {GAME_CONFIG.liveShows.types.singles && (
               <div className="bg-slate-900/70 rounded-lg border border-slate-700 p-3">
                 <div className="text-sm font-bold text-white">Singles sellable inventory</div>
                 <div className="text-xs text-slate-400 my-1">Storage drawers are included. Choose any binders to include for this live only.</div>
                 {state.binders.map(binder => (
                   <label key={binder.id} className="flex items-center gap-2 text-xs text-slate-300 py-1">
                     <input type="checkbox" checked={includedBinderIds.includes(binder.id)} onChange={event => setIncludedBinderIds(prev => event.target.checked ? [...prev, binder.id] : prev.filter(id => id !== binder.id))} />
                     {binder.name} ({binder.cards.length} cards)
                   </label>
                 ))}
                 {sellableSealedAtHome.map(item => (
                   <label key={item.id} className="flex items-center gap-2 text-xs text-slate-300 py-1">
                     <input type="checkbox" checked={includedSealedIds.includes(item.id)} onChange={event => setIncludedSealedIds(prev => event.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))} />
                     {productsForSet(getSet(item.setId)).find(product => product.id === item.productId)?.name || item.type} · {getSetName(item.setId)}
                   </label>
                 ))}
                 {sellableSealedAtHome.length === 0 && <div className="text-xs text-slate-500">No sealed products are at home to offer.</div>}
                 <div className="text-[10px] text-slate-500">Stored cards available: {state.storage.reduce((sum, unit) => sum + unit.slots.reduce((n, drawer) => n + drawer.cards.length, 0), 0)}</div>
               </div>
             )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700 flex justify-between items-center shadow-lg">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center">
              <MonitorPlay size={20} className="mr-2 text-slate-400" /> Live Rip Ship
            </h3>
            <p className="text-xs text-slate-400">Stream openings. Packs cost 1 ⚡.</p>
          </div>
          <button onClick={() => setShowConfig(true)} disabled={state.currentLocationId !== state.homeLocationId} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-bold text-sm shadow shrink-0 ml-4">
            Setup Stream
          </button>
        </div>
      )}

      {state.liveState.active && <SinglesRequests />}

      <h2 className="text-xl font-bold text-white mb-4">Sealed Inventory</h2>
      {state.sealed.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
          <Archive size={48} className="mx-auto mb-3 opacity-20" />
          <p>Your sealed inventory is empty.</p>
          <p className="text-sm mt-1">Visit the City to buy product.</p>
        </div>
      ) : locationSealed.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
          <Archive size={40} className="mx-auto mb-3 opacity-30" />
          <p>No sealed products are stored at this location.</p>
          <p className="text-sm mt-1">Travel to the location holding your products to open them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {boxes.map(b => {
             const theme = getSetTheme(b.setId);
             const boxProduct = productsForSet(getSet(b.setId)).find(product => product.id === b.productId);
             return (
              <div key={b.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center text-center shadow-lg">
                <div className="w-20 h-16 bg-gradient-to-br from-slate-600 to-slate-800 rounded border border-slate-500 mb-3 flex items-center justify-center relative overflow-hidden">
                  {boxProduct?.imageUrl
                    ? <img src={boxProduct.imageUrl} alt={boxProduct.name} className="absolute inset-0 w-full h-full object-contain" />
                    : <><div className={`absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-b ${theme.bg}`}></div><span className={`text-2xl opacity-20 absolute ${theme.text}`}>{theme.symbol}</span><Box size={24} className="text-slate-400 z-10" /></>}
                </div>
                <div className="text-sm font-bold text-white mb-1 line-clamp-1">{boxProduct?.name || getSetName(b.setId)}</div>
                <div className="text-xs text-slate-400 mb-3">{getSetName(b.setId)}</div>
                <button onClick={() => openBox(b.id, b.setId, b.productId)} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center">
                  Crack Box <Zap size={10} className="ml-1 text-yellow-300"/> <span className="ml-0.5">{GAME_CONFIG.energy.costs.openBox}</span>
                </button>
              </div>
            );
          })}
          {packs.map(p => {
            const theme = getSetTheme(p.setId);
            const setName = getSetName(p.setId);
            const packProduct = productsForSet(getSet(p.setId)).find(product => product.id === p.productId);
            return (
              <div key={p.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                  <div className={`w-16 h-24 bg-gradient-to-br ${theme.bg} rounded border ${theme.border} mb-3 shadow-inner flex flex-col items-center justify-center relative overflow-hidden`}>
                    {packProduct?.imageUrl
                      ? <img src={packProduct.imageUrl} alt={packProduct.name} className="absolute inset-0 w-full h-full object-contain" />
                      : <><div className="absolute inset-0 bg-white/10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 15%, 0 25%)'}}></div><span className={`text-2xl font-bold ${theme.text} transform drop-shadow-md mb-1`}>{theme.symbol}</span><span className={`text-[8px] font-bold ${theme.text} uppercase transform -rotate-12 drop-shadow-md tracking-widest text-center leading-tight px-1`}>{setName.split(' ').slice(0, 2).join('\n')}</span></>}
                 </div>
                 <div className="text-xs text-slate-400 mb-3 line-clamp-1">{packProduct?.name || setName}</div>
                <button onClick={() => handleRipPack(p.id, p.setId, p.productId)} className={`w-full ${state.liveState.active ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'} text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center`}>
                  Rip Pack <Zap size={10} className="ml-1 text-yellow-300"/> <span className="ml-0.5">{state.liveState.active ? GAME_CONFIG.energy.costs.liveRipPack : GAME_CONFIG.energy.costs.ripPack}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const cardsForRequestSource = (request: LiveRequest, state: GameState): CardInstance[] => {
  if (request.source.type === 'storage') {
    const drawer = state.storage.find(unit => unit.id === request.source.storageId)?.slots.find(slot => slot.id === request.source.drawerId);
    return drawer?.cards || [];
  }
  if (request.source.type === 'binder') return state.binders.find(binder => binder.id === request.source.binderId)?.cards || [];
  return [];
};

const SinglesRequests = () => {
  const { state, setState, dictionary, availableSets, consumeEnergy } = useGame();
  const [searchRequestId, setSearchRequestId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<'high' | 'low'>('high');
  const [arrowPosition, setArrowPosition] = useState(0);
  const [searchCenter, setSearchCenter] = useState(50);
  const [salePrice, setSalePrice] = useState(0);
  const [energyPenaltyApplied, setEnergyPenaltyApplied] = useState(false);
  const request = state.liveState.requests.find(item => item.id === searchRequestId) || null;

  const sourceCards = request ? cardsForRequestSource(request, state) : [];
  const eligibleCards = request ? sourceCards.filter(card => request.candidateInstanceIds.includes(card.instanceId)) : [];
  const targetCard = eligibleCards[0];
  const targetCardData = targetCard ? dictionary[targetCard.cardId] : undefined;
  const occupiedCapacity = request?.source.type === 'storage'
    ? (() => {
      const unit = state.storage.find(item => item.id === request.source.storageId);
      const def = unit && GAME_CONFIG.storageDefs[unit.typeId as keyof typeof GAME_CONFIG.storageDefs];
      return def?.capacityPerSlot || 1;
    })()
    : (() => {
      const binder = state.binders.find(item => item.id === request?.source.binderId);
      return binder ? binder.pageCount * binder.slotsPerPage : 1;
    })();
  const occupiedCards = request?.source.type === 'storage' ? sourceCards.length : sourceCards.length;
  const occupancyPercent = Math.min(100, occupiedCards / occupiedCapacity * 100);
  const targetIndex = targetCard ? Math.max(0, sourceCards.findIndex(card => card.instanceId === targetCard.instanceId)) : 0;
  const targetPercent = occupiedCapacity > 0 ? (targetIndex + 0.5) / occupiedCapacity * 100 : 50;
  const hitZone = difficulty === 'high'
    ? DEVELOPER_SETTINGS.live.high_search_hit_zone
    : DEVELOPER_SETTINGS.live.low_search_hit_zone;
  const center = difficulty === 'high' ? targetPercent : searchCenter;
  const zoneStart = Math.max(0, center - hitZone * 50);
  const zoneWidth = Math.min(100 - zoneStart, hitZone * 100);
  const marketPrice = targetCardData ? getCalculatedCardValue(targetCardData, targetCard?.condition || 1, targetCard?.grade, targetCard?.gradingCompany) : 0;
  const sealedItem = request?.source.type === 'sealed'
    ? state.sealed.find(item => request.candidateInstanceIds.includes(item.id))
    : undefined;
  const requestedProduct = request?.source.type === 'sealed'
    ? productsForSet(availableSets.find(set => set.id === sealedItem?.setId)).find(product => product.id === request.productId)
    : undefined;
  const sealedMarketPrice = requestedProduct
    ? requestedProduct.price ?? GAME_CONFIG.economy.retailPrices[requestedProduct.type]
    : 0;

  useEffect(() => {
    if (!request || request.source.type === 'sealed') return;
    const speed = difficulty === 'high'
      ? DEVELOPER_SETTINGS.live.high_search_arrow_speed
      : DEVELOPER_SETTINGS.live.low_search_arrow_speed;
    const timer = window.setInterval(() => {
      setArrowPosition(current => (current + speed) % 100);
    }, 30);
    return () => window.clearInterval(timer);
  }, [request?.id, difficulty]);

  const openSearch = (item: LiveRequest) => {
    setSearchRequestId(item.id);
    setDifficulty('high');
    setArrowPosition(0);
    setSearchCenter(50);
    if (item.source.type === 'sealed') {
      const itemSealed = state.sealed.find(sealed => item.candidateInstanceIds.includes(sealed.id));
      const itemProduct = productsForSet(availableSets.find(set => set.id === itemSealed?.setId)).find(product => product.id === item.productId);
      setSalePrice(itemProduct ? itemProduct.price ?? GAME_CONFIG.economy.retailPrices[itemProduct.type] : 0);
      return;
    }
    const itemSourceCards = cardsForRequestSource(item, state);
    const itemInstance = itemSourceCards.find(card => item.candidateInstanceIds.includes(card.instanceId));
    const card = itemInstance && dictionary[itemInstance.cardId];
    setSalePrice(card ? getCalculatedCardValue(card, itemInstance!.condition, itemInstance!.grade, itemInstance!.gradingCompany) : 0);
    const storageUnit = item.source.type === 'storage'
      ? state.storage.find(unit => unit.id === item.source.storageId)
      : undefined;
    const storageDefinition = storageUnit && GAME_CONFIG.storageDefs[storageUnit.typeId as keyof typeof GAME_CONFIG.storageDefs];
    const binder = item.source.type === 'binder'
      ? state.binders.find(itemBinder => itemBinder.id === item.source.binderId)
      : undefined;
    const capacity = storageDefinition?.capacityPerSlot || (binder ? binder.pageCount * binder.slotsPerPage : 1);
    setSearchCenter(Math.min(100, itemSourceCards.length / capacity * 100) / 2);
  };

  const decline = (item: LiveRequest) => {
    setState(prev => {
      const requestStillActive = prev.liveState.requests.some(requestItem => requestItem.id === item.id);
      if (!requestStillActive) return prev;
      const penalty = item.specificity === 'specific'
        ? DEVELOPER_SETTINGS.live.specific_decline_traffic_penalty
        : DEVELOPER_SETTINGS.live.vague_decline_traffic_penalty;
      return {
        ...prev,
        traffic: Math.max(0, prev.traffic - penalty - DEVELOPER_SETTINGS.live.sellable_decline_traffic_penalty),
        liveState: { ...prev.liveState, requests: prev.liveState.requests.filter(requestItem => requestItem.id !== item.id) },
      };
    });
  };

  const fulfill = (instanceId: string, item: LiveRequest) => {
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      alert('Sale price must be a non-negative number.');
      return;
    }
    const instance = sourceCards.find(card => card.instanceId === instanceId);
    const card = instance && dictionary[instance.cardId];
    if (!instance || !card) {
      alert('The requested card is no longer available in the selected inventory.');
      setSearchRequestId(null);
      return;
    }
    const value = getCalculatedCardValue(card, instance.condition, instance.grade, instance.gradingCompany);
    const outcome = calculateLiveSaleOutcome(
      salePrice,
      value,
      DEVELOPER_SETTINGS.live.platform_fee_fraction,
      DEVELOPER_SETTINGS.live.price_gap_fraction,
      DEVELOPER_SETTINGS.live.price_gap_traffic_penalty,
    );
    setState(prev => {
      const activeRequest = prev.liveState.requests.find(requestItem => requestItem.id === item.id);
      const currentInstance = cardsForRequestSource(item, prev).find(cardItem => cardItem.instanceId === instanceId);
      if (!activeRequest?.candidateInstanceIds.includes(instanceId) || !currentInstance) return prev;
      return {
        ...prev,
        currency: prev.currency + outcome.netProceeds,
        traffic: Math.max(0, prev.traffic - outcome.trafficPenalty),
        shopStats: { ...prev.shopStats, itemsSold: prev.shopStats.itemsSold + 1 },
        storage: prev.storage.map(unit => ({
          ...unit,
          slots: unit.slots.map(drawer => ({ ...drawer, cards: drawer.cards.filter(cardItem => cardItem.instanceId !== instanceId) })),
        })),
        binders: prev.binders.map(binder => ({ ...binder, cards: binder.cards.filter(cardItem => cardItem.instanceId !== instanceId) })),
        liveState: {
          ...prev.liveState,
          requests: prev.liveState.requests.flatMap(requestItem => {
            const remainingIds = requestItem.candidateInstanceIds.filter(id => id !== instanceId);
            if (requestItem.id === item.id && requestItem.quantity <= 1) return [];
            if (remainingIds.length === 0) return [];
            return [{ ...requestItem, quantity: Math.min(requestItem.quantity - (requestItem.id === item.id ? 1 : 0), remainingIds.length), candidateInstanceIds: remainingIds }];
          }),
        },
      };
    });
    setSearchRequestId(null);
  };

  const fulfillSealed = (instanceId: string, item: LiveRequest) => {
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      alert('Sale price must be a non-negative number.');
      return;
    }
    const sealedItem = state.sealed.find(product => product.id === instanceId);
    const product = sealedItem && productsForSet(availableSets.find(set => set.id === sealedItem.setId)).find(candidate => candidate.id === item.productId);
    if (!sealedItem || !product) {
      alert('The requested sealed product is no longer available.');
      setSearchRequestId(null);
      return;
    }
    const market = product.price ?? GAME_CONFIG.economy.retailPrices[product.type];
    const outcome = calculateLiveSaleOutcome(
      salePrice,
      market,
      DEVELOPER_SETTINGS.live.platform_fee_fraction,
      DEVELOPER_SETTINGS.live.price_gap_fraction,
      DEVELOPER_SETTINGS.live.price_gap_traffic_penalty,
    );
    setState(prev => {
      const activeRequest = prev.liveState.requests.find(requestItem => requestItem.id === item.id);
      const currentSealed = prev.sealed.find(productItem => productItem.id === instanceId);
      if (!activeRequest?.candidateInstanceIds.includes(instanceId) || !currentSealed ||
        currentSealed.productId !== item.productId || currentSealed.type !== item.sealedType) return prev;
      return {
        ...prev,
        sealed: prev.sealed.filter(productItem => productItem.id !== instanceId),
        currency: prev.currency + outcome.netProceeds,
        traffic: Math.max(0, prev.traffic - outcome.trafficPenalty),
        shopStats: { ...prev.shopStats, itemsSold: prev.shopStats.itemsSold + 1 },
        liveState: {
          ...prev.liveState,
          requests: prev.liveState.requests.flatMap(requestItem => {
            const remainingIds = requestItem.candidateInstanceIds.filter(id => id !== instanceId);
            if (requestItem.id === item.id && requestItem.quantity <= 1) return [];
            if (remainingIds.length === 0) return [];
            return [{ ...requestItem, quantity: Math.min(requestItem.quantity - (requestItem.id === item.id ? 1 : 0), remainingIds.length), candidateInstanceIds: remainingIds }];
          }),
        },
      };
    });
    setSearchRequestId(null);
  };

  const attemptSearch = () => {
    if (!request || !targetCard) return;
    const cost = difficulty === 'high' ? DEVELOPER_SETTINGS.live.high_search_energy : DEVELOPER_SETTINGS.live.low_search_energy;
    if (!consumeEnergy(cost)) {
      if (!energyPenaltyApplied) {
        setState(prev => ({
          ...prev,
          traffic: Math.max(0, prev.traffic - DEVELOPER_SETTINGS.live.empty_queue_traffic_penalty),
        }));
        setEnergyPenaltyApplied(true);
      }
      return;
    }
    const landed = arrowPosition >= zoneStart && arrowPosition <= zoneStart + zoneWidth;
    if (landed) fulfill(targetCard.instanceId, request);
    else setArrowPosition(0);
  };

  return (
    <section className="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-white">Customer queue</h3>
        <span className="text-xs text-slate-400">{state.liveState.requests.length}/{DEVELOPER_SETTINGS.live.queue_limit} active · Traffic {state.traffic}</span>
      </div>
      {state.liveState.requests.length === 0 ? <p className="text-sm text-slate-500">No customers are waiting. Stock storage drawers or bring sealed product home to attract buyers.</p> : (
        <div className="space-y-2">
          {state.liveState.requests.map(item => (
            <div key={item.id} className="bg-slate-800 rounded p-3 flex flex-wrap justify-between gap-2 items-center">
              <div><div className="text-white text-sm">{item.description}</div><div className="text-[10px] text-slate-400">{item.specificity} request · {item.quantity} available to fulfill</div></div>
              <div className="flex gap-2">
                <button onClick={() => openSearch(item)} disabled={item.source.type === 'sealed'
                  ? !state.sealed.some(product => item.candidateInstanceIds.includes(product.id))
                  : cardsForRequestSource(item, state).filter(card => item.candidateInstanceIds.includes(card.instanceId) && dictionary[card.cardId]).length === 0} className="bg-green-700 disabled:opacity-40 text-white text-xs font-bold rounded px-3 py-2">
                  {item.source.type === 'sealed' ? 'Fulfill product' : 'Search / Fulfill'}
                </button>
                <button onClick={() => decline(item)} className="bg-slate-700 text-slate-200 text-xs rounded px-3 py-2">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {request && (targetCard || (request.source.type === 'sealed' && sealedItem)) && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-800 border border-slate-600 rounded-xl p-5 space-y-4">
            <div className="flex justify-between"><h4 className="font-bold text-white">Search inventory: {request.description}</h4><button onClick={() => setSearchRequestId(null)} aria-label="Close search" className="text-slate-400">✕</button></div>
            {request.source.type !== 'sealed' && <div className="text-xs text-slate-400">Drawer is {occupiedCards}/{occupiedCapacity} cards occupied ({occupancyPercent.toFixed(0)}%).</div>}
            {request.source.type !== 'sealed' && <div className="flex gap-2">
              <button onClick={() => setDifficulty('high')} className={`flex-1 rounded p-2 text-xs ${difficulty === 'high' ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300'}`}>High energy · {DEVELOPER_SETTINGS.live.high_search_energy}</button>
              <button onClick={() => setDifficulty('low')} className={`flex-1 rounded p-2 text-xs ${difficulty === 'low' ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300'}`}>Low energy · {DEVELOPER_SETTINGS.live.low_search_energy}</button>
            </div>}
            {request.source.type !== 'sealed' && difficulty === 'low' && <label className="block text-xs text-slate-300">Choose search center: {searchCenter.toFixed(0)}% of drawer<input type="range" min="0" max={Math.max(1, occupancyPercent)} value={Math.min(searchCenter, Math.max(1, occupancyPercent))} onChange={event => setSearchCenter(Number(event.target.value))} className="w-full" /></label>}
            {request.source.type !== 'sealed' && <div className="relative h-8 bg-slate-700 rounded overflow-hidden border border-slate-600">
              <div className="absolute inset-y-0 left-0 bg-red-900/80" style={{ width: `${occupancyPercent}%` }} />
              <div className="absolute inset-y-0 bg-green-500/80" style={{ left: `${zoneStart}%`, width: `${zoneWidth}%` }} />
              <div className="absolute top-0 bottom-0 w-1 bg-white shadow" style={{ left: `${arrowPosition}%` }} />
            </div>}
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="flex-1 truncate">{targetCardData?.name || requestedProduct?.name || request.description}</span>
              <label className="text-xs">Sale price $<input type="number" min="0" step="0.01" value={salePrice} onChange={event => setSalePrice(Number(event.target.value))} className="w-24 bg-slate-900 rounded px-2 py-1" /></label>
            </div>
            {request.source.type === 'sealed'
              ? <button onClick={() => sealedItem && fulfillSealed(sealedItem.id, request)} className="w-full bg-green-700 hover:bg-green-600 text-white rounded py-2 font-bold">Fulfill product request</button>
              : <button onClick={attemptSearch} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded py-2 font-bold">Search and Stop</button>}
            {request.source.type !== 'sealed' && targetCardData && marketPrice <= 0 &&
              <p className="text-xs text-amber-300">Market data is unavailable for this card. Enter the sale price manually.</p>}
            <p className="text-[10px] text-slate-500">{request.source.type === 'sealed' ? 'This product request does not use the drawer-search minigame.' : 'A miss costs the selected energy.'} Successful sales receive {Math.round((1 - DEVELOPER_SETTINGS.live.platform_fee_fraction) * 100)}% of the price after the platform fee.</p>
          </div>
        </div>
      )}
    </section>
  );
};

export const ScreenPackOpener = ({ packId, setId, productId, onComplete }: { packId: string, setId: string, productId?: string, onComplete: () => void }) => {
  const { state, setState, dictionary, availableSets } = useGame();
  const [cards, setCards] = useState<CardInstance[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRipped, setIsRipped] = useState(false);
  const [ripProgress, setRipProgress] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isRumbling, setIsRumbling] = useState(false);
  const [showCardBack, setShowCardBack] = useState(false);
  const [error, setError] = useState("");
  const [redemptionPrize, setRedemptionPrize] = useState<{ prizeType: 'card' | 'binder'; prizeId: string; tierId: string } | undefined>();

  const theme = getSetTheme(setId);
  const currentSet = availableSets.find(s => s.id.toUpperCase() === setId.toUpperCase() || s.code.toUpperCase() === setId.toUpperCase());
  const product = packProductFor(currentSet, productId);
  const setName = currentSet?.name || setId;

  useEffect(() => {
    const requiredCards = (product.slots?.reduce((sum, slot) => sum + slot.count, 0) || product.cardsPerPack || GAME_CONFIG.packConfiguration.cardsPerPack) +
      (hasCardRedemption(currentSet?.redemptions) ? 1 : 0);
    const packLocationId = state.sealed.find(item => item.id === packId)?.locationId || state.homeLocationId;
    if (availableCardCapacity(state, packLocationId) < requiredCards) {
      setError(`Not enough inventory capacity for ${requiredCards} cards. Store or sell cards, move cards to a binder, or buy eligible storage.`);
      return;
    }
    generatePack(setId, state.printRuns, productId)
      .then(res => {
        setCards(res.pack);
        setRedemptionPrize(res.redemption);
        setState(prev => ({
          ...prev, sealed: prev.sealed.filter(s => s.id !== packId),
          printRuns: { ...prev.printRuns, ...res.runUpdates }
        }));
      })
      .catch(err => setError(err.message || "Pack generation failed due to missing card definitions."));
  }, [packId, setId]);

  const handleRip = () => {
    if (!cards || cards.length === 0 || isRipped) return;
    const firstCardData = dictionary[cards[0].cardId];
    const isUltraRare = firstCardData && (firstCardData.rarity === 'Legendary' || firstCardData.rarity === 'Enchanted');
    setIsRipped(true);
    
    if (isUltraRare) {
      setShowCardBack(true); setIsRumbling(true);
      setTimeout(() => {
        setIsRumbling(false); setIsFlipping(true);
        setTimeout(() => { setShowCardBack(false); setIsFlipping(false); }, 300);
      }, 1200);
    }
  };

  const handleNext = () => {
    if (!cards || isFlipping || isRumbling) return;
    if (currentIndex < cards.length - 1) {
      const nextCardData = dictionary[cards[currentIndex + 1].cardId];
      const isUltraRare = nextCardData && (nextCardData.rarity === 'Legendary' || nextCardData.rarity === 'Enchanted');

      setIsFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        if (isUltraRare) {
          setShowCardBack(true); setIsFlipping(false); setIsRumbling(true);
          setTimeout(() => {
            setIsRumbling(false); setIsFlipping(true);
            setTimeout(() => { setShowCardBack(false); setIsFlipping(false); }, 300);
          }, 1200);
        } else { setIsFlipping(false); }
      }, 300); 
    } else {
      const packLocationId = state.sealed.find(item => item.id === packId)?.locationId || state.homeLocationId;
      if (availableCardCapacity(state, packLocationId) < cards.length) {
        setError('Your inventory filled while this pack was open. Free capacity before collecting the cards.');
        return;
      }
      setState(prev => {
        const collected = addCardsToInventory(prev, cards, packLocationId);
        if (!collected) return prev;
        const prizeBinder = redemptionPrize?.prizeType === 'binder'
          ? GAME_CONFIG.binders.designs.find(design => design.id === redemptionPrize.prizeId)
          : undefined;
        return {
          ...collected,
          binders: prizeBinder ? [...prev.binders, {
            id: crypto.randomUUID(),
            name: `${prizeBinder.name} (Redemption Prize)`,
            designId: prizeBinder.id,
            pageCount: prizeBinder.pages,
            slotsPerPage: prizeBinder.slotsPerPage,
            purchasePrice: 0,
            used: false,
            cards: [],
          }] : prev.binders,
          newsFeed: redemptionPrize
            ? [`Redemption won: ${redemptionPrize.prizeType} prize (${redemptionPrize.tierId}).`, ...prev.newsFeed].slice(0, 15)
            : prev.newsFeed,
        };
      });
      onComplete();
    }
  };

  if (error) return (
    <div className="p-8 text-center h-[70vh] flex flex-col justify-center items-center">
      <AlertTriangle size={48} className="text-red-500 mb-4" />
      <p className="text-white mb-6 font-bold">{error}</p>
      <button onClick={onComplete} className="bg-slate-700 px-6 py-2 rounded text-white">Back</button>
    </div>
  );

  if (!cards) return <div className="p-8 text-center h-full flex items-center justify-center text-slate-400">Generating pack...</div>;
  if (cards.length === 0) return (
    <div className="p-8 text-center h-[70vh] flex flex-col justify-center items-center">
      <AlertTriangle size={48} className="text-red-500 mb-4" />
      <p className="text-white mb-2 font-bold">Error: Pack generated 0 cards.</p>
      <button onClick={onComplete} className="bg-slate-700 px-6 py-2 rounded text-white font-bold">Back to Inventory</button>
    </div>
  );

  const currentCard = cards[currentIndex];
  const cardData = currentCard ? dictionary[currentCard.cardId] : null;
  const isCurrentUltraRare = cardData && (cardData.rarity === 'Legendary' || cardData.rarity === 'Enchanted');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center touch-none overflow-hidden">
      {redemptionPrize && isRipped && currentIndex === cards.length - 1 && <div className="absolute top-4 z-50 rounded bg-yellow-900/70 border border-yellow-500 p-2 text-center text-sm font-bold text-yellow-100">Redemption! {redemptionPrize.tierId} · {redemptionPrize.prizeType} prize</div>}
      {!isRipped ? (
        <div className="text-center w-full max-w-sm px-8 relative">
           <div className="absolute top-0 left-0 right-0 -mt-16 h-16 flex flex-col items-center justify-end z-20 animate-pulse">
             <div className="text-white font-bold uppercase tracking-widest text-sm mb-2 drop-shadow-lg">Slide to Rip</div>
           </div>
          <div className={`w-full aspect-[2/3] bg-gradient-to-br ${theme.bg} rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 ${theme.border} relative overflow-hidden`}>
             
             {/* Tear Strip */}
             <div className="absolute top-4 left-0 right-0 h-8 bg-black/30 border-y-2 border-dashed border-white/20 z-30 flex items-center px-2">
                <input 
                  type="range" min="0" max="100" value={ripProgress} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    setRipProgress(val);
                    if (val >= 95) handleRip();
                  }} 
                  className="w-full accent-white h-2 appearance-none bg-transparent rounded outline-none" 
                  style={{ backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.8) ${ripProgress}%, transparent ${ripProgress}%)` }}
                />
             </div>

             <div className="absolute inset-0 bg-white/10 pointer-events-none" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 10%, 0 30%)'}}></div>
             <span className={`text-6xl font-bold ${theme.text} transform drop-shadow-2xl mb-4 pointer-events-none`}>{theme.symbol}</span>
            <span className={`font-bold text-2xl drop-shadow-md tracking-widest uppercase text-center px-4 ${theme.text} pointer-events-none`}>{setName}</span>
          </div>
          <button onClick={onComplete} className="text-slate-500 hover:text-white mt-8 px-6 py-2">Cancel</button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full p-4" onClick={handleNext}>
          <div className="text-slate-400 text-sm mb-6 font-mono tracking-widest">CARD {currentIndex + 1} OF {cards.length}</div>
          <div className="relative w-72 h-[26rem] perspective-1000">
            <div className={`w-full h-full relative transition-all duration-300 transform-style-3d ${isRumbling ? 'animate-rumble' : ''}`} style={{ transform: isFlipping ? 'rotateY(90deg) scale(0.9)' : 'rotateY(0deg) scale(1)' }}>
              {showCardBack ? (
                <div className="absolute inset-0 bg-blue-900 rounded-2xl border-4 border-slate-700 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-700 to-blue-950 shadow-inner">
                  <div className="w-20 h-20 rounded-full border-4 border-yellow-500/50 flex items-center justify-center"><div className="w-14 h-14 bg-yellow-500/20 rounded-full animate-pulse"></div></div>
                  <div className="text-blue-300/50 font-bold tracking-widest mt-6 uppercase text-lg">TCG</div>
                </div>
              ) : cardData ? (
                <div className={`absolute inset-0 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 ${currentCard.isFoil ? 'border-yellow-400' : 'border-slate-800'} bg-slate-800 flex items-center justify-center relative`}>
                  {currentCard.isFoil && <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/40 to-transparent animate-shimmer mix-blend-overlay"></div>}
                  {isCurrentUltraRare && !isFlipping && (
                    <div className="absolute -inset-8 pointer-events-none z-50 overflow-visible">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div key={i} className="absolute rounded-full bg-white" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, width: `${Math.random() * 4 + 2}px`, height: `${Math.random() * 4 + 2}px`, boxShadow: '0 0 10px 2px rgba(255, 255, 255, 0.9), 0 0 15px 5px rgba(236, 72, 153, 0.8)', animation: `sparkle ${Math.random() * 1 + 1}s infinite`, animationDelay: `${Math.random() * 2}s` }} />
                      ))}
                    </div>
                  )}
                  {cardData.imageUrl ? <img src={cardData.imageUrl} alt={cardData.name} className="w-full h-full object-contain bg-slate-900" /> : <div className="p-4 text-center"><div className="text-white font-bold text-xl">{cardData.name}</div><div className="text-slate-400 mt-2">{cardData.rarity}</div></div>}
                </div>
              ) : <div className="absolute inset-0 bg-slate-800 rounded-2xl border-4 border-slate-700 animate-pulse"></div>}
            </div>
          </div>
          <div className="mt-8 text-center min-h-[4rem]">
            {cardData && (
              <div className="animate-in slide-in-from-bottom-2 fade-in">
                <div className="text-white font-bold text-xl">{cardData.name}</div>
                <div className="flex items-center justify-center space-x-2 mt-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${cardData.rarity === 'Legendary' ? 'bg-yellow-500/20 text-yellow-400' : cardData.rarity === 'Enchanted' ? 'bg-fuchsia-500/20 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'bg-slate-800 text-slate-300'}`}>{cardData.rarity}</span>
                  {currentCard?.isFoil && <span className="text-xs bg-gradient-to-r from-yellow-300 to-yellow-600 text-yellow-900 px-3 py-1 rounded-full font-bold tracking-wider">FOIL</span>}
                </div>
              </div>
            )}
          </div>
          <div className="absolute bottom-8 text-slate-500 animate-pulse font-bold tracking-widest uppercase text-sm">{currentIndex < cards.length - 1 ? 'Tap to reveal next' : 'Tap to finish'}</div>
        </div>
      )}
    </div>
  );
};
