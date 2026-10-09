import React, { useState, useEffect } from 'react';
import { defaultGameState, GameContext, migrateGameState } from './game/state';
import { STORE_CARDS, STORE_SETS, idbGetAll, idbPutAll } from './game/database';
import { fetchLorcastCardsForSet, fetchLorcastSets } from './game/engine';
import { importProductPackaging as saveProductPackaging, importSetPackage as saveSetPackage } from './game/setPackages';
import { installCompiledSetPackages } from './game/compiledCatalog';
import { DEVELOPER_SETTINGS, GAME_CONFIG } from './game/config';
import { adjustedEnergyCost, gameDayForClock, gameTimeOfDay, MINUTES_PER_GAME_DAY, MINUTES_PER_GAME_HOUR, mustForceSleep, startsRecoverySleep } from './game/time';
import { resolveDueShipments } from './game/shipping';
import type { ImportedSet } from './game/types';
import type { CardData, GameState } from './game/types';
import { Navigation, TopBar } from './components/Navigation';
import { ScreenInventory } from './features/inventory';
import { ScreenCity } from './features/city';
import { ScreenSealed, ScreenPackOpener } from './features/sealed';
import { ScreenDesk } from './features/desk';
import { ScreenStorage } from './features/storage';
import { ScreenCollection } from './features/collection';
import { ScreenSettings } from './features/settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('inventory');
  const [activePackId, setActivePackId] = useState<{ id: string, setId: string; productId?: string } | null>(null);
  const [state, setState] = useState<GameState>(defaultGameState);
  const [dictionary, setDictionary] = useState<Record<string, CardData>>({});
  const [availableSets, setAvailableSets] = useState<ImportedSet[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const saved = localStorage.getItem('tcg_sim_save');
      if (saved) {
        try {
          setState(migrateGameState(JSON.parse(saved)));
        } catch (error) {
          localStorage.setItem('tcg_sim_save_backup', saved);
          const message = error instanceof Error ? error.message : 'Unknown save migration error';
          setLoadError(`Could not load your saved game. A backup was saved as tcg_sim_save_backup: ${message}`);
          return;
        }
      }
      try {
        await installCompiledSetPackages();
        const sets = await idbGetAll(STORE_SETS);
        setAvailableSets(sets);
        const allCards = await idbGetAll(STORE_CARDS);
        const dict: Record<string, CardData> = {};
        allCards.forEach(c => dict[c.id] = c);
        setDictionary(dict);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        setLoadError(`Card data could not be loaded: ${message}`);
      }
      setIsLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('tcg_sim_save', JSON.stringify(state));
  }, [isLoaded, state]);

  useEffect(() => {
    if (state.shipments.length > 0) {
      setState(prev => resolveDueShipments(prev, DEVELOPER_SETTINGS.storage.sealed_products_per_location));
    }
  }, [state.clockMinutes, state.shipments, state.sealed]);

  const withAdvancedClock = (prev: GameState, minutes: number): GameState => {
    const clockMinutes = prev.clockMinutes + minutes;
    const day = gameDayForClock(clockMinutes);
    const awakeHours = prev.awakeHours + minutes / MINUTES_PER_GAME_HOUR;
    const daysPassed = Math.max(0, day - prev.day);
    const dailyPropertyCost = prev.properties.reduce((sum, property) => sum + GAME_CONFIG.propertyDefs[property.type].dailyCost, 0) * daysPassed;
    return {
      ...prev,
      clockMinutes,
      day,
      awakeHours,
      exhausted: prev.exhausted || mustForceSleep(awakeHours, DEVELOPER_SETTINGS.energy.forced_sleep_after_hours),
      forcedSleepRecoveryDay: prev.exhausted && prev.forcedSleepRecoveryDay !== null
        ? day
        : prev.forcedSleepRecoveryDay,
      currency: Math.max(0, prev.currency - dailyPropertyCost),
      newsFeed: dailyPropertyCost > 0
        ? [`Paid $${dailyPropertyCost.toFixed(2)} in property operating costs.`, ...prev.newsFeed].slice(0, 15)
        : prev.newsFeed,
    };
  };

  const advanceTime = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Time advance must be a non-negative number of minutes.');
    setState(prev => withAdvancedClock(prev, minutes));
  };

  const consumeEnergy = (cost: number, actionMinutes = DEVELOPER_SETTINGS.time.default_action_minutes) => {
    if (!Number.isFinite(cost) || cost < 0) throw new Error('Energy cost must be a non-negative number.');
    if (!Number.isFinite(actionMinutes) || actionMinutes < 0) throw new Error('Action time must be a non-negative number of minutes.');
    if (state.exhausted) {
      alert('You are exhausted and must complete your recovery sleep before continuing.');
      return false;
    }
    if (mustForceSleep(state.awakeHours, DEVELOPER_SETTINGS.energy.forced_sleep_after_hours)) {
      setState(prev => ({ ...prev, exhausted: true }));
      alert('You are exhausted and must sleep before continuing.');
      return false;
    }
    const adjustedCost = adjustedEnergyCost(cost, state.awakeHours, DEVELOPER_SETTINGS.energy.late_hour_cost_modifier);
    if (state.energy < adjustedCost) {
      alert("Not enough Energy! Buy an Energy Drink or End the Day.");
      return false;
    }
    setState(prev => ({
        ...withAdvancedClock(prev, actionMinutes),
        energy: Math.max(0, prev.energy - adjustedEnergyCost(cost, prev.awakeHours, DEVELOPER_SETTINGS.energy.late_hour_cost_modifier)),
      }));
    return true;
  };

  const sleep = (requestedHours = 7) => {
    if (!Number.isFinite(requestedHours) || requestedHours < 0) throw new Error('Sleep duration must be a non-negative number of hours.');
    const hours = Math.max(7, requestedHours);
    setState(prev => {
      const forcedSleep = mustForceSleep(prev.awakeHours, DEVELOPER_SETTINGS.energy.forced_sleep_after_hours);
      const startHour = Math.floor((prev.clockMinutes % MINUTES_PER_GAME_DAY) / MINUTES_PER_GAME_HOUR);
      const advancedState = withAdvancedClock(prev, hours * MINUTES_PER_GAME_HOUR);
      const { clockMinutes, day } = advancedState;
      const recoversFromExhaustion = prev.exhausted &&
        prev.forcedSleepRecoveryDay === prev.day &&
        startsRecoverySleep(startHour);
      const exhausted = forcedSleep || (prev.exhausted && !recoversFromExhaustion);
      const energyFraction = forcedSleep ? DEVELOPER_SETTINGS.energy.forced_sleep_energy_fraction : 1;
      return {
        ...advancedState,
        clockMinutes,
        day,
        awakeHours: 0,
        exhausted,
        forcedSleepRecoveryDay: forcedSleep ? day : recoversFromExhaustion ? null : prev.forcedSleepRecoveryDay,
        energy: Math.floor(prev.maxEnergy * energyFraction),
        liveState: { ...prev.liveState, active: false, requests: [], sellableBinderIds: [] },
      };
    });
  };

  const refreshData = async () => {
    if (!import.meta.env.DEV) throw new Error('Card catalogs are compiled into production builds.');
    const remoteSets = await fetchLorcastSets();
    const existingSets = await idbGetAll(STORE_SETS);
    const existingById = new Map(existingSets.map(set => [set.id, set]));
    const existingByCode = new Map(existingSets.map(set => [String(set.code || '').toLocaleLowerCase(), set]));
    await idbPutAll(STORE_SETS, remoteSets.map(set => {
      const prior = existingById.get(set.id) || existingByCode.get(String(set.code || '').toLocaleLowerCase());
      return prior?.products ? { ...set, products: prior.products } : set;
    }));
    setAvailableSets(await idbGetAll(STORE_SETS));
  };

  const importSet = async (setId: string) => {
    if (!import.meta.env.DEV) throw new Error('Card catalogs are compiled into production builds.');
    const cards = await fetchLorcastCardsForSet(setId);
    if (cards.length === 0) throw new Error(`No cards found for set ${setId}.`);
    await idbPutAll(STORE_CARDS, cards);
    const allCards = await idbGetAll(STORE_CARDS);
    setDictionary(Object.fromEntries(allCards.map(card => [card.id, card])));
  };

  const importPackage = async (jsonFile: File, imageFiles: File[]) => {
    const importedSet = await saveSetPackage(jsonFile, imageFiles);
    const cards = await idbGetAll(STORE_CARDS);
    const allSets = await idbGetAll(STORE_SETS);
    setDictionary(Object.fromEntries(cards.map(card => [card.id, card])));
    setAvailableSets(allSets);
    setState(prev => ({
      ...prev,
      newsFeed: [`Imported ${importedSet.name} for ${importedSet.gameName}.`, ...prev.newsFeed].slice(0, 15),
    }));
  };

  const importPackaging = async (jsonFile: File, imageFiles: File[]) => {
    const updatedSet = await saveProductPackaging(jsonFile, imageFiles);
    setAvailableSets(await idbGetAll(STORE_SETS));
    setState(prev => ({
      ...prev,
      newsFeed: [`Updated product packaging for ${updatedSet.name}.`, ...prev.newsFeed].slice(0, 15),
    }));
  };

  return (
    <GameContext.Provider value={{ state, setState, dictionary, availableSets, refreshData, importSet, importSetPackage: importPackage, importProductPackaging: importPackaging, consumeEnergy, sleep, advanceTime }}>
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
        {loadError && <div role="alert" className="bg-red-950 text-red-100 px-4 py-2 text-sm">{loadError}</div>}
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
          @media (orientation: landscape) and (min-width: 700px) {
            .app-shell { height: 100dvh; min-height: 0; }
            .app-main { padding-right: 5.5rem; }
            .app-nav { top: 0; right: 0; bottom: 0; left: auto; width: 5rem; flex-direction: column; justify-content: center; gap: .4rem; padding: .5rem; border-top: 0; border-left: 1px solid rgb(30 41 59); }
            .app-nav button { width: 100%; }
            .app-nav-dev button { padding: .4rem .15rem; }
            .app-nav-dev button span { font-size: 8px; }
            .app-nav-dev button svg { width: 20px; height: 20px; }
            .app-main > .desk-screen { height: calc(100dvh - 72px); min-height: 0; }
            .desk-layout { display: grid; grid-template-columns: minmax(250px, .8fr) minmax(340px, 1.2fr); grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "header header" "board piles" "footer piles"; gap: .75rem; }
            .desk-header { grid-area: header; }
            .desk-board { grid-area: board; min-height: 0 !important; height: 100%; margin: 0; }
            .desk-board-content { flex-direction: column; justify-content: center; }
            .desk-card-area { order: 0; padding: 0; min-height: 0; }
            .desk-card-area > div { width: min(100%, 230px); }
            .desk-actions { order: 1; width: 100%; flex-direction: row; flex-wrap: wrap; border-left: 0; border-top: 1px solid rgb(51 65 85 / .5); padding: .75rem 0 0; margin-top: .75rem; }
            .desk-actions > button { width: auto; flex: 1 1 90px; }
            .desk-piles { grid-area: piles; min-height: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(100px, 1fr)); overflow-y: auto; }
            .desk-piles > div { height: auto; min-height: 100px; }
            .desk-footer { grid-area: footer; margin: 0; }
          }
        `}</style>
        
        {activePackId ? (
          <ScreenPackOpener packId={activePackId.id} setId={activePackId.setId} productId={activePackId.productId} onComplete={() => setActivePackId(null)} />
        ) : (
          <div className="app-shell flex flex-col min-h-screen">
            <TopBar />
            <main className="app-main flex-1 overflow-y-auto">
              {state.exhausted ? (
                <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950 p-6">
                  <div className="w-full max-w-md rounded-xl border border-amber-700 bg-slate-900 p-6 text-center shadow-xl">
                    <h2 className="mb-2 text-xl font-bold text-amber-300">Exhaustion Recovery</h2>
                    <p className="mb-5 text-sm text-slate-300">
                      {state.forcedSleepRecoveryDay === null
                        ? 'You have been awake too long. You must sleep for at least seven hours and will recover half your energy.'
                        : 'You are exhausted. Rest until 10 PM, then sleep for at least seven hours to recover.'}
                    </p>
                    {state.forcedSleepRecoveryDay === null ? (
                      <button onClick={() => sleep(7)} className="w-full rounded bg-amber-700 px-4 py-3 font-bold text-white">Sleep 7 hours · forced recovery</button>
                    ) : (() => {
                      const time = gameTimeOfDay(state.clockMinutes);
                      if (time.hour >= 22) {
                        return <button onClick={() => sleep(7)} className="w-full rounded bg-amber-700 px-4 py-3 font-bold text-white">Sleep 7 hours · recover from exhaustion</button>;
                      }
                      const todayMinutes = state.clockMinutes % MINUTES_PER_GAME_DAY;
                      const targetMinutes = 22 * MINUTES_PER_GAME_HOUR;
                      const waitMinutes = (targetMinutes - todayMinutes + MINUTES_PER_GAME_DAY) % MINUTES_PER_GAME_DAY;
                      return <button onClick={() => advanceTime(waitMinutes)} className="w-full rounded bg-slate-700 px-4 py-3 font-bold text-white">Rest until 10 PM</button>;
                    })()}
                  </div>
                </section>
              ) : (
                <>
                  {currentScreen === 'inventory' && <ScreenInventory onRipPack={(id, setId, productId) => setActivePackId({ id, setId, productId })} />}
                  {currentScreen === 'city' && <ScreenCity />}
                  {currentScreen === 'desk' && <ScreenDesk />}
                  {currentScreen === 'storage' && <ScreenStorage />}
                  {currentScreen === 'collection' && <ScreenCollection view="collection" />}
                  {currentScreen === 'binders' && <ScreenCollection view="binders" />}
                  {import.meta.env.DEV && currentScreen === 'settings' && <ScreenSettings />}
                </>
              )}
            </main>
            {!state.exhausted && <Navigation current={currentScreen} setCurrent={setCurrentScreen} />}
          </div>
        )}
      </div>
    </GameContext.Provider>
  );
}
