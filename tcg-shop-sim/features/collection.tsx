import React, { useState } from 'react';
import { DEVELOPER_SETTINGS, GAME_CONFIG } from '../game/config';
import { useGame } from '../game/state';
import { getCalculatedCardValue } from '../game/engine';
import { binderSlots, moveInBinder } from '../game/binders';
import { BookOpen } from 'lucide-react';

export const ScreenCollection = ({ view }: { view: 'collection' | 'binders' }) => {
  const { state, availableSets, dictionary, setState, advanceTime } = useGame();
  const [selectedBinderId, setSelectedBinderId] = useState(state.binders[0]?.id || '');
  const [binderPage, setBinderPage] = useState(0);
  const selectedBinder = state.binders.find(binder => binder.id === selectedBinderId);
  const [pickedSlot, setPickedSlot] = useState<number | null>(null);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [setPage, setSetPage] = useState(0);
  const slotList = selectedBinder ? binderSlots(selectedBinder) : [];
  const currentStore = GAME_CONFIG.locations[state.currentLocationId as keyof typeof GAME_CONFIG.locations];
  const currentProperty = state.properties.find(property => property.id === state.currentLocationId);
  const atBinderRetailer = currentStore?.type === 'lgs' || currentStore?.type === 'bigbox' ||
    currentStore?.type === 'resort' || currentProperty?.type === 'shop';
  const binderCards = state.binders.flatMap(binder => binder.cards);
  const ownedCards = binderCards;
  // Group binder cards by Set ID
  const binderBySet = ownedCards.reduce((acc: Record<string, typeof ownedCards>, instance) => {
    const cardData = dictionary[instance.cardId];
    if (cardData) {
      acc[cardData.setId] = acc[cardData.setId] || [];
      acc[cardData.setId].push(instance);
    }
    return acc;
  }, {});

  let totalBinderValue = 0;
  binderCards.forEach(c => {
     if (dictionary[c.cardId]) totalBinderValue += getCalculatedCardValue(dictionary[c.cardId], c.condition, c.grade, c.gradingCompany);
  });

  const buyBinder = (designId: string) => {
    if (!atBinderRetailer) {
      alert('Visit a card shop or your own shop to purchase a binder.');
      return;
    }
    const design = GAME_CONFIG.binders.designs.find(item => item.id === designId);
    if (!design || state.currency < design.price) return;
    const newBinder = {
      id: crypto.randomUUID(),
      name: design.name,
      designId: design.id,
      pageCount: design.pages,
      slotsPerPage: design.slotsPerPage,
      purchasePrice: design.price,
      used: false,
      cards: [],
    };
    setState(prev => ({
      ...prev,
      currency: prev.currency - design.price,
      binders: [...prev.binders, newBinder],
    }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
    if (!selectedBinderId) setSelectedBinderId(newBinder.id);
  };

  const renameBinder = (binderId: string, name: string) => {
    setState(prev => ({
      ...prev,
      binders: prev.binders.map(binder => binder.id === binderId ? { ...binder, name } : binder),
    }));
  };

  const emptyBinder = (binderId: string) => {
    const binder = state.binders.find(item => item.id === binderId);
    if (!binder || binder.cards.length === 0) return;
    const localStorage = state.storage.filter(unit => unit.locationId === state.currentLocationId);
    const storage = localStorage.find(unit => unit.id === state.selectedStorageId) || localStorage[0];
    if (!storage) {
      alert('There is no storage container at this location. Travel to a location with storage or buy an eligible container.');
      return;
    }
    const definition = GAME_CONFIG.storageDefs[storage.typeId as keyof typeof GAME_CONFIG.storageDefs];
    const freeSpace = storage.slots.reduce((sum, drawer) => sum + Math.max(0, definition.capacityPerSlot - drawer.cards.length), 0);
    if (freeSpace < binder.cards.length) {
      alert('The selected storage container does not have enough free capacity. Choose another container or make room first.');
      return;
    }
    setState(prev => {
      const currentBinder = prev.binders.find(item => item.id === binderId);
      const currentStorage = prev.storage.find(unit => unit.id === storage.id);
      if (!currentBinder || !currentStorage || currentBinder.cards.length === 0) return prev;
      const currentDefinition = GAME_CONFIG.storageDefs[currentStorage.typeId as keyof typeof GAME_CONFIG.storageDefs];
      if (!currentDefinition) return prev;
      const currentFreeSpace = currentStorage.slots.reduce((sum, drawer) =>
        sum + Math.max(0, currentDefinition.capacityPerSlot - drawer.cards.length), 0);
      if (currentFreeSpace < currentBinder.cards.length) return prev;
      let cardsToPlace = [...currentBinder.cards];
      const updatedStorage = prev.storage.map(unit => unit.id !== currentStorage.id ? unit : ({
        ...unit,
        slots: unit.slots.map(drawer => {
          const space = Math.max(0, currentDefinition.capacityPerSlot - drawer.cards.length);
          const moved = cardsToPlace.slice(0, space);
          cardsToPlace = cardsToPlace.slice(moved.length);
          return { ...drawer, cards: [...drawer.cards, ...moved] };
        }),
      }));
      return {
        ...prev,
        storage: updatedStorage,
        binders: prev.binders.map(item => item.id === binderId ? { ...item, cards: [] } : item),
      };
    });
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
  };

  const sellBinder = (binderId: string) => {
    const binder = state.binders.find(item => item.id === binderId);
    if (!binder || binder.cards.length > 0) return;
    const design = GAME_CONFIG.binders.designs.find(item => item.id === binder.designId);
    if (!design) return;
    setState(prev => ({
      ...prev,
      currency: prev.currency + binder.purchasePrice * (binder.used ? design.resaleFraction : 1),
      binders: prev.binders.filter(item => item.id !== binderId),
    }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
  };

  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg flex justify-between items-center mb-6">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center"><BookOpen className="mr-2 text-purple-400"/> {view === 'binders' ? 'Binders' : 'Collection'}</h2>
           <p className="text-xs text-slate-400 mt-1">{view === 'binders' ? 'Manage your binders and the cards placed in them.' : 'Your personal collection is the cards held in all of your binders.'}</p>
        </div>
        {view === 'binders' && <div className="text-right">
          <div className="text-xs text-slate-500 uppercase font-bold">Binder Value</div>
          <div className="text-lg font-mono text-green-400 font-bold">${totalBinderValue.toFixed(2)}</div>
        </div>}
      </div>
      {view === 'binders' && <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-white font-bold mb-2">Purchase a Binder</h3>
        {!atBinderRetailer
          ? <p className="text-xs text-slate-400">Visit a card shop or your own shop to purchase binders.</p>
          : <div className="flex flex-wrap gap-2">
            {GAME_CONFIG.binders.designs.map(design => (
              <button key={design.id} disabled={state.currency < design.price} onClick={() => buyBinder(design.id)} className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-bold rounded px-3 py-2">
                {design.name} · {design.pages} pages · ${design.price}
              </button>
            ))}
          </div>}
      </div>}
      {view === 'binders' && selectedBinder && (
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <select aria-label="Select binder" value={selectedBinder.id} onChange={event => { setSelectedBinderId(event.target.value); setBinderPage(0); }} className="bg-slate-900 text-white rounded px-2 py-1">
              {state.binders.map(binder => <option key={binder.id} value={binder.id}>{binder.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button disabled={binderPage === 0} onClick={() => setBinderPage(Math.max(0, binderPage - 1))} className="bg-slate-700 text-white disabled:opacity-40 rounded px-2 py-1 text-xs">Previous</button>
              <span className="text-xs text-slate-400 self-center">Pages {binderPage * 2 + 1}–{Math.min(selectedBinder.pageCount, binderPage * 2 + 2)} of {selectedBinder.pageCount}</span>
              <button disabled={binderPage + 2 >= selectedBinder.pageCount} onClick={() => setBinderPage(binderPage + 1)} className="bg-slate-700 text-white disabled:opacity-40 rounded px-2 py-1 text-xs">Next</button>
            </div>
          </div>
          <div className={`grid grid-cols-2 gap-3 ${selectedBinder.slotsPerPage === 9 ? 'sm:grid-cols-6' : selectedBinder.slotsPerPage === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
            {Array.from({ length: selectedBinder.slotsPerPage * 2 }, (_, pageSlot) => {
              const slotIndex = binderPage * selectedBinder.slotsPerPage + pageSlot;
              if (slotIndex >= slotList.length) return <div key={slotIndex} />;
              const instance = slotList[slotIndex];
              const cardData = instance ? dictionary[instance.cardId] : null;
              const moveTo = (from: number) => setState(prev => ({
                ...prev,
                binders: prev.binders.map(binder => binder.id === selectedBinder.id ? moveInBinder(binder, from, slotIndex) : binder),
              }));
              return (
                <div
                  key={slotIndex}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault();
                    const from = Number(event.dataTransfer.getData('text/binder-slot'));
                    if (Number.isInteger(from) && slotList[from]) moveTo(from);
                  }}
                  onClick={() => {
                    if (pickedSlot === null) {
                      if (instance) setPickedSlot(slotIndex);
                    } else {
                      if (pickedSlot !== slotIndex) moveTo(pickedSlot);
                      setPickedSlot(null);
                    }
                  }}
                  className={`aspect-[2.5/3.5] rounded-lg border ${pickedSlot === slotIndex ? 'border-solid border-purple-400' : 'border-dashed border-slate-600'} bg-slate-900/60 overflow-hidden flex items-center justify-center cursor-pointer`}
                >
                  {instance ? (
                    <div draggable onDragStart={event => event.dataTransfer.setData('text/binder-slot', String(slotIndex))} className="w-full h-full relative">
                      {cardData?.imageUrl ? <img src={cardData.imageUrl} alt={cardData.name} className="w-full h-full object-contain" /> : <span className="text-xs text-white p-2">{cardData?.name || 'Card'}</span>}
                      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-white">{slotIndex + 1}</span>
                    </div>
                  ) : <span className="text-[10px] text-slate-600">{pickedSlot !== null ? 'Place here' : `Empty ${slotIndex + 1}`}</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}
        {view === 'binders' && state.binders.length > 0 && (
          <div className="space-y-2">
            {state.binders.map(binder => (
              <div key={binder.id} className="flex flex-wrap items-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700 text-sm">
                <input aria-label="Binder name" value={binder.name} onChange={event => renameBinder(binder.id, event.target.value)} className="min-w-24 flex-1 bg-slate-900 text-white rounded px-2 py-1" />
                <span className="text-slate-400">{binder.cards.length}/{binder.pageCount * binder.slotsPerPage}</span>
                <button disabled={binder.cards.length === 0} onClick={() => emptyBinder(binder.id)} className="text-blue-300 disabled:opacity-40">Empty to selected storage</button>
                <button disabled={binder.cards.length > 0} onClick={() => sellBinder(binder.id)} className="text-red-300 disabled:opacity-40">Sell · ${(() => { const design = GAME_CONFIG.binders.designs.find(item => item.id === binder.designId); return (binder.purchasePrice * (binder.used ? design?.resaleFraction || 0 : 1)).toFixed(2); })()}</button>
              </div>
            ))}
          </div>
        )}

        {view === 'collection' && <div className="space-y-4">
        {availableSets.map(set => {
          const collectedInstances = binderBySet[set.id] || [];
          const uniqueCollected = new Set(collectedInstances.map((c: any) => c.cardId)).size;
          // Approximate total cards in set (normally we'd query DB, assuming ~204 for Lorcana sets if not known)
          const setCards = Object.values(dictionary).filter(card => card.setId === set.id);
          const estTotalInSet = setCards.length || set.cardCount || 0;
          const perc = estTotalInSet > 0 ? Math.min(100, (uniqueCollected / estTotalInSet) * 100) : 0;

          if (collectedInstances.length === 0 && setCards.length === 0) return null;
          const expanded = expandedSetId === set.id;
          const pageSize = 60;
          const pageCount = Math.max(1, Math.ceil(setCards.length / pageSize));
          const visibleCards = setCards.slice(setPage * pageSize, (setPage + 1) * pageSize);

          return (
            <div key={set.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow">
               <button onClick={() => { setExpandedSetId(expanded ? null : set.id); setSetPage(0); }} className="w-full p-4 flex justify-between items-center bg-slate-800 text-left">
                 <div>
                    <h3 className="font-bold text-white">{set.name}</h3>
                    <div className="text-xs text-slate-400">{uniqueCollected} / {estTotalInSet || '?'} Unique in binders · {expanded ? 'Hide cards' : 'Show cards'}</div>
                 </div>
                 <div className="text-right w-24">
                    <div className="text-xs font-bold text-blue-400 mb-1">{perc.toFixed(1)}%</div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${perc}%`}}></div></div>
                 </div>
               </button>
               {expanded && (
                 <div className="p-3 border-t border-slate-700">
                   <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
                     <button disabled={setPage === 0} onClick={() => setSetPage(setPage - 1)} className="bg-slate-700 text-white disabled:opacity-40 rounded px-2 py-1">Previous</button>
                     <span>Page {setPage + 1} of {pageCount}</span>
                     <button disabled={setPage + 1 >= pageCount} onClick={() => setSetPage(setPage + 1)} className="bg-slate-700 text-white disabled:opacity-40 rounded px-2 py-1">Next</button>
                   </div>
                   <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                     {visibleCards.map(card => {
                       const copies = ownedCards.filter(instance => instance.cardId === card.id).length;
                       return (
                         <div key={card.id} className={`aspect-[2.5/3.5] rounded-lg border bg-slate-900 flex flex-col items-center justify-center text-center p-1 ${copies ? 'border-blue-500/60' : 'border-slate-700 opacity-60'}`}>
                           <div className="text-3xl font-black text-slate-600">?</div>
                           <div className="text-[10px] text-slate-300 truncate w-full">{copies ? card.name : 'Mystery Card'}</div>
                           <div className="text-[9px] text-slate-500">{copies ? `${copies} owned` : 'Unowned'}</div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}
            </div>
          );
        })}
        {binderCards.length === 0 && (
          <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
            <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
            <p>Your collection is empty.</p>
            <p className="text-sm mt-1">Place cards into binders to add them to your personal collection.</p>
          </div>
        )}
      </div>}
    </div>
  );
};
