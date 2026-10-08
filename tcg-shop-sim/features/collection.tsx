import React from 'react';
import { GAME_CONFIG } from '../game/config';
import { useGame } from '../game/state';
import { getCalculatedCardValue } from '../game/engine';
import { Plus, BookOpen } from 'lucide-react';

export const ScreenCollection = () => {
  const { state, availableSets, dictionary } = useGame();
  
  // Group binder cards by Set ID
  const binderBySet = state.binder.reduce((acc: any, instance) => {
    const cardData = dictionary[instance.cardId];
    if (cardData) {
      acc[cardData.setId] = acc[cardData.setId] || [];
      acc[cardData.setId].push(instance);
    }
    return acc;
  }, {});

  let totalBinderValue = 0;
  state.binder.forEach(c => {
     if (dictionary[c.cardId]) totalBinderValue += getCalculatedCardValue(dictionary[c.cardId], c.condition, c.grade, c.gradingCompany);
  });

  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg flex justify-between items-center mb-6">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center"><BookOpen className="mr-2 text-purple-400"/> Personal Binder</h2>
           <p className="text-xs text-slate-400 mt-1">Cards kept for your collection.</p>
        </div>
        <div className="text-right">
           <div className="text-xs text-slate-500 uppercase font-bold">Binder Value</div>
           <div className="text-lg font-mono text-green-400 font-bold">${totalBinderValue.toFixed(2)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {availableSets.map(set => {
          const collectedInstances = binderBySet[set.id] || [];
          const uniqueCollected = new Set(collectedInstances.map((c: any) => c.cardId)).size;
          // Approximate total cards in set (normally we'd query DB, assuming ~204 for Lorcana sets if not known)
          const estTotalInSet = 204; 
          const perc = Math.min(100, (uniqueCollected / estTotalInSet) * 100);
          
          if (collectedInstances.length === 0) return null;

          return (
            <div key={set.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow">
               <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                 <div>
                    <h3 className="font-bold text-white">{set.name}</h3>
                    <div className="text-xs text-slate-400">{uniqueCollected} Unique Collected</div>
                 </div>
                 <div className="text-right w-24">
                    <div className="text-xs font-bold text-blue-400 mb-1">{perc.toFixed(1)}%</div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${perc}%`}}></div></div>
                 </div>
               </div>
               <div className="p-4 flex gap-3 overflow-x-auto custom-scrollbar">
                 {collectedInstances.slice(0, 15).map((instance: any) => {
                    const cardData = dictionary[instance.cardId];
                    if (!cardData) return null;
                    return (
                      <div key={instance.instanceId} className="shrink-0 w-20 relative">
                        <div className={`w-20 h-28 rounded-lg shadow border ${instance.isFoil ? 'border-yellow-400' : 'border-slate-700'} bg-slate-900 overflow-hidden`}>
                          {cardData.imageUrl ? <img src={cardData.imageUrl} alt={cardData.name} className="w-full h-full object-contain" /> : <div className="p-1 text-[8px] text-white">{cardData.name}</div>}
                        </div>
                        {instance.grade && (
                          <div className={`absolute -bottom-2 -right-2 bg-slate-900 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold shadow-lg ${(GAME_CONFIG.grading.companies as any)[instance.gradingCompany || '']?.color}`}>{instance.gradingCompany} {instance.grade.toFixed(1)}</div>
                        )}
                      </div>
                    )
                 })}
                 {collectedInstances.length > 15 && (
                    <div className="shrink-0 w-20 h-28 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 bg-slate-900/50">
                       <Plus size={16} className="mb-1"/>
                       <span className="text-[10px] font-bold">+{collectedInstances.length - 15}</span>
                    </div>
                 )}
               </div>
            </div>
          );
        })}
        {state.binder.length === 0 && (
          <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
            <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
            <p>Your binder is empty.</p>
            <p className="text-sm mt-1">Send cards here from your Desk.</p>
          </div>
        )}
      </div>
    </div>
  );
};
