import React from 'react';
import { GAME_CONFIG } from '../game/config';
import { useGame } from '../game/state';

export const ScreenStorage = () => {
  const { state } = useGame();
  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      <h2 className="text-xl font-bold text-white mb-4">Storage Units</h2>
      {state.storage.map(unit => {
        const def = (GAME_CONFIG.storageDefs as any)[unit.typeId];
        const totalCards = unit.slots.reduce((acc, s) => acc + s.cards.length, 0);
        const capacity = def.capacityPerSlot * def.slots;
        const fillPerc = (totalCards / capacity) * 100;
        return (
          <div key={unit.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <div><h3 className="font-bold text-white">{def.name}</h3><div className="text-xs text-slate-400">{def.slots} {def.type}s</div></div>
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
