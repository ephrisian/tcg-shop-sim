import React, { useState } from 'react';
import { STORE_CARDS, idbGetAllByIndex } from '../game/database';
import { useGame } from '../game/state';
import { Eye, X, RefreshCw } from 'lucide-react';

export const ScreenSettings = () => {
  const { refreshData, importSet, availableSets } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [viewingSet, setViewingSet] = useState<string | null>(null);
  const [viewingCards, setViewingCards] = useState<any[]>([]);

  const handleRefresh = async () => {
    setLoading(true); setError(""); setSuccess("");
    try { await refreshData(); setSuccess("Set list updated!"); } 
    catch (e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const handleImport = async (setId: string) => {
    setLoading(true); setError(""); setSuccess("");
    try { await importSet(setId); setSuccess(`Imported cards for set ${setId}`); } 
    catch (e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const handleViewSet = async (setId: string) => {
    setViewingSet(setId);
    try {
      let cards = await idbGetAllByIndex(STORE_CARDS, 'setId', setId);
      if (cards.length===0) cards = await idbGetAllByIndex(STORE_CARDS, 'setId', setId.toLowerCase());
      if (cards.length===0) cards = await idbGetAllByIndex(STORE_CARDS, 'setId', setId.toUpperCase());
      setViewingCards(cards);
    } catch(e) {}
  };

  return (
    <div className="p-4 pb-24 space-y-6">
      <h2 className="text-xl font-bold text-white mb-4">Settings & Data</h2>
      {(error || success) && <div className={`p-3 rounded text-sm font-medium ${error ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-green-900/50 text-green-200 border border-green-800'}`}>{error || success}</div>}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4 shadow-lg">
        <div>
          <h3 className="font-bold text-white mb-1">Card Database</h3>
          <p className="text-xs text-slate-400 mb-3">Sync sets and definitions from Lorcast API to local IndexedDB.</p>
          <button onClick={handleRefresh} disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold py-2 px-4 rounded transition-colors flex items-center">
            <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Fetch Available Sets
          </button>
        </div>
        <div className="h-px bg-slate-700"></div>
        <div>
          <h3 className="font-bold text-slate-300 mb-2">Imported Sets</h3>
          {availableSets.length === 0 ? <div className="text-xs text-slate-500 italic">No sets fetched.</div> : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {availableSets.map(set => (
                <div key={set.id} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700/50">
                  <div><div className="text-sm font-bold text-slate-200">{set.code}</div><div className="text-xs text-slate-500 line-clamp-1">{set.name}</div></div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleViewSet(set.code)} disabled={loading} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-[10px] font-bold py-1 px-2 rounded flex items-center"><Eye size={12} className="mr-1" /> View</button>
                    <button onClick={() => handleImport(set.code)} disabled={loading} className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-[10px] font-bold py-1 px-2 rounded">Import</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="bg-red-900/20 rounded-xl border border-red-900/50 p-4">
        <h3 className="font-bold text-red-400 mb-1">Danger Zone</h3>
        <button onClick={() => { if(window.confirm("Are you sure? This cannot be undone.")) { localStorage.removeItem('tcg_sim_save'); window.location.reload(); } }} className="bg-red-700 hover:bg-red-600 text-white text-sm font-bold py-2 px-4 rounded mt-2">Hard Reset Save</button>
      </div>
      
      {viewingSet && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 touch-none">
          <div className="bg-slate-900 border-b border-slate-800 p-4 pt-safe flex justify-between items-center shadow-lg">
            <div><h2 className="text-xl font-bold text-white flex items-center"><Eye size={20} className="mr-2 text-blue-400" /> Database View</h2><div className="text-xs text-slate-400 font-mono mt-1">SET: {viewingSet}</div></div>
            <button onClick={() => setViewingSet(null)} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-full"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-950">
            {viewingCards.length === 0 ? <div className="text-center mt-10 text-slate-500">No cards found. Try importing.</div> : (
              <div className="space-y-2 pb-12">
                {viewingCards.map((c, i) => (
                  <div key={c.id + i} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center space-x-3 overflow-hidden pr-2">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-600 shrink-0">{i + 1}</div>
                      <div className="overflow-hidden"><div className="text-sm font-bold text-white truncate">{c.name}</div><div className="text-xs text-slate-400 italic truncate">{c.version || c.type}</div></div>
                    </div>
                    <div className="text-right shrink-0"><div className="text-xs font-bold text-slate-300">{c.rarity}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
