import React, { useState } from 'react';
import { GAME_CONFIG, getSetTheme } from '../game/config';
import { useGame } from '../game/state';
import { productsForSet } from '../game/products';
import { DEVELOPER_SETTINGS } from '../game/config';
import { MINUTES_PER_GAME_DAY } from '../game/time';
import { districtDistanceInHops } from '../game/world';
import { Archive, Box, ShoppingCart, HeartHandshake, TrendingUp, TrendingDown, Plane, Award, Zap, Coffee } from 'lucide-react';

export const ScreenCity = () => {
  const { state, setState, availableSets, consumeEnergy, advanceTime } = useGame();
  const [activeStore, setActiveStore] = useState<string | null>(null);
  const [deliveryService, setDeliveryService] = useState<'normal' | 'expedited'>('normal');
  const [deliveryLocationId, setDeliveryLocationId] = useState(state.homeLocationId);

  const handleVisitStore = (storeId: string) => {
    if (consumeEnergy(GAME_CONFIG.energy.costs.visitStore)) {
      setState(prev => ({ ...prev, currentLocationId: storeId }));
      setActiveStore(storeId);
    }
  };

  const currentDistrict = GAME_CONFIG.worldMap.districts.find(district => district.id === state.currentDistrictId);
  const travelToDistrict = (districtId: string) => {
    if (state.liveState.active) {
      alert('End the active Live Sale before travelling.');
      return;
    }
    const target = GAME_CONFIG.worldMap.districts.find(district => district.id === districtId);
    if (!target || !currentDistrict || target.id === currentDistrict.id) return;
    if (!state.unlockedCities.includes(target.cityId)) {
      alert('This city is still locked.');
      return;
    }
    const cityTravel = target.cityId !== currentDistrict.cityId;
    const targetCity = GAME_CONFIG.worldMap.cities.find(city => city.id === target.cityId);
    const hops = cityTravel
      ? targetCity?.travelHops || 3
      : Math.abs(target.x - currentDistrict.x) + Math.abs(target.y - currentDistrict.y);
    if (!cityTravel && hops !== 1) {
      alert('Travel one district at a time along a connected grid.');
      return;
    }
    const fee = DEVELOPER_SETTINGS.world.district_travel_fee_per_hop * hops;
    if (state.currency < fee) {
      alert(`Travel costs $${fee.toFixed(2)}. You do not have enough funds.`);
      return;
    }
    const energyCost = DEVELOPER_SETTINGS.energy.adjacent_district_visit * (cityTravel ? hops : 1);
    const travelMinutes = hops > DEVELOPER_SETTINGS.world.full_day_round_trip_after_hops
      ? MINUTES_PER_GAME_DAY
      : DEVELOPER_SETTINGS.time.travel_minutes_per_hop * hops;
    if (consumeEnergy(energyCost, travelMinutes)) {
      setState(prev => ({
        ...prev,
        currency: prev.currency - fee,
        currentDistrictId: target.id,
        currentLocationId: target.id === 'home' ? state.homeLocationId : target.id,
      }));
    }
  };

  const enterOwnedLocation = (locationId: string) => {
    if (!currentDistrict || !state.ownedLocations.includes(locationId)) return;
    const property = state.properties.find(item => item.id === locationId);
    const locationDistrictId = property?.districtId || (locationId === state.homeLocationId ? 'home' : '');
    if (locationDistrictId !== currentDistrict.id) return;
    if (consumeEnergy(DEVELOPER_SETTINGS.energy.local_visit)) {
      setState(prev => ({ ...prev, currentLocationId: locationId }));
    }
  };

  const exploreDistrict = () => {
    if (!currentDistrict || state.exploredDistricts.includes(currentDistrict.id)) return;
    if (!consumeEnergy(DEVELOPER_SETTINGS.world.exploration_energy, DEVELOPER_SETTINGS.time.exploration_minutes)) return;
    const districtLocations = Object.values(GAME_CONFIG.locations)
      .filter(location => location.districtId === currentDistrict.id)
      .map(location => location.id);
    const nextExploredCount = state.exploredDistricts.length + 1;
    const newlyUnlocked = GAME_CONFIG.worldMap.cities
      .filter(city => city.unlockExplorations !== undefined && nextExploredCount >= city.unlockExplorations)
      .map(city => city.id);
    setState(prev => ({
      ...prev,
      exploredDistricts: [...new Set([...prev.exploredDistricts, currentDistrict.id])],
      exploredLocations: [...new Set([...prev.exploredLocations, ...districtLocations])],
      unlockedCities: [...new Set([...prev.unlockedCities, ...newlyUnlocked])],
    }));
  };

  const orderOnline = (vendorId: string, setId: string, productId: string) => {
    const vendor = GAME_CONFIG.onlineVendors.find(item => item.id === vendorId);
    const set = availableSets.find(item => item.id === setId);
    const product = productsForSet(set).find(item => item.id === productId);
    const destinationDistrictId = deliveryLocationId === 'bedroom'
      ? 'home'
      : state.properties.find(property => property.id === deliveryLocationId)?.districtId || deliveryLocationId;
    const destinationDistrict = GAME_CONFIG.worldMap.districts.find(item => item.id === destinationDistrictId);
    const warehouseDistrict = vendor && GAME_CONFIG.worldMap.districts.find(item => item.id === vendor.warehouseDistrictId);
    if (!vendor || !set || !product || !destinationDistrict || !warehouseDistrict) return;
    const runSize = set.runSize || product.runSize || 0;
    const stockKey = `${vendorId}:${setId}:${productId}`;
    const stock = Math.max(0, runSize - (state.vendorOrders[stockKey] || 0));
    if (stock < 1) {
      alert('This online vendor has no remaining stock for this product run.');
      return;
    }
    const committedAtDestination = state.sealed.filter(item => item.locationId === deliveryLocationId).length +
      state.shipments.filter(shipment => shipment.destinationLocationId === deliveryLocationId && shipment.status !== 'delivered')
        .reduce((sum, shipment) => sum + shipment.items.reduce((itemCount, item) => itemCount + item.quantity, 0), 0);
    if (committedAtDestination >= DEVELOPER_SETTINGS.storage.sealed_products_per_location) {
      alert('The selected delivery location has no free sealed-product capacity.');
      return;
    }
    const hops = districtDistanceInHops(warehouseDistrict.id, destinationDistrict.id);
    if (hops === null) return;
    const serviceMultiplier = deliveryService === 'expedited' ? DEVELOPER_SETTINGS.shipping.expedited_fee_multiplier : 1;
    const shippingFee = hops * DEVELOPER_SETTINGS.shipping.fee_per_hop * serviceMultiplier;
    const itemPrice = product.price ?? GAME_CONFIG.economy.retailPrices[product.type];
    const totalPrice = itemPrice + shippingFee;
    if (state.currency < totalPrice) {
      alert(`This order costs $${totalPrice.toFixed(2)} including shipping.`);
      return;
    }
    const deliveryDays = deliveryService === 'expedited'
      ? DEVELOPER_SETTINGS.shipping.expedited_delivery_days
      : DEVELOPER_SETTINGS.shipping.normal_delivery_days;
    const arrivalTime = state.clockMinutes + deliveryDays * MINUTES_PER_GAME_DAY;
    setState(prev => ({
      ...prev,
      currency: prev.currency - totalPrice,
      vendorOrders: { ...prev.vendorOrders, [stockKey]: (prev.vendorOrders[stockKey] || 0) + 1 },
      shipments: [...prev.shipments, {
        id: crypto.randomUUID(),
        vendorId,
        destinationLocationId: deliveryLocationId,
        arrivalTime,
        items: [{ type: product.type, setId, productId, quantity: 1 }],
        status: 'in-transit',
      }],
      newsFeed: [`Ordered ${product.name} from ${vendor.name}; arrival on Day ${Math.floor(arrivalTime / MINUTES_PER_GAME_DAY) + 1}.`, ...prev.newsFeed].slice(0, 15),
    }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
  };

  const buyProperty = (type: 'garage' | 'shop' | 'warehouse') => {
    if (!currentDistrict) return;
    const definition = GAME_CONFIG.propertyDefs[type];
    if (state.currency < definition.purchaseCost) {
      alert(`A ${definition.name} costs $${definition.purchaseCost.toFixed(2)}.`);
      return;
    }
    const property = { id: `${type}-${crypto.randomUUID()}`, type, districtId: currentDistrict.id };
    setState(prev => ({
      ...prev,
      currency: prev.currency - definition.purchaseCost,
      properties: [...prev.properties, property],
      ownedLocations: [...prev.ownedLocations, property.id],
      currentLocationId: property.id,
      newsFeed: [`Purchased a ${definition.name} in ${currentDistrict.name}.`, ...prev.newsFeed].slice(0, 15),
    }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
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

  const buy = (storeId: string, item: 'pack' | 'box', setId: string, productId?: string) => {
    const set = availableSets.find(candidate => candidate.id === setId);
    const product = productsForSet(set).find(candidate => candidate.id === productId);
    const basePrice = product?.price ?? GAME_CONFIG.economy.retailPrices[item];
    const price = calcPrice(storeId, basePrice, setId);
    const storeDef = (GAME_CONFIG.locations as any)[storeId];

    if (state.currency < price) return alert("Not enough funds!");
    const inventoryLocationId = state.ownedLocations.includes(state.currentLocationId) ? state.currentLocationId : state.homeLocationId;
    const reservedProducts = state.shipments.filter(shipment => shipment.destinationLocationId === inventoryLocationId && shipment.status !== 'delivered')
      .reduce((sum, shipment) => sum + shipment.items.reduce((count, shipmentItem) => count + shipmentItem.quantity, 0), 0);
    if (state.sealed.filter(productItem => productItem.locationId === inventoryLocationId).length + reservedProducts >= DEVELOPER_SETTINGS.storage.sealed_products_per_location) {
      alert('Your inventory location has no free sealed-product capacity.');
      return;
    }
    
    setState(prev => {
      const newState = { ...prev };
      if (storeDef.type === 'lgs') {
        const stockKey = setId;
        const currentStock = newState.lgsStock[storeId]?.[stockKey] || 0;
        const boxProduct = productsForSet(set).find(candidate => candidate.type === 'box');
        const boxesNeeded = item === 'box' ? 1 : (1 / (boxProduct?.packsPerBox || GAME_CONFIG.packConfiguration.packsPerBox));
        if (currentStock < boxesNeeded) {
          alert("This store is out of stock for this item!");
          return prev;
        }
        newState.lgsStock = { ...newState.lgsStock };
        newState.lgsStock[storeId] = { ...newState.lgsStock[storeId] };
        newState.lgsStock[storeId][stockKey] = currentStock - boxesNeeded;
      }
      newState.currency -= price;
      newState.sealed = [...newState.sealed, { id: crypto.randomUUID(), type: item, setId, productId, locationId: inventoryLocationId }];
      return newState;
    });
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
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
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
  };

  const handleDisneyTrip = () => {
    const fee = GAME_CONFIG.locations['resort-disney'].entryFee || 0;
    const destination = GAME_CONFIG.worldMap.districts.find(district => district.id === GAME_CONFIG.locations['resort-disney'].districtId);
    const hops = destination ? districtDistanceInHops(state.currentDistrictId, destination.id) : null;
    if (hops === null) return alert('The resort travel route is not configured.');
    if (state.currency < fee) return alert(`You need $${fee.toFixed(2)} for the resort trip.`);
    if (!window.confirm(`Pay $${fee.toFixed(2)} for travel expenses to visit the Disney Resort?`)) return;
    const travelMinutes = hops > DEVELOPER_SETTINGS.world.full_day_round_trip_after_hops
      ? MINUTES_PER_GAME_DAY
      : hops * DEVELOPER_SETTINGS.time.travel_minutes_per_hop;
    if (consumeEnergy(GAME_CONFIG.energy.costs.disneyTrip, travelMinutes)) {
      setState(prev => ({ ...prev, currency: prev.currency - fee, currentDistrictId: destination.id, currentLocationId: 'resort-disney' }));
      setActiveStore('resort-disney');
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
                    
                    {productsForSet(set).map(product => {
                      const itemType = product.type;
                      const price = calcPrice(store.id, product.price ?? GAME_CONFIG.economy.retailPrices[itemType], set.id);
                      const quantity = itemType === 'pack'
                        ? `${product.cardsPerPack || GAME_CONFIG.packConfiguration.cardsPerPack} cards`
                        : `${product.packsPerBox || GAME_CONFIG.packConfiguration.packsPerBox} packs`;
                      return (
                        <div key={product.id} className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-16 bg-gradient-to-br ${theme.bg} rounded flex items-center justify-center border ${theme.border} overflow-hidden`}>
                              {product.imageUrl
                                ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                                : <span className={`font-bold ${theme.text}`}>{itemType === 'pack' ? theme.symbol : 'BOX'}</span>}
                            </div>
                            <div><div className="text-slate-200 font-medium">{product.name}</div><div className="text-slate-400 text-sm">{quantity}</div></div>
                          </div>
                          <button
                            onClick={() => buy(store.id, itemType, set.id, product.id)}
                            disabled={state.currency < price || stock === 0}
                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors"
                          >
                            ${price.toFixed(2)}
                          </button>
                        </div>
                      );
                    })}
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
      <h2 className="text-xl font-bold text-white">World Map</h2>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex justify-between items-center mb-4">
          <div><h3 className="font-bold text-white">{currentDistrict?.name || 'Unknown District'}</h3><p className="text-xs text-slate-400">Travel one grid hop at a time; explore a district to reveal its destinations.</p></div>
          {currentDistrict && !state.exploredDistricts.includes(currentDistrict.id) && <button onClick={exploreDistrict} className="bg-green-700 text-white text-xs font-bold px-3 py-2 rounded">Explore · {DEVELOPER_SETTINGS.world.exploration_energy} energy</button>}
        </div>
        <div className="grid grid-cols-3 grid-rows-3 gap-2">
          {GAME_CONFIG.worldMap.districts.filter(district => district.cityId === currentDistrict?.cityId).map(district => {
            const isCurrent = district.id === state.currentDistrictId;
            const explored = state.exploredDistricts.includes(district.id);
            const hops = currentDistrict ? Math.abs(district.x - currentDistrict.x) + Math.abs(district.y - currentDistrict.y) : 0;
            return (
              <button key={district.id} style={{ gridColumn: district.x + 2, gridRow: 2 - district.y }} onClick={() => travelToDistrict(district.id)} className={`min-h-20 rounded border p-2 text-left ${isCurrent ? 'bg-blue-900 border-blue-500' : explored ? 'bg-slate-900 border-slate-600' : 'bg-slate-950 border-dashed border-slate-700'}`}>
                <span className="block text-xs font-bold text-white">{district.name}</span>
                <span className="text-[10px] text-slate-400">{isCurrent ? 'Current' : explored ? 'Explored' : 'Unexplored'}</span>
                {!isCurrent && <span className="block text-[10px] text-yellow-400">{hops} hop{hops === 1 ? '' : 's'} · ${DEVELOPER_SETTINGS.world.district_travel_fee_per_hop * hops}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <div className="text-xs font-bold text-slate-300 mb-2">Travel between unlocked cities</div>
          <div className="flex flex-wrap gap-2">
            {state.unlockedCities.filter(cityId => cityId !== currentDistrict?.cityId).map(cityId => {
              const destination = GAME_CONFIG.worldMap.districts.find(district => district.cityId === cityId);
              const city = GAME_CONFIG.worldMap.cities.find(item => item.id === cityId);
              return destination && city ? <button key={cityId} onClick={() => travelToDistrict(destination.id)} className="bg-slate-700 text-white text-xs rounded px-3 py-2">{city.name} · ${DEVELOPER_SETTINGS.world.district_travel_fee_per_hop * (city.travelHops || 3)}</button> : null;
            })}
          </div>
        </div>
      </div>
      {currentDistrict && state.exploredDistricts.includes(currentDistrict.id) && (
        <div className="space-y-3">
          <h3 className="font-bold text-white">Your Locations</h3>
          {state.ownedLocations.filter(locationId => {
            const property = state.properties.find(item => item.id === locationId);
            return (property?.districtId || (locationId === state.homeLocationId ? 'home' : '')) === currentDistrict.id;
          }).map(locationId => {
            const property = state.properties.find(item => item.id === locationId);
            const label = property ? `${GAME_CONFIG.propertyDefs[property.type].name} · ${currentDistrict.name}` : 'Bedroom';
            return (
              <button key={locationId} disabled={state.currentLocationId === locationId} onClick={() => enterOwnedLocation(locationId)} className="w-full bg-slate-900 rounded-lg border border-slate-700 p-3 text-left text-sm text-slate-200 disabled:opacity-50">
                Enter {label} · {DEVELOPER_SETTINGS.energy.local_visit} energy
              </button>
            );
          })}
          <h3 className="font-bold text-white">Destinations in {currentDistrict.name}</h3>
          {Object.values(GAME_CONFIG.locations).filter(location => location.districtId === currentDistrict.id).map((loc: any) => {
            const isDisney = loc.type === 'resort';
            const isLocked = loc.type === 'bigbox' && state.day < loc.unlockDay;
            const tier = getAffiliateTier(loc.id);
            const isDiscovered = state.exploredLocations.includes(loc.id);
            return (
              <button key={loc.id} disabled={!isDiscovered || isLocked} onClick={() => isDisney ? handleDisneyTrip() : handleVisitStore(loc.id)} className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 shadow flex items-center text-left disabled:opacity-40">
                {loc.type === 'lgs' ? <HeartHandshake className="mr-4 text-blue-400" /> : <ShoppingCart className="mr-4 text-slate-300" />}
                <span className="flex-1"><span className="block font-bold text-white">{loc.name}</span><span className="text-xs text-slate-400">{isLocked ? `Unlocks Day ${loc.unlockDay}` : tier ? `${tier.name} status` : isDiscovered ? loc.type : 'Explore this district to discover it'}</span></span>
                <span className="text-yellow-400 text-xs">-{GAME_CONFIG.energy.costs.visitStore} energy</span>
              </button>
            );
          })}
          {Object.values(GAME_CONFIG.locations).filter(location => location.districtId === currentDistrict.id).length === 0 && <p className="text-xs text-slate-500">No shops are currently mapped to this district.</p>}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="font-bold text-white mb-2">Properties</h3>
            <p className="text-xs text-slate-400 mb-3">Buy a property for local storage. Daily operating costs are charged as in-game days advance.</p>
            <div className="flex flex-wrap gap-2">
              {(currentDistrict.availableProperties as readonly ('garage' | 'shop' | 'warehouse')[]).map(type => {
                const definition = GAME_CONFIG.propertyDefs[type];
                return (
                  <button key={type} disabled={state.currency < definition.purchaseCost} onClick={() => buyProperty(type)} className="bg-blue-700 text-white disabled:opacity-40 rounded px-3 py-2 text-xs">
                    {definition.name} · ${definition.purchaseCost}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h3 className="font-bold text-white mb-2">Locked Cities</h3>
        {GAME_CONFIG.worldMap.cities.filter(city => !state.unlockedCities.includes(city.id)).map(city => (
          <div key={city.id} className="text-xs text-slate-400 py-1">{city.name} · Explore {city.unlockExplorations} districts</div>
        ))}
      </div>
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
        <h3 className="font-bold text-white">Online Vendors</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-300">Ship to
            <select value={deliveryLocationId} onChange={event => setDeliveryLocationId(event.target.value)} className="block w-full bg-slate-900 rounded p-2 mt-1">
              {state.ownedLocations.map(locationId => <option key={locationId} value={locationId}>{locationId}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-300">Shipping
            <select value={deliveryService} onChange={event => setDeliveryService(event.target.value as 'normal' | 'expedited')} className="block w-full bg-slate-900 rounded p-2 mt-1">
              <option value="normal">Normal · {DEVELOPER_SETTINGS.shipping.normal_delivery_days} days</option>
              <option value="expedited">Expedited · {DEVELOPER_SETTINGS.shipping.expedited_delivery_days} day(s)</option>
            </select>
          </label>
        </div>
        {GAME_CONFIG.onlineVendors.map(vendor => (
          <div key={vendor.id} className="bg-slate-900 rounded-lg border border-slate-700 p-3">
            <div className="font-bold text-white mb-2">{vendor.name} <span className="text-[10px] text-slate-500 font-normal">Warehouse: {vendor.warehouseDistrictId}</span></div>
            <div className="space-y-2">
              {availableSets.flatMap(set => productsForSet(set).map(product => {
                const runSize = set.runSize || product.runSize || 0;
                const key = `${vendor.id}:${set.id}:${product.id}`;
                const stock = Math.max(0, runSize - (state.vendorOrders[key] || 0));
                const destinationDistrict = deliveryLocationId === 'bedroom'
                  ? 'home'
                  : state.properties.find(property => property.id === deliveryLocationId)?.districtId || deliveryLocationId;
                const destination = GAME_CONFIG.worldMap.districts.find(district => district.id === destinationDistrict);
                const warehouse = GAME_CONFIG.worldMap.districts.find(district => district.id === vendor.warehouseDistrictId);
                const hops = destination && warehouse ? districtDistanceInHops(warehouse.id, destination.id) || 0 : 0;
                const shippingFee = hops * DEVELOPER_SETTINGS.shipping.fee_per_hop *
                  (deliveryService === 'expedited' ? DEVELOPER_SETTINGS.shipping.expedited_fee_multiplier : 1);
                const price = (product.price ?? GAME_CONFIG.economy.retailPrices[product.type]) + shippingFee;
                if (stock === 0) return null;
                return (
                  <div key={`${set.id}:${product.id}`} className="flex justify-between items-center gap-2 text-xs bg-slate-800 rounded p-2">
                    <span className="min-w-0 truncate text-slate-200 flex items-center gap-2">
                      {product.imageUrl && <img src={product.imageUrl} alt="" className="w-8 h-10 object-contain rounded" />}
                      <span className="truncate">{set.name} · {product.name}<span className="block text-[10px] text-slate-500">{stock} remaining · shipping ${shippingFee.toFixed(2)}</span></span>
                    </span>
                    <button disabled={state.currency < price} onClick={() => orderOnline(vendor.id, set.id, product.id)} className="bg-blue-700 text-white disabled:opacity-40 rounded px-2 py-1">${price.toFixed(2)}</button>
                  </div>
                );
              }))}
            </div>
          </div>
        ))}
        {!availableSets.some(set => (set.runSize || 0) > 0 || (set.products || []).some(product => (product.runSize || 0) > 0)) && (
          <p className="text-xs text-slate-500">No online stock is configured. Import a set package with a runSize to enable vendor orders.</p>
        )}
      </section>
    </div>
  );
};
