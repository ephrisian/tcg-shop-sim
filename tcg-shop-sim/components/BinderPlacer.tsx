import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Binder, CardData, CardInstance } from '../game/types';
import { binderSlots } from '../game/binders';

interface Props {
  binders: Binder[];
  card: CardInstance;
  nextCard?: CardInstance | null;
  pileCount: number;
  dictionary: Record<string, CardData>;
  onPlace: (binderId: string, slot: number) => void;
  onClose: () => void;
}

const SlotCard = ({ instance, dictionary }: { instance: CardInstance; dictionary: Record<string, CardData> }) => {
  const data = dictionary[instance.cardId];
  return data?.imageUrl
    ? <img src={data.imageUrl} alt={data.name} className="w-full h-full object-contain" />
    : <span className="text-[9px] text-white p-1 break-words">{data?.name || 'Card'}</span>;
};

export const BinderPlacer = ({ binders, card, nextCard, pileCount, dictionary, onPlace, onClose }: Props) => {
  const [binderId, setBinderId] = useState(binders[0]?.id || '');
  const [spread, setSpread] = useState(0);
  const binder = binders.find(item => item.id === binderId);
  const slots = binder ? binderSlots(binder) : [];
  const perSpread = binder ? binder.slotsPerPage * 2 : 0;
  const spreadCount = binder ? Math.max(1, Math.ceil(binder.pageCount / 2)) : 1;
  const cols = binder?.slotsPerPage === 9 ? 6 : binder?.slotsPerPage === 4 ? 4 : 2;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 w-full max-w-3xl max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-white">Choose a Binder Slot</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400"><X size={20} /></button>
        </div>
        <div className="flex gap-4 mb-3 items-start">
          <div className="w-24 shrink-0">
            <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Placing ({pileCount} in pile)</div>
            <div className="aspect-[2.5/3.5] rounded border-2 border-purple-500 bg-slate-900 overflow-hidden flex items-center justify-center"><SlotCard instance={card} dictionary={dictionary} /></div>
            {nextCard && (
              <>
                <div className="text-[10px] uppercase text-slate-500 font-bold mt-2 mb-1">Next</div>
                <div className="w-14 aspect-[2.5/3.5] rounded border border-slate-600 bg-slate-900 overflow-hidden flex items-center justify-center opacity-80"><SlotCard instance={nextCard} dictionary={dictionary} /></div>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {binders.length === 0 || !binder ? <p className="text-sm text-slate-400">You do not own a binder yet.</p> : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <select aria-label="Binder" value={binder.id} onChange={event => { setBinderId(event.target.value); setSpread(0); }} className="bg-slate-900 text-white rounded px-2 py-1 text-sm">
                    {binders.map(item => <option key={item.id} value={item.id}>{item.name} ({item.cards.length}/{item.pageCount * item.slotsPerPage})</option>)}
                  </select>
                  <div className="flex gap-2 items-center">
                    <button disabled={spread === 0} onClick={() => setSpread(spread - 1)} className="bg-slate-700 text-white disabled:opacity-40 rounded px-2 py-1 text-xs">Prev</button>
                    <span className="text-xs text-slate-400">{spread + 1} / {spreadCount}</span>
                    <button disabled={spread + 1 >= spreadCount} onClick={() => setSpread(spread + 1)} className="bg-slate-700 text-white disabled:opacity-40 rounded px-2 py-1 text-xs">Next</button>
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: perSpread }, (_, i) => {
                    const slot = spread * perSpread + i;
                    if (slot >= slots.length) return <div key={slot} />;
                    const occupant = slots[slot];
                    return occupant ? (
                      <div key={slot} className="aspect-[2.5/3.5] rounded border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center opacity-50"><SlotCard instance={occupant} dictionary={dictionary} /></div>
                    ) : (
                      <button key={slot} onClick={() => onPlace(binder.id, slot)} className="aspect-[2.5/3.5] rounded border-2 border-dashed border-purple-500/60 bg-slate-900/60 hover:bg-purple-900/40 text-[10px] text-purple-300">{slot + 1}</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
