import React, { useState } from 'react';
import { Lock, Swords, Sparkles } from 'lucide-react';
import { useGame } from '../game/state';
import { ownsHeroRushStarterDeck } from '../game/simulator';
import { ScreenHeroRush } from './heroRush';

type SimulatorId = 'heroRush';

export const ScreenSimulator = () => {
  const { state, availableSets, dictionary } = useGame();
  const [active, setActive] = useState<SimulatorId | null>(null);
  const heroRushUnlocked = ownsHeroRushStarterDeck(state, availableSets, dictionary);

  if (active === 'heroRush' && heroRushUnlocked) {
    return (
      <div>
        <button onClick={() => setActive(null)} className="m-3 rounded bg-slate-700 px-3 py-1 text-xs text-white">← Simulators</button>
        <ScreenHeroRush />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24 animate-in fade-in">
      <h2 className="text-xl font-bold text-white">Simulator</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <button
          disabled={!heroRushUnlocked}
          onClick={() => setActive('heroRush')}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3 text-center text-white enabled:hover:border-blue-400 disabled:opacity-60"
        >
          {heroRushUnlocked ? <Swords size={28} className="text-red-400" /> : <Lock size={28} className="text-slate-500" />}
          <span className="font-bold">Marvel Hero Rush</span>
          <span className="text-[11px] text-slate-400">{heroRushUnlocked ? 'Play vs AI or hot-seat' : 'Locked: buy a Starter Deck (SD01) to unlock'}</span>
        </button>
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-3 text-center text-slate-500">
          <Sparkles size={28} />
          <span className="font-bold">Disney Lorcana</span>
          <span className="text-[11px]">Coming soon</span>
        </div>
      </div>
    </div>
  );
};
