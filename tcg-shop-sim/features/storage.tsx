import React, { useState } from 'react';
import { DEVELOPER_SETTINGS, GAME_CONFIG } from '../game/config';
import { useGame } from '../game/state';

export const ScreenStorage = () => {
  const { state, setState, advanceTime } = useGame();
  const currentOwnedLocationId = state.ownedLocations.includes(state.currentLocationId)
    ? state.currentLocationId
    : '';
  const [viewLocationId, setViewLocationId] = useState(currentOwnedLocationId || state.homeLocationId);
  const buyContainer = (typeId: string) => {
    const def = GAME_CONFIG.storageDefs[typeId as keyof typeof GAME_CONFIG.storageDefs];
    if (!def || state.currency < def.price) return;
    if (!currentOwnedLocationId) {
      alert('Travel to one of your owned locations before buying a storage container.');
      return;
    }
    const locationUnits = state.storage.filter(unit => unit.locationId === state.currentLocationId);
    if (locationUnits.length >= DEVELOPER_SETTINGS.storage.maximum_containers_per_location) return;
    const id = `storage-${crypto.randomUUID()}`;
    const container = {
      id,
      typeId,
      locationId: currentOwnedLocationId,
      slots: Array.from({ length: def.slots }, (_, index) => ({ id: `${id}-drawer-${index + 1}`, cards: [] })),
    };
    setState(prev => ({
      ...prev,
      currency: prev.currency - def.price,
      storage: [...prev.storage, container],
      selectedStorageId: id,
    }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
  };

  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-white mb-4">Storage Units</h2>
      <label className="block text-sm text-slate-300">Storage location
        <select value={viewLocationId} onChange={event => setViewLocationId(event.target.value)} className="block w-full max-w-sm bg-slate-900 rounded p-2 mt-1">
          {state.ownedLocations.map(locationId => {
            const property = state.properties.find(item => item.id === locationId);
            return <option key={locationId} value={locationId}>{property ? `${GAME_CONFIG.propertyDefs[property.type].name} · ${property.districtId}` : locationId}</option>;
          })}
        </select>
      </label>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="font-bold text-white mb-2">Buy a Storage Container</h3>
        <p className="text-xs text-slate-400 mb-3">Current location: {currentOwnedLocationId || 'not at an owned location'}. {state.storage.filter(unit => unit.locationId === currentOwnedLocationId).length}/{DEVELOPER_SETTINGS.storage.maximum_containers_per_location} containers.</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(GAME_CONFIG.storageDefs).filter(([id]) => id !== 'basic-300').map(([id, def]) => (
            <button key={id} disabled={!currentOwnedLocationId || state.currency < def.price || state.storage.filter(unit => unit.locationId === state.currentLocationId).length >= DEVELOPER_SETTINGS.storage.maximum_containers_per_location} onClick={() => buyContainer(id)} className="bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-bold px-3 py-2 rounded">
              {def.name} · ${def.price}
            </button>
          ))}
        </div>
      </div>
      {state.storage.filter(unit => unit.locationId === viewLocationId).map(unit => {
        const def = GAME_CONFIG.storageDefs[unit.typeId as keyof typeof GAME_CONFIG.storageDefs];
        if (!def) return null;
        const totalCards = unit.slots.reduce((acc, s) => acc + s.cards.length, 0);
        const capacity = def.capacityPerSlot * def.slots;
        const fillPerc = (totalCards / capacity) * 100;
        return (
          <div key={unit.id} className={`bg-slate-800 rounded-xl border ${state.selectedStorageId === unit.id ? 'border-blue-500' : 'border-slate-700'} overflow-hidden shadow-lg`}>
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <button onClick={() => setState(prev => ({ ...prev, selectedStorageId: unit.id }))} className="text-left"><h3 className="font-bold text-white">{def.name}</h3><div className="text-xs text-slate-400">{def.slots} drawers · {unit.locationId}{state.selectedStorageId === unit.id ? ' · Selected' : ''}</div></button>
              <div className="text-right">
                <div className="text-sm font-mono text-slate-200">{totalCards} / {capacity}</div>
                <div className="w-24 h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden"><div className={`h-full ${fillPerc > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, fillPerc)}%`}}></div></div>
              </div>
            </div>
            <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {unit.slots.map((slot, i) => (
                <div key={slot.id} className="bg-slate-900/50 p-2 rounded border border-slate-700/50 flex flex-col justify-between">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">{def.type} {i+1}</div>
                  <div className="text-sm font-mono text-slate-300 text-right">{slot.cards.length} <span className="text-[10px] text-slate-600">/ {def.capacityPerSlot}</span></div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
