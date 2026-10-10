import React, { useState } from 'react';
import { DEVELOPER_SETTINGS, GAME_CONFIG } from '../game/config';
import type { CardData, CardInstance, DeskCard } from '../game/types';
import { useGame } from '../game/state';
import { storeDeskPiles } from '../game/inventory';
import { placeInBinder } from '../game/binders';
import { BinderPlacer } from '../components/BinderPlacer';
import { getCalculatedCardValue } from '../game/engine';
import { Archive, Trash2, X, HeartHandshake, Zap, DollarSign, BookOpen, ShieldCheck } from 'lucide-react';

export const ScreenDesk = () => {
  const { state, setState, dictionary, consumeEnergy, advanceTime } = useGame();
  
  const drawPile = state.desk.filter(c => c.pileIndex === null);
  const piles = Array.from({ length: 6 }).map((_, i) => state.desk.filter(c => c.pileIndex === i));
  const [activeCard, setActiveCard] = useState<DeskCard | null>(null);
  const [showGrading, setShowGrading] = useState(false);
  const [showBinderPlacer, setShowBinderPlacer] = useState(false);
  const nextCard = activeCard ? drawPile.find(card => card.instanceId !== activeCard.instanceId) || null : drawPile[0] || null;
  const localStorage = state.storage.filter(unit => unit.locationId === state.currentLocationId);
  const selectedStorage = localStorage.find(unit => unit.id === state.selectedStorageId) || localStorage[0];
  const [pileTargets, setPileTargets] = useState<Record<number, string>>({});
  const showNextCard = (completedInstanceId: string) => {
    setActiveCard(drawPile.find(card => card.instanceId !== completedInstanceId) || null);
  };

  const moveCard = (targetPileIndex: number) => {
    if (!activeCard) return;
    if (consumeEnergy(GAME_CONFIG.energy.costs.sortCard)) {
      setState(prev => ({ ...prev, desk: prev.desk.map(c => c.instanceId === activeCard.instanceId ? { ...c, pileIndex: targetPileIndex } : c) }));
      showNextCard(activeCard.instanceId);
    }
  };

  const storeSorted = () => {
    const result = storeDeskPiles(state, pileTargets, selectedStorage?.slots[0]?.id);
    if (result.moved === 0) return;
    setState(prev => storeDeskPiles(prev, pileTargets, selectedStorage?.slots[0]?.id).state);
    if (result.remaining > 0) alert('The selected drawers are full or unavailable. Cards that did not fit remain on the desk.');
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
  };

  const throwAway = () => {
    if (!activeCard) return;
    setState(prev => ({ ...prev, desk: prev.desk.filter(c => c.instanceId !== activeCard.instanceId) }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
    showNextCard(activeCard.instanceId);
  };

  const moveToBinder = (binderId: string, slot: number) => {
    if (!activeCard) return;
    const { pileIndex, targetDrawerId, ...cardToBind } = activeCard;
    setState(prev => ({
      ...prev,
      binders: prev.binders.map(item => item.id === binderId ? placeInBinder(item, cardToBind, slot) : item),
      desk: prev.desk.filter(c => c.instanceId !== activeCard.instanceId),
    }));
    setShowBinderPlacer(false);
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
    showNextCard(activeCard.instanceId);
  };

  const sellCard = () => {
    if (!activeCard) return;
    const cardData = dictionary[activeCard.cardId];
    if (!cardData) return;
    if (cardData.marketPrice <= 0) {
      alert('Market data is unavailable for this card. Store it and set a manual Singles sale price during a Live Sale.');
      return;
    }
    
    const saleValue = getCalculatedCardValue(cardData, activeCard.condition, activeCard.grade, activeCard.gradingCompany) * state.profitMargin;
    
    setState(prev => ({ 
      ...prev, 
      currency: prev.currency + saleValue,
      shopStats: { ...prev.shopStats, itemsSold: prev.shopStats.itemsSold + 1 },
      desk: prev.desk.filter(c => c.instanceId !== activeCard.instanceId) 
    }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
    showNextCard(activeCard.instanceId);
  };

  const donateCard = (storeId: string) => {
    if (!activeCard) return;
    const cardData = dictionary[activeCard.cardId];
    if (!cardData) return;

    setState(prev => {
      const newState = { ...prev, desk: prev.desk.filter(c => c.instanceId !== activeCard.instanceId) };
      const storeDonations = newState.donations[storeId] || {};
      const rarityCount = storeDonations[cardData.rarity] || 0;
      
      const basePoints = (GAME_CONFIG.reputation.basePointsPerRarity as any)[cardData.rarity] || 1;
      const curveIndex = Math.min(rarityCount, GAME_CONFIG.reputation.diminishingReturnsCurve.length - 1);
      const multiplier = GAME_CONFIG.reputation.diminishingReturnsCurve[curveIndex];
      const repGained = Math.round(basePoints * multiplier);
      
      newState.donations = { ...newState.donations, [storeId]: { ...storeDonations, [cardData.rarity]: rarityCount + 1 }};
      newState.reputation = { ...newState.reputation, [storeId]: (newState.reputation[storeId] || 0) + repGained };
      return newState;
    });
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
    showNextCard(activeCard.instanceId);
  };

  const gradeCard = (companyId: string) => {
    if (!activeCard) return;
    const company = (GAME_CONFIG.grading.companies as any)[companyId];
    if (state.currency < company.cost) {
      alert("Not enough funds to grade this card.");
      return;
    }

    const roll = Math.random();
    let finalGrade = 5.0;
    for (const odds of GAME_CONFIG.grading.odds) {
      if (roll <= odds.threshold) {
        finalGrade = odds.grade;
        break;
      }
    }

    setState(prev => ({
      ...prev,
      currency: prev.currency - company.cost,
      desk: prev.desk.map(c => c.instanceId === activeCard.instanceId ? { ...c, grade: finalGrade, gradingCompany: companyId } : c)
    }));
    advanceTime(DEVELOPER_SETTINGS.time.default_action_minutes);
    setActiveCard(prev => prev ? { ...prev, grade: finalGrade, gradingCompany: companyId } : null);
    setShowGrading(false);
  };

  const MiniCard = ({ cardData, instance }: { cardData: CardData, instance: CardInstance }) => (
    <div className={`w-10 h-14 rounded shadow-md border ${instance.isFoil ? 'border-yellow-400' : 'border-slate-700'} bg-slate-800 overflow-hidden relative`}>
      {cardData?.imageUrl ? <img src={cardData.imageUrl} alt={cardData.name} className="w-full h-full object-contain bg-slate-900" /> : <div className="p-1 text-[8px] text-white break-words">{cardData?.name}</div>}
      {instance.grade && (
        <div className={`absolute top-0 right-0 bg-slate-900/90 text-[10px] font-bold px-1 rounded-bl border-b border-l border-slate-700 ${(GAME_CONFIG.grading.companies as any)[instance.gradingCompany || '']?.color}`}>{instance.grade.toFixed(1)}</div>
      )}
    </div>
  );

  const activeCardData = activeCard ? dictionary[activeCard.cardId] : null;
  const activeCardValue = activeCardData && activeCard ? getCalculatedCardValue(activeCardData, activeCard.condition, activeCard.grade, activeCard.gradingCompany) : 0;

  if (state.currentLocationId !== state.homeLocationId) {
    return (
      <div className="p-8 text-center text-slate-400">
        <h2 className="mb-2 text-xl font-bold text-white">The Desk Is at Home</h2>
        <p>Return to your bedroom to manage desk cards and sort them into local storage.</p>
      </div>
    );
  }

  return (
    <div className="desk-screen desk-layout p-4 pb-24 min-h-[calc(100vh-60px)] flex flex-col relative">
      <div className="desk-header flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-2xl font-bold text-white">The Desk</h2>
      </div>

      <div className="desk-board bg-slate-900/50 rounded-2xl p-4 border border-slate-700 flex flex-col mb-4 shadow-inner relative overflow-hidden flex-shrink-0" style={{ minHeight: '380px' }}>
        <div className="desk-board-content flex justify-between h-full relative z-10">
          {/* Active Card Area */}
          <div className="desk-card-area flex-1 flex justify-center items-center relative pr-4">
            {nextCard && (
              <div className="absolute left-0 top-0 z-20 text-center pointer-events-none">
                <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Next</div>
                <div className="w-12 aspect-[2.5/3.5] rounded border border-slate-600 bg-slate-800 overflow-hidden opacity-80">
                  {dictionary[nextCard.cardId]?.imageUrl && <img src={dictionary[nextCard.cardId].imageUrl} alt="" className="w-full h-full object-contain" />}
                </div>
              </div>
            )}
            {activeCard && activeCardData ? (
               <div className="relative w-56 sm:w-64 aspect-[2.5/3.5] animate-in fade-in zoom-in-95 duration-200">
                  <div className={`w-full h-full rounded-xl shadow-2xl border-4 ${activeCard.isFoil ? 'border-yellow-400' : 'border-slate-700'} bg-slate-800 overflow-hidden relative`}>
                    {activeCardData.imageUrl ? <img src={activeCardData.imageUrl} alt={activeCardData.name} className="w-full h-full object-contain bg-slate-900" /> : <div className="p-4 text-center text-white font-bold">{activeCardData.name}</div>}
                    {activeCard.isFoil && <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shimmer mix-blend-overlay"></div>}
                  </div>
                  <div className="absolute -top-3 -right-3 bg-blue-600 text-white text-lg font-bold w-10 h-10 flex items-center justify-center rounded-full shadow-lg border-2 border-slate-800 z-20">{drawPile.length}</div>
                  
                  {activeCard.grade && (
                    <div className="absolute -top-4 -left-4 bg-slate-900 rounded-lg border-2 border-slate-700 p-2 shadow-xl z-20 flex flex-col items-center transform -rotate-6">
                      <span className={`text-xs font-bold uppercase tracking-widest ${(GAME_CONFIG.grading.companies as any)[activeCard.gradingCompany || '']?.color}`}>{activeCard.gradingCompany}</span>
                      <span className={`text-xl font-black ${activeCard.grade >= 9.5 ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-white'}`}>{activeCard.grade.toFixed(1)}</span>
                    </div>
                  )}
               </div>
            ) : drawPile.length > 0 ? (
              <div className={`relative cursor-pointer transition-transform hover:-translate-y-2`} onClick={() => setActiveCard(drawPile[0])}>
                {drawPile.length > 1 && <div className="absolute top-2 left-2 w-56 sm:w-64 aspect-[2.5/3.5] bg-slate-700 rounded border border-slate-600"></div>}
                {drawPile.length > 2 && <div className="absolute top-4 left-4 w-56 sm:w-64 aspect-[2.5/3.5] bg-slate-600 rounded border border-slate-500"></div>}
                <div className="relative w-56 sm:w-64 aspect-[2.5/3.5] bg-slate-800 border-2 border-slate-600 rounded-xl shadow-xl flex items-center justify-center">
                    <span className="text-slate-400 font-bold tracking-widest">TAP TO DRAW</span>
                    <div className="absolute -top-3 -right-3 bg-blue-600 text-white text-lg font-bold w-10 h-10 flex items-center justify-center rounded-full shadow-lg border-2 border-slate-800">{drawPile.length}</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="desk-actions flex flex-col justify-center space-y-2.5 pl-4 w-28 sm:w-32 shrink-0 border-l border-slate-700/50">
             <button onClick={storeSorted} disabled={piles.every(p => p.length === 0)} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold py-2 px-2 rounded-lg shadow-md transition-colors flex items-center justify-center w-full">
               <Archive size={14} className="mr-1.5"/> Store All
             </button>

             {activeCard && activeCardData && (
                <>
                  <button onClick={sellCard} disabled={activeCardData.marketPrice <= 0} className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs py-1.5 px-2 rounded-lg shadow-md transition-colors flex flex-col items-center justify-center w-full border border-green-600">
                    <div className="flex items-center font-bold mb-0.5"><DollarSign size={12} className="mr-0.5"/> Sell</div>
                    <div className="text-[10px] font-mono opacity-90">${(activeCardValue * state.profitMargin).toFixed(2)}</div>
                  </button>
                  {activeCardData.marketPrice <= 0 && <div className="text-[9px] leading-tight text-amber-300">Market data missing. Store it for a manual Singles sale price.</div>}

                  <button onClick={() => setShowBinderPlacer(true)} className="bg-purple-700 hover:bg-purple-600 text-white text-xs py-2 px-2 rounded-lg shadow-md transition-colors flex items-center justify-center w-full border border-purple-600">
                    <BookOpen size={14} className="mr-1.5"/> Binder
                  </button>

                  {!activeCard.grade && (
                    <button onClick={() => setShowGrading(true)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 px-2 rounded-lg shadow-md transition-colors flex items-center justify-center w-full border border-slate-600">
                      <ShieldCheck size={14} className="mr-1.5"/> Grade
                    </button>
                  )}
                </>
             )}
             
             <button onClick={throwAway} disabled={!activeCard} className="bg-red-900/40 hover:bg-red-800/80 disabled:opacity-50 border border-red-800/60 text-red-300 text-xs py-2 px-2 rounded-lg shadow-md transition-colors flex items-center justify-center w-full mt-auto">
               <Trash2 size={14} className="mr-1.5"/> Trash
             </button>
          </div>
        </div>

        {/* Donation Area */}
        {activeCard && (
          <div className="mt-4 pt-3 border-t border-slate-700/50 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider text-center">Donate to Local Store</div>
            <div className="flex justify-center space-x-2 sm:space-x-3">
              {Object.values(GAME_CONFIG.locations).filter((l:any) => l.type === 'lgs').map((lgs:any) => (
                <button key={lgs.id} onClick={() => donateCard(lgs.id)} className="bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] sm:text-xs py-1.5 px-3 sm:px-4 rounded-full shadow-sm flex items-center border border-slate-600 transition-colors">
                  <HeartHandshake size={12} className="mr-1 sm:mr-1.5 shrink-0"/> <span className="truncate">{lgs.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="desk-footer h-8 flex items-center justify-center mb-4 flex-shrink-0">
        {activeCard ? (
          <div className="text-sm text-blue-300 font-medium flex items-center bg-blue-900/30 px-4 py-1.5 rounded-full border border-blue-800/50">
            Tap a pile to move <strong className="text-white mx-1.5 truncate max-w-[150px]">{activeCardData?.name}</strong> <Zap size={12} className="text-yellow-400 ml-1.5 mr-0.5"/>-1
          </div>
        ) : (
          <div className="text-sm text-slate-500 bg-slate-900/50 px-4 py-1.5 rounded-full">Tap the draw pile to start sorting</div>
        )}
      </div>

      {/* Sorting Piles */}
      <div className="desk-piles grid grid-cols-3 sm:grid-cols-6 gap-2 content-start pr-1 pb-4">
        {piles.map((pile, i) => (
          <div key={i} onClick={() => moveCard(i)} className={`h-32 bg-slate-900/80 rounded-xl border-2 ${activeCard ? 'border-blue-500/50 cursor-pointer hover:bg-slate-800 hover:border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-slate-800'} flex flex-col items-center p-1.5 relative transition-all duration-200`}>
            <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-widest z-10 bg-slate-900/80 px-2 rounded-full mt-1">Pile {i + 1}</div>
            <select
              aria-label={`Destination drawer for pile ${i + 1}`}
              value={pileTargets[i] || selectedStorage?.slots[0]?.id || ''}
              onClick={event => event.stopPropagation()}
              onChange={event => setPileTargets(prev => ({ ...prev, [i]: event.target.value }))}
              className="w-full bg-slate-800 text-[9px] text-slate-300 rounded px-1 py-1 z-10"
            >
              {localStorage.flatMap(unit => unit.slots.map((slot, drawerIndex) => (
                <option key={slot.id} value={slot.id}>{unit.id} · Drawer {drawerIndex + 1} ({slot.cards.length})</option>
              )))}
            </select>
            {pile.length > 0 ? (
              <div className="relative mt-auto w-full flex justify-center pb-2">
                 {pile.map((c, idx) => {
                    if (idx < pile.length - 3) return null;
                    const visualOffset = (pile.length - 1 - idx) * 4;
                    return (
                      <div key={c.instanceId} className="absolute bottom-2" style={{ transform: `translateY(-${visualOffset}px) scale(${1 - (pile.length - 1 - idx) * 0.05})`, zIndex: idx }}>
                        <MiniCard cardData={dictionary[c.cardId]} instance={c} />
                      </div>
                    );
                 })}
                 <div className="h-14 w-10 invisible"></div> 
                 <div className="absolute -bottom-2 right-0 sm:right-1 bg-slate-700 text-white text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-800 z-50 shadow-md">{pile.length}</div>
              </div>
            ) : <div className="flex-1 flex items-center justify-center opacity-10"><Archive size={24} /></div>}
          </div>
        ))}
      </div>

      {showBinderPlacer && activeCard && (
        <BinderPlacer
          binders={state.binders}
          card={activeCard}
          nextCard={nextCard}
          pileCount={drawPile.length}
          dictionary={dictionary}
          onPlace={moveToBinder}
          onClose={() => setShowBinderPlacer(false)}
        />
      )}

      {/* Grading Modal */}
      {showGrading && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center"><ShieldCheck className="mr-2 text-blue-400"/> Send to Grader</h3>
              <button onClick={() => setShowGrading(false)} className="text-slate-400"><X size={20}/></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Choose a company to grade this card. Higher tier companies cost more but yield higher multipliers if the grade is good.</p>
            <div className="space-y-3">
              {Object.entries(GAME_CONFIG.grading.companies).map(([id, comp]) => (
                <button key={id} onClick={() => gradeCard(id)} disabled={state.currency < comp.cost} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg flex justify-between items-center hover:bg-slate-700 transition-colors disabled:opacity-50 text-left">
                  <div>
                    <div className={`font-bold text-lg ${comp.color}`}>{comp.name}</div>
                    <div className="text-xs text-slate-400">Multiplier Potential: {(comp.repMultiplier * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-green-900/50 text-green-400 font-bold px-3 py-1.5 rounded-lg border border-green-800">
                    ${comp.cost.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
