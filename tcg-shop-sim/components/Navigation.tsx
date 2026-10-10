import React from 'react';
import { GAME_CONFIG } from '../game/config';
import { useGame } from '../game/state';
import { gameTimeOfDay } from '../game/time';
import { Map as MapIcon, Archive, Boxes, PackageOpen, Sun, Zap, Coffee, BookOpen, Library, Swords } from 'lucide-react';

export const Navigation = ({ current, setCurrent }: { current: string, setCurrent: (s: string) => void }) => (
  <nav className={`app-nav fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around p-2 pb-safe z-50`}>
    <NavBtn icon={<PackageOpen />} label="Inventory" active={current === 'inventory'} onClick={() => setCurrent('inventory')} />
    <NavBtn icon={<MapIcon />} label="City" active={current === 'city'} onClick={() => setCurrent('city')} />
    <NavBtn icon={<Archive />} label="Desk" active={current === 'desk'} onClick={() => setCurrent('desk')} />
    <NavBtn icon={<Boxes />} label="Storage" active={current === 'storage'} onClick={() => setCurrent('storage')} />
    <NavBtn icon={<BookOpen />} label="Collection" active={current === 'collection'} onClick={() => setCurrent('collection')} />
    <NavBtn icon={<Library />} label="Binders" active={current === 'binders'} onClick={() => setCurrent('binders')} />
    <NavBtn icon={<Swords />} label="Simulator" active={current === 'simulator'} onClick={() => setCurrent('simulator')} />
  </nav>
);

export const NavBtn = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${active ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200'}`}>
    {React.cloneElement(icon, { size: 24 })}
    <span className="text-[10px] mt-1 font-medium">{label}</span>
  </button>
);

export const TopBar = ({ onMenu }: { onMenu?: () => void }) => {
  const { state, setState } = useGame();
  const clockTime = gameTimeOfDay(state.clockMinutes);
  
  const drinkEnergy = () => {
    if (state.energyDrinks <= 0) return;
    setState(prev => ({
      ...prev,
      energyDrinks: prev.energyDrinks - 1,
      energy: Math.min(prev.maxEnergy, prev.energy + GAME_CONFIG.energy.supplies.energyDrink.restores)
    }));
  };

  return (
    <div className="app-topbar bg-slate-900 border-b border-slate-800 p-4 pt-safe flex justify-between items-center sticky top-0 z-40">
      <div className="flex items-center space-x-3">
        {onMenu && <button onClick={onMenu} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700">Menu</button>}
        <div className="flex items-center space-x-1">
          <Sun size={18} className="text-yellow-500" />
          <span className="text-white font-bold text-sm">Day {state.day}</span>
          <span className="text-slate-400 text-xs font-mono">
            {String(clockTime.hour).padStart(2, '0')}:{String(clockTime.minute).padStart(2, '0')}
          </span>
          {state.exhausted && <span className="text-red-400 text-xs font-bold">Exhausted</span>}
        </div>
        <div className="bg-slate-800 px-3 py-1 rounded-full flex items-center shadow-inner relative group cursor-pointer hover:bg-slate-700 transition-colors" onClick={drinkEnergy}>
          <Zap size={14} className="text-yellow-400 mr-1" />
          <span className={`text-sm font-mono font-bold ${state.energy <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {Math.floor(state.energy)}<span className="text-slate-500 text-xs">/{state.maxEnergy}</span>
          </span>
          <div className="ml-2 bg-yellow-600 text-white rounded-full px-1.5 py-0.5 flex items-center text-[10px] shadow">
            <Coffee size={10} className="mr-0.5" /> {state.energyDrinks}
          </div>
        </div>
      </div>
      <div className="bg-slate-800 px-4 py-1.5 rounded-full flex items-center shadow-inner">
        <span className="text-green-400 font-mono font-bold">${state.currency.toFixed(2)}</span>
      </div>
    </div>
  );
};
