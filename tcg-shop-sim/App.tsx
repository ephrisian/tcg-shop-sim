import React, { useState, useEffect } from 'react';
import { defaultGameState, GameContext } from './game/state';
import { STORE_CARDS, STORE_SETS, idbGetAll, idbPutAll } from './game/database';
import { fetchLorcastSets, fetchLorcastCardsForSet } from './game/engine';
import type { CardData, GameState } from './game/types';
import { Navigation, TopBar } from './components/Navigation';
import { ScreenHome } from './features/home';
import { ScreenCity } from './features/city';
import { ScreenSealed, ScreenPackOpener } from './features/sealed';
import { ScreenDesk } from './features/desk';
import { ScreenStorage } from './features/storage';
import { ScreenCollection } from './features/collection';
import { ScreenSettings } from './features/settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [activePackId, setActivePackId] = useState<{ id: string, setId: string } | null>(null);
  const [state, setState] = useState<GameState>(defaultGameState);
  const [dictionary, setDictionary] = useState<Record<string, CardData>>({});
  const [availableSets, setAvailableSets] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const saved = localStorage.getItem('tcg_sim_save');
      if (saved) {
        try { 
          let parsed = JSON.parse(saved); 
          if (!parsed.reputation) parsed.reputation = defaultGameState.reputation;
          if (!parsed.donations) parsed.donations = defaultGameState.donations;
          if (!parsed.lgsStock) parsed.lgsStock = defaultGameState.lgsStock;
          if (!parsed.marketModifiers) parsed.marketModifiers = defaultGameState.marketModifiers;
          if (parsed.energy === undefined) parsed.energy = defaultGameState.energy;
          if (parsed.maxEnergy === undefined) parsed.maxEnergy = defaultGameState.maxEnergy;
          if (parsed.energyDrinks === undefined) parsed.energyDrinks = defaultGameState.energyDrinks;
          if (parsed.profitMargin === undefined) parsed.profitMargin = defaultGameState.profitMargin;
          if (!parsed.businessStats) parsed.businessStats = defaultGameState.businessStats;
          if (!parsed.shopStats) parsed.shopStats = defaultGameState.shopStats;
          if (!parsed.liveState) parsed.liveState = defaultGameState.liveState;
          if (!parsed.binder) parsed.binder = defaultGameState.binder;
          
          if (parsed.sealed) {
             parsed.sealed = parsed.sealed.map((item: any) => ({ ...item, setId: item.setId === 'TFC' ? '1' : item.setId }));
          }
          setState(parsed); 
        } 
        catch (e) {}
      }
      try {
        const sets = await idbGetAll(STORE_SETS);
        setAvailableSets(sets);
        const allCards = await idbGetAll(STORE_CARDS);
        const dict: Record<string, CardData> = {};
        allCards.forEach(c => dict[c.id] = c);
        setDictionary(dict);
      } catch (e) {}
    };
    loadData();
  }, []);

  useEffect(() => { localStorage.setItem('tcg_sim_save', JSON.stringify(state)); }, [state]);

  const consumeEnergy = (cost: number) => {
    if (state.energy < cost) {
      alert("Not enough Energy! Buy an Energy Drink or End the Day.");
      return false;
    }
    setState(prev => ({ ...prev, energy: prev.energy - cost }));
    return true;
  };

  const refreshData = async () => {
    const sets = await fetchLorcastSets();
    await idbPutAll(STORE_SETS, sets);
    setAvailableSets(sets);
  };

  const importSet = async (setId: string) => {
    const cards = await fetchLorcastCardsForSet(setId);
    if (cards.length > 0) {
      await idbPutAll(STORE_CARDS, cards);
      const newDict = { ...dictionary };
      cards.forEach((c:any) => newDict[c.id] = c);
      setDictionary(newDict);
    } else throw new Error("No cards found for this set.");
  };

  return (
    <GameContext.Provider value={{ state, setState, dictionary, availableSets, refreshData, importSet, consumeEnergy }}>
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
        <style>{`
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1rem); }
          .pt-safe { padding-top: env(safe-area-inset-top, 0); }
          .perspective-1000 { perspective: 1000px; }
          .transform-style-3d { transform-style: preserve-3d; }
          @keyframes shimmer { 0% { transform: translateX(-100%) skewX(-15deg); } 100% { transform: translateX(200%) skewX(-15deg); } }
          .animate-shimmer { animation: shimmer 2s infinite; }
          @keyframes pulse-slow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
          @keyframes rumble { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 10%, 30%, 50%, 70%, 90% { transform: translate(-2px, -2px) rotate(-1deg); } 20%, 40%, 60%, 80% { transform: translate(2px, 2px) rotate(1deg); } }
          .animate-rumble { animation: rumble 0.3s infinite; }
          @keyframes sparkle { 0% { transform: scale(0) translateY(0); opacity: 0; } 20%, 80% { opacity: 1; } 100% { transform: scale(1.5) translateY(-30px); opacity: 0; } }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        `}</style>
        
        {activePackId ? (
          <ScreenPackOpener packId={activePackId.id} setId={activePackId.setId} onComplete={() => setActivePackId(null)} />
        ) : (
          <div className="flex flex-col min-h-screen">
            <TopBar />
            <main className="flex-1 overflow-y-auto">
              {currentScreen === 'home' && <ScreenHome />}
              {currentScreen === 'city' && <ScreenCity />}
              {currentScreen === 'sealed' && <ScreenSealed onRipPack={(id, setId) => setActivePackId({ id, setId })} />}
              {currentScreen === 'desk' && <ScreenDesk />}
              {currentScreen === 'storage' && <ScreenStorage />}
              {currentScreen === 'collection' && <ScreenCollection />}
              {currentScreen === 'settings' && <ScreenSettings />}
            </main>
            <Navigation current={currentScreen} setCurrent={setCurrentScreen} />
          </div>
        )}
      </div>
    </GameContext.Provider>
  );
}
