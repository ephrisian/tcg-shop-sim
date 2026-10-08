import React from 'react';
import { GAME_CONFIG } from '../game/config';
import { useGame } from '../game/state';
import { getCalculatedCardValue } from '../game/engine';
import { Sun, AlertTriangle, Briefcase } from 'lucide-react';

export const ScreenHome = () => {
  const { state, setState, availableSets, dictionary } = useGame();

  const handleEndDay = () => {
    setState(prev => {
      const newDesk = prev.desk.map(c => ({ ...c, condition: Math.max(0, c.condition - GAME_CONFIG.world.deskDecayRate) }));
      const newRuns = { ...prev.printRuns };
      Object.keys(newRuns).forEach(k => { if (newRuns[k] > 0) newRuns[k] = Math.max(0, newRuns[k] - Math.floor(Math.random() * 5)); });
      
      const news = [`Day ${prev.day} ended. Desk cards lost condition. Energy restored.`];
      const newModifiers = { ...prev.marketModifiers };
      let newLgsStock = { ...prev.lgsStock };
      
      if (Math.random() < 0.25 && availableSets.length > 0) {
        const randomSet = availableSets[Math.floor(Math.random() * availableSets.length)].id;
        const isPositive = Math.random() > 0.5;
        if (isPositive) {
          newModifiers[randomSet] = (newModifiers[randomSet] || 1) * 1.2;
          news.unshift(`📈 MARKET SURGE: Tournament results drive up demand for Set ${randomSet}!`);
        } else {
          newModifiers[randomSet] = (newModifiers[randomSet] || 1) * 0.8;
          news.unshift(`📉 MARKET CRASH: Banlist update! Set ${randomSet} prices plummeted.`);
        }
      }

      if (Math.random() < 0.3 && availableSets.length > 0) {
        const lgsIds = Object.keys(GAME_CONFIG.locations).filter(k => (GAME_CONFIG.locations as any)[k].type === 'lgs');
        const randomLgs = lgsIds[Math.floor(Math.random() * lgsIds.length)];
        const randomSet = availableSets[Math.floor(Math.random() * availableSets.length)].id;
        
        newLgsStock[randomLgs] = { ...newLgsStock[randomLgs] };
        newLgsStock[randomLgs][randomSet] = (newLgsStock[randomLgs][randomSet] || 0) + Math.floor(Math.random() * 5) + 1;
        news.unshift(`📦 RESTOCK: ${(GAME_CONFIG.locations as any)[randomLgs].name} just received a surprise shipment of Set ${randomSet}!`);
      }

      return { 
        ...prev, day: prev.day + 1, energy: prev.maxEnergy, liveState: { ...prev.liveState, active: false }, desk: newDesk, printRuns: newRuns, 
        marketModifiers: newModifiers,
        lgsStock: newLgsStock,
        newsFeed: [...news, ...prev.newsFeed].slice(0, 15) 
      };
    });
  };

  const buyItem = (type: 'worker') => {
    setState(prev => {
      const newState = { ...prev };
      if (type === 'worker' && prev.currency >= GAME_CONFIG.businessUpgrades.worker.cost) {
        newState.currency -= GAME_CONFIG.businessUpgrades.worker.cost;
        newState.businessStats.workers += 1;
        newState.maxEnergy += GAME_CONFIG.businessUpgrades.worker.maxEnergyBoost;
        newState.profitMargin = Math.max(0.1, newState.profitMargin - GAME_CONFIG.businessUpgrades.worker.marginPenalty);
      }
      return newState;
    });
  };

  const totalCards = state.storage.reduce((acc, s) => acc + s.slots.reduce((a, slot) => a + slot.cards.length, 0), 0) + state.desk.length + state.binder.length;
  
  let totalValue = 0;
  [...state.desk, ...state.binder].forEach(c => {
     if (dictionary[c.cardId]) {
         totalValue += getCalculatedCardValue(dictionary[c.cardId], c.condition, c.grade, c.gradingCompany);
     }
  });

  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-6 shadow-lg border border-blue-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Shop Dashboard</h2>
        <p className="text-blue-200 text-sm relative z-10">Manage your collection and daily operations.</p>
        
        <div className="mt-4 grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Total Cards</div>
            <div className="text-xl font-mono text-white">{totalCards}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Est. Value</div>
            <div className="text-xl font-mono text-green-400">${totalValue.toFixed(2)}</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Sealed</div>
            <div className="text-xl font-mono text-white">{state.sealed.length}</div>
          </div>
           <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Items Sold</div>
            <div className="text-xl font-mono text-white">{state.shopStats.itemsSold}</div>
          </div>
        </div>
      </div>

      <button onClick={handleEndDay} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl shadow border border-slate-700 flex items-center justify-center space-x-2 transition-colors">
        <Sun size={20} /><span>End Day (Restores Energy)</span>
      </button>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow">
        <div className="bg-slate-800 p-3 border-b border-slate-700 font-bold text-white flex items-center justify-between">
          <span>Operations & Upgrades</span>
          <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-1 rounded">Margin: {(state.profitMargin * 100).toFixed(0)}%</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded border border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-900/50 text-blue-400 rounded"><Briefcase size={16}/></div>
              <div>
                <div className="text-sm font-bold text-white">{GAME_CONFIG.businessUpgrades.worker.name} <span className="text-xs text-slate-500 ml-1">x{state.businessStats.workers}</span></div>
                <div className="text-[10px] text-slate-400 leading-tight">{GAME_CONFIG.businessUpgrades.worker.desc}</div>
              </div>
            </div>
            <button onClick={() => buyItem('worker')} disabled={state.currency < GAME_CONFIG.businessUpgrades.worker.cost} className="bg-green-600 disabled:opacity-50 text-white text-xs font-bold py-1.5 px-3 rounded shadow shrink-0 ml-2">
              ${GAME_CONFIG.businessUpgrades.worker.cost}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow">
        <div className="bg-slate-800 p-3 border-b border-slate-700 font-medium text-slate-300 flex items-center">
          <AlertTriangle size={16} className="mr-2 text-yellow-500" /> Market News
        </div>
        <div className="p-4 space-y-3 h-48 overflow-y-auto custom-scrollbar">
          {state.newsFeed.map((news, i) => (
            <div key={i} className="text-sm text-slate-400 border-l-2 border-slate-700 pl-3 py-1">
              {news}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
