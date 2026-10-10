import React, { useState } from 'react';
import type { SaveSlotInfo } from '../game/saves';

interface StartScreenProps {
  saves: SaveSlotInfo[];
  hasContinue: boolean;
  ready: boolean;
  progress: number;
  onContinue: () => void;
  onNewGame: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export const StartScreen = ({ saves, hasContinue, ready, progress, onContinue, onNewGame, onLoad, onDelete }: StartScreenProps) => {
  const [view, setView] = useState<'main' | 'load'>('main');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const buttonClass = 'w-full rounded-lg px-4 py-3 font-bold text-white disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md space-y-3">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">TCG Shop Sim</h1>
        {!ready && (
          <div className="space-y-2" role="progressbar" aria-label="Loading Game Assets" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <p className="text-center text-sm text-slate-300">Loading Game Assets… {Math.round(progress * 100)}%</p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.max(3, progress * 100)}%` }} />
            </div>
          </div>
        )}
        {view === 'main' ? (
          <>
            <button disabled={!ready || !hasContinue} onClick={onContinue} className={`${buttonClass} bg-blue-600 hover:bg-blue-500`}>Continue</button>
            <button disabled={!ready} onClick={onNewGame} className={`${buttonClass} bg-green-700 hover:bg-green-600`}>New Game</button>
            <button disabled={!ready || saves.length === 0} onClick={() => setView('load')} className={`${buttonClass} bg-slate-700 hover:bg-slate-600`}>Load Game</button>
          </>
        ) : (
          <>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {saves.length === 0 && <p className="text-center text-sm text-slate-400">No saved games.</p>}
              {saves.map(save => (
                <div key={save.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">{save.name}</div>
                    <div className="text-xs text-slate-400">Day {save.day} · ${save.currency.toFixed(2)} · {new Date(save.updatedAt).toLocaleString()}</div>
                  </div>
                  {pendingDelete === save.id ? (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => { onDelete(save.id); setPendingDelete(null); }} className="rounded bg-red-700 px-3 py-1 text-xs font-bold text-white">Confirm</button>
                      <button onClick={() => setPendingDelete(null)} className="rounded bg-slate-700 px-3 py-1 text-xs text-white">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => onLoad(save.id)} className="rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white">Load</button>
                      <button onClick={() => setPendingDelete(save.id)} className="rounded bg-red-900 px-3 py-1 text-xs font-bold text-red-100">Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setPendingDelete(null); setView('main'); }} className={`${buttonClass} bg-slate-700 hover:bg-slate-600`}>Back</button>
          </>
        )}
      </div>
    </div>
  );
};
