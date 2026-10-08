import React, { useState } from 'react';
import { GAME_CONFIG, getSetTheme } from '../game/config';
import { useGame } from '../game/state';
import { Archive, Box, ShoppingCart, HeartHandshake, TrendingUp, TrendingDown, Plane, Award, Zap, Coffee } from 'lucide-react';

export const ScreenCity = () => {
  const { state, setState, availableSets, consumeEnergy } = useGame();
  const [activeStore, setActiveStore] = useState<string | null>(null);

  const handleVisitStore = (storeId: string) => {
    if (consumeEnergy(GAME_CONFIG.energy.costs.visitStore)) {
      setActiveStore(storeId);
    }
  };

  const getAffiliateTier = (storeId: string) => {
    const storeDef = (GAME_CONFIG.locations as any)[storeId];
    if (!storeDef || storeDef.type !== 'lgs') return null;
    const rep = state.reputation[storeId] || 0;
    const tiers = [...storeDef.affiliateTiers].reverse();
    return tiers.find(t => rep >= t.rep) || tiers[tiers.length - 1];
  };

  const calcPrice = (storeId: string, basePrice: number, setId: string) => {
    const storeDef = (GAME_CONFIG.locations as any)[storeId];
    const marketMod = state.marketModifiers[setId] || 1.0;
    if (storeDef.type === 'bigbox' || storeDef.type === 'resort') return basePrice;
    const isEarlyAccess = state.day <= 8; 
    const markup = isEarlyAccess ? (1 + storeDef.baseMarkup) : 1.0;
    const tier = getAffiliateTier(storeId);
    const discount = tier ? (1 - tier.discount) : 1.0;
    return basePrice * markup * marketMod * discount;
  };

  const buy = (storeId: string, item: 'pack' | 'box', setId: string) => {
    const basePrice = GAME_CONFIG.economy.retailPrices[item];
    const price = calcPrice(storeId, basePrice, setId);
    const storeDef = (GAME_CONFIG.locations as any)[storeId];

    if (state.currency < price) return alert("Not enough funds!");
    
    setState(prev => {
      const newState = { ...prev };
      if (storeDef.type === 'lgs') {
        const stockKey = setId;
        const currentStock = newState.lgsStock[storeId]?.[stockKey] || 0;
        const boxesNeeded = item === 'box' ? 1 : (1 / 24); 
        if (currentStock < boxesNeeded) {
          alert("This store is out of stock for this item!");
          return prev;
        }
        newState.lgsStock = { ...newState.lgsStock };
        newState.lgsStock[storeId] = { ...newState.lgsStock[storeId] };
        newState.lgsStock[storeId][stockKey] = currentStock - boxesNeeded;
      }
      newState.currency -= price;
      newState.sealed = [...newState.sealed, { id: crypto.randomUUID(), type: item, setId }];
      return newState;
    });
  };

  const buyEnergyDrink = (storeId: string) => {
    const price = GAME_CONFIG.energy.supplies.energyDrink.price;
    if (state.currency < price) return alert("Not enough funds!");
    
    setState(prev => {
      const newState = { ...prev };
      newState.currency -= price;
      newState.energyDrinks += 1;
      
      const storeDef = (GAME_CONFIG.locations as any)[storeId];
      if (storeDef.type === 'lgs') {
         newState.reputation = { ...newState.reputation, [storeId]: (newState.reputation[storeId] || 0) + GAME_CONFIG.energy.supplies.energyDrink.repGain };
      }
      return newState;
    });
  };

  const handleDisneyTrip = () => {
    if (state.currency < 1000) return alert("You don't have enough money for the trip!");
    if (consumeEnergy(GAME_CONFIG.energy.costs.disneyTrip)) {
      if (window.confirm("Pay $1,000 for travel expenses to visit the Disney Resort?")) {
        setState(prev => ({ ...prev, currency: prev.currency - 1000 }));
        setActiveStore('resort-disney');
      }
    }
  };

  if (activeStore) {
    const store = (GAME_CONFIG.locations as any)[activeStore];
    const isLocked = store.type === 'bigbox' && state.day < store.unlockDay;
    const tier = getAffiliateTier(store.id);

    return (
      <div className="p-4 pb-24 animate-in fade-in slide-in-from-right-4">
        <button onClick={() => setActiveStore(null)} className="mb-4 text-blue-400 font-bold flex items-center">
          ← Back to City Map
        </button>
        
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            {store.type === 'resort' && <Plane className="mr-2 text-fuchsia-400"/>}
            {store.name}
          </h2>
          <div className="text-sm text-slate-400 mt-1 capitalize">{store.type === 'lgs' ? 'Local Game Store' : store.type}</div>
          
          {tier && (
            <div className="mt-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Affiliate Status</div>
                <div className="text-blue-300 font-bold flex items-center mt-1">
                  <Award size={16} className="mr-1"/> {tier.name} Level
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-bold text-lg">{tier.discount * 100}% OFF</div>
                <div className="text-xs text-slate-500">{state.reputation[store.id] || 0} Rep Points</div>
              </div>
            </div>
          )}
        </div>

        {isLocked ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
            <Archive size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold text-slate-400">Store Not Stocked Yet</p>
            <p className="text-sm mt-1">Big Box stores receive their inventory on Day {store.unlockDay}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-lg">
               <div className="bg-slate-700 p-3 text-white font-bold border-b border-slate-600">Supplies</div>
               <div className="p-4">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-16 bg-yellow-900/50 rounded flex items-center justify-center border border-yellow-700/50">
                          <Coffee size={24} className="text-yellow-500" />
                        </div>
                        <div>
                          <div className="text-slate-200 font-medium">Energy Drink</div>
                          <div className="text-slate-400 text-sm">Restores {GAME_CONFIG.energy.supplies.energyDrink.restores} Energy</div>
                          {store.type === 'lgs' && <div className="text-xs text-blue-400 mt-1">+{GAME_CONFIG.energy.supplies.energyDrink.repGain} Rep</div>}
                        </div>
                      </div>
                      <button 
                        onClick={() => buyEnergyDrink(store.id)}
                        disabled={state.currency < GAME_CONFIG.energy.supplies.energyDrink.price}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors"
                      >
                        ${GAME_CONFIG.energy.supplies.energyDrink.price.toFixed(2)}
                      </button>
                    </div>
               </div>
            </div>

            {availableSets.map(set => {
              const packPrice = calcPrice(store.id, GAME_CONFIG.economy.retailPrices.pack, set.id);
              const boxPrice = calcPrice(store.id, GAME_CONFIG.economy.retailPrices.box, set.id);
              const stock = store.type === 'lgs' ? Math.floor(state.lgsStock[store.id]?.[set.id] || 0) : null;
              const marketMod = state.marketModifiers[set.id] || 1.0;
              const theme = getSetTheme(set.id);

              if (store.type === 'lgs' && stock === 0 && (!GAME_CONFIG.locations['lgs-wolf'].allocationCases || !state.lgsStock[store.id]?.[set.id])) return null;

              return (
                <div key={set.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-lg">
                  <div className="bg-slate-700 p-3 text-white font-bold border-b border-slate-600 flex justify-between items-center">
                    <span>{set.name}</span>
                    {marketMod !== 1.0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center ${marketMod > 1 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                        {marketMod > 1 ? <TrendingUp size={12} className="mr-1"/> : <TrendingDown size={12} className="mr-1"/>}
                        Market Shift
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    {store.type === 'lgs' && (
                       <div className="text-xs font-mono text-slate-400 text-right mb-2">Boxes in stock: {stock ?? 'Unlimited'}</div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                         <div className={`w-12 h-16 bg-gradient-to-br ${theme.bg} rounded flex flex-col items-center justify-center border ${theme.border} shadow-inner relative overflow-hidden`}>
                           <div className="absolute inset-0 bg-white/10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 15%, 0 25%)'}}></div>
                           <span className={`text-lg font-bold ${theme.text} transform drop-shadow-md`}>{theme.symbol}</span>
                           <span className={`text-[6px] font-bold ${theme.text} uppercase transform -rotate-12 drop-shadow-md tracking-wider text-center px-1 leading-tight mt-1`}>{set.name.split(' ').slice(0, 2).join('\n')}</span>
                         </div>
                        <div>
                          <div className="text-slate-200 font-medium">Booster Pack</div>
                          <div className="text-slate-400 text-sm">12 Cards</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => buy(store.id, 'pack', set.id)}
                        disabled={state.currency < packPrice || stock === 0}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors"
                      >
                        ${packPrice.toFixed(2)}
                      </button>
                    </div>

                    <div className="h-px w-full bg-slate-700"></div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-16 h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded flex items-center justify-center border border-slate-500 shadow-inner relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${theme.bg}`}></div>
                          <span className={`text-sm opacity-50 absolute right-1 ${theme.text}`}>{theme.symbol}</span>
                          <span className="text-[10px] text-slate-300 font-bold ml-2">BOX</span>
                        </div>
                        <div>
                          <div className="text-slate-200 font-medium">Booster Box</div>
                          <div className="text-slate-400 text-sm">24 Packs</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => buy(store.id, 'box', set.id)}
                        disabled={state.currency < boxPrice || stock === 0}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors"
                      >
                        ${boxPrice.toFixed(2)}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-white mb-4">City Map</h2>
      
      <div className="space-y-4">
        {Object.values(GAME_CONFIG.locations).map((loc: any) => {
          const isDisney = loc.type === 'resort';
          const isLocked = loc.type === 'bigbox' && state.day < loc.unlockDay;
          const tier = getAffiliateTier(loc.id);
          const energyCost = isDisney ? GAME_CONFIG.energy.costs.disneyTrip : GAME_CONFIG.energy.costs.visitStore;

          return (
            <div 
              key={loc.id} 
              onClick={() => isDisney ? handleDisneyTrip() : handleVisitStore(loc.id)}
              className={`bg-slate-800 rounded-xl p-4 border ${isDisney ? 'border-fuchsia-500/50' : 'border-slate-700'} shadow-lg cursor-pointer hover:bg-slate-700 transition-colors flex items-center relative overflow-hidden`}
            >
              {isLocked && <div className="absolute inset-0 bg-slate-900/80 z-10 flex flex-col items-center justify-center backdrop-blur-sm cursor-not-allowed">
                 <Archive size={24} className="text-slate-500 mb-1"/>
                 <span className="text-xs font-bold text-slate-400 uppercase">Unlocks Day {loc.unlockDay}</span>
              </div>}
              
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mr-4 ${isDisney ? 'bg-fuchsia-900/50 text-fuchsia-400' : loc.type === 'lgs' ? 'bg-blue-900/50 text-blue-400' : 'bg-slate-700 text-slate-300'}`}>
                {isDisney ? <Plane size={24} /> : loc.type === 'lgs' ? <HeartHandshake size={24} /> : <ShoppingCart size={24} />}
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">{loc.name}</h3>
                <div className="text-xs text-slate-400 capitalize flex items-center">
                  {loc.type === 'lgs' ? 'Local Game Store' : loc.type}
                  {tier && <span className="ml-2 text-blue-400">• {tier.name}</span>}
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                {isDisney && <div className="text-fuchsia-400 font-bold">$1000</div>}
                <div className="flex items-center text-xs text-yellow-500 font-bold bg-yellow-900/30 px-2 py-0.5 rounded-full mt-1">
                   <Zap size={10} className="mr-1"/> -{energyCost}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
