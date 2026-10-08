import React, { useState, useEffect } from 'react';
import { GAME_CONFIG, getSetTheme } from '../game/config';
import type { CardInstance } from '../game/types';
import { useGame } from '../game/state';
import { generatePack } from '../game/engine';
import { Archive, Box, AlertTriangle, X, Zap, MonitorPlay, DollarSign, Users } from 'lucide-react';

export const ScreenSealed = ({ onRipPack }: { onRipPack: (id: string, setId: string) => void }) => {
  const { state, setState, availableSets, consumeEnergy } = useGame();
  const [showConfig, setShowConfig] = useState(false);
  const getSetName = (id: string) => availableSets.find(s => s.id.toUpperCase() === id.toUpperCase())?.name || id;

  const openBox = (boxId: string, setId: string) => {
    if (consumeEnergy(GAME_CONFIG.energy.costs.openBox)) {
      setState(prev => {
        const newSealed = prev.sealed.filter(s => s.id !== boxId);
        const newPacks = Array.from({ length: GAME_CONFIG.packConfiguration.packsPerBox }).map(() => ({
          id: crypto.randomUUID(), type: 'pack' as const, setId
        }));
        return { ...prev, sealed: [...newSealed, ...newPacks] };
      });
    }
  };

  const handleRipPack = (pId: string, setId: string) => {
    const cost = state.liveState.active ? GAME_CONFIG.energy.costs.liveRipPack : GAME_CONFIG.energy.costs.ripPack;
    if (consumeEnergy(cost)) {
      onRipPack(pId, setId);
    }
  };

  const startLiveShow = (typeId: string) => {
    const typeDef = (GAME_CONFIG.liveShows.types as any)[typeId];
    if (consumeEnergy(typeDef.cost)) {
      const baseViewers = Math.floor(Math.random() * 10) + 5;
      const shopBonus = Math.floor((state.shopStats.itemsSold * 0.1) + (state.shopStats.liveShows * 2) + state.shopStats.returnBuyers);
      const totalViewers = baseViewers + shopBonus;
      
      const whales = Math.floor(totalViewers * 0.05 * typeDef.whaleAttraction);
      const frugal = Math.floor(totalViewers * 0.40 * typeDef.frugalAttraction);

      setState(prev => ({ 
        ...prev, 
        shopStats: { ...prev.shopStats, liveShows: prev.shopStats.liveShows + 1 },
        liveState: { active: true, type: typeId, viewers: totalViewers, whales, frugal } 
      }));
      setShowConfig(false);
    }
  };

  const endLiveShow = () => setState(prev => ({ ...prev, liveState: { ...prev.liveState, active: false } }));

  const boxes = state.sealed.filter(s => s.type === 'box');
  const packs = state.sealed.filter(s => s.type === 'pack');

  return (
    <div className="p-4 pb-24 space-y-6 animate-in fade-in">
      
      {state.liveState.active ? (
        <div className="bg-slate-900 rounded-xl p-4 mb-4 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-in slide-in-from-top-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center">
                <span className="bg-red-600 text-white text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded animate-pulse mr-2">LIVE</span>
                <h3 className="text-white font-bold text-lg">Rip Ship Stream</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 capitalize">{GAME_CONFIG.liveShows.types[state.liveState.type as keyof typeof GAME_CONFIG.liveShows.types]?.name}</p>
            </div>
            <button onClick={endLiveShow} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded border border-slate-700">End Stream</button>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
              <Users size={16} className="mx-auto text-blue-400 mb-1" />
              <div className="text-sm font-bold text-white">{state.liveState.viewers}</div>
              <div className="text-[10px] text-slate-500 uppercase">Viewers</div>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
              <DollarSign size={16} className="mx-auto text-yellow-400 mb-1" />
              <div className="text-sm font-bold text-white">{state.liveState.whales}</div>
              <div className="text-[10px] text-slate-500 uppercase">Whales</div>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/50">
              <Archive size={16} className="mx-auto text-green-400 mb-1" />
              <div className="text-sm font-bold text-white">{state.liveState.frugal}</div>
              <div className="text-[10px] text-slate-500 uppercase">Frugal</div>
            </div>
          </div>
        </div>
      ) : showConfig ? (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700 shadow-lg animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-white font-bold flex items-center"><MonitorPlay size={18} className="mr-2 text-blue-400" /> Start Live Show</h3>
             <button onClick={() => setShowConfig(false)} className="text-slate-400"><X size={20}/></button>
          </div>
          <div className="space-y-3">
             {Object.entries(GAME_CONFIG.liveShows.types).map(([id, type]) => (
                <div key={id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                   <div>
                      <div className="text-sm font-bold text-white">{type.name}</div>
                      <div className="text-xs text-slate-400">{type.desc}</div>
                   </div>
                   <button onClick={() => startLiveShow(id)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded shadow flex items-center shrink-0 ml-2">
                     Go Live <Zap size={10} className="ml-1 mr-0.5 text-yellow-300"/>{type.cost}
                   </button>
                </div>
             ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700 flex justify-between items-center shadow-lg">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center">
              <MonitorPlay size={20} className="mr-2 text-slate-400" /> Live Rip Ship
            </h3>
            <p className="text-xs text-slate-400">Stream openings. Packs cost 1 ⚡.</p>
          </div>
          <button onClick={() => setShowConfig(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow shrink-0 ml-4">
            Setup Stream
          </button>
        </div>
      )}

      <h2 className="text-xl font-bold text-white mb-4">Sealed Inventory</h2>
      {state.sealed.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
          <Archive size={48} className="mx-auto mb-3 opacity-20" />
          <p>Your sealed inventory is empty.</p>
          <p className="text-sm mt-1">Visit the City to buy product.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {boxes.map(b => {
             const theme = getSetTheme(b.setId);
             return (
              <div key={b.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center text-center shadow-lg">
                <div className="w-20 h-16 bg-gradient-to-br from-slate-600 to-slate-800 rounded border border-slate-500 mb-3 flex items-center justify-center relative overflow-hidden">
                   <div className={`absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-b ${theme.bg}`}></div>
                   <span className={`text-2xl opacity-20 absolute ${theme.text}`}>{theme.symbol}</span>
                  <Box size={24} className="text-slate-400 z-10" />
                </div>
                <div className="text-sm font-bold text-white mb-1 line-clamp-1">{getSetName(b.setId)}</div>
                <div className="text-xs text-slate-400 mb-3">Booster Box</div>
                <button onClick={() => openBox(b.id, b.setId)} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center">
                  Crack Box <Zap size={10} className="ml-1 text-yellow-300"/> <span className="ml-0.5">{GAME_CONFIG.energy.costs.openBox}</span>
                </button>
              </div>
            );
          })}
          {packs.map(p => {
            const theme = getSetTheme(p.setId);
            const setName = getSetName(p.setId);
            return (
              <div key={p.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                 <div className={`w-16 h-24 bg-gradient-to-br ${theme.bg} rounded border ${theme.border} mb-3 shadow-inner flex flex-col items-center justify-center relative`}>
                   <div className="absolute inset-0 bg-white/10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 15%, 0 25%)'}}></div>
                   <span className={`text-2xl font-bold ${theme.text} transform drop-shadow-md mb-1`}>{theme.symbol}</span>
                   <span className={`text-[8px] font-bold ${theme.text} uppercase transform -rotate-12 drop-shadow-md tracking-widest text-center leading-tight px-1`}>{setName.split(' ').slice(0, 2).join('\n')}</span>
                 </div>
                <div className="text-xs text-slate-400 mb-3 line-clamp-1">{setName}</div>
                <button onClick={() => handleRipPack(p.id, p.setId)} className={`w-full ${state.liveState.active ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'} text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center`}>
                  Rip Pack <Zap size={10} className="ml-1 text-yellow-300"/> <span className="ml-0.5">{state.liveState.active ? GAME_CONFIG.energy.costs.liveRipPack : GAME_CONFIG.energy.costs.ripPack}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ScreenPackOpener = ({ packId, setId, onComplete }: { packId: string, setId: string, onComplete: () => void }) => {
  const { state, setState, dictionary, availableSets } = useGame();
  const [cards, setCards] = useState<CardInstance[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRipped, setIsRipped] = useState(false);
  const [ripProgress, setRipProgress] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isRumbling, setIsRumbling] = useState(false);
  const [showCardBack, setShowCardBack] = useState(false);
  const [error, setError] = useState("");

  const theme = getSetTheme(setId);
  const setName = availableSets.find(s => s.id.toUpperCase() === setId.toUpperCase())?.name || setId;

  useEffect(() => {
    if (state.desk.length + GAME_CONFIG.packConfiguration.cardsPerPack > GAME_CONFIG.world.deskCapacity) {
      setError(`Not enough desk space! Free up ${GAME_CONFIG.packConfiguration.cardsPerPack} slots before opening.`);
      return;
    }
    generatePack(setId, state.printRuns)
      .then(res => {
        setCards(res.pack);
        setState(prev => ({
          ...prev, sealed: prev.sealed.filter(s => s.id !== packId),
          printRuns: { ...prev.printRuns, ...res.runUpdates }
        }));
      })
      .catch(err => setError(err.message || "Pack generation failed due to missing card definitions."));
  }, [packId, setId]);

  const handleRip = () => {
    if (!cards || cards.length === 0 || isRipped) return;
    const firstCardData = dictionary[cards[0].cardId];
    const isUltraRare = firstCardData && (firstCardData.rarity === 'Legendary' || firstCardData.rarity === 'Enchanted');
    setIsRipped(true);
    
    if (isUltraRare) {
      setShowCardBack(true); setIsRumbling(true);
      setTimeout(() => {
        setIsRumbling(false); setIsFlipping(true);
        setTimeout(() => { setShowCardBack(false); setIsFlipping(false); }, 300);
      }, 1200);
    }
  };

  const handleNext = () => {
    if (!cards || isFlipping || isRumbling) return;
    if (currentIndex < cards.length - 1) {
      const nextCardData = dictionary[cards[currentIndex + 1].cardId];
      const isUltraRare = nextCardData && (nextCardData.rarity === 'Legendary' || nextCardData.rarity === 'Enchanted');

      setIsFlipping(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        if (isUltraRare) {
          setShowCardBack(true); setIsFlipping(false); setIsRumbling(true);
          setTimeout(() => {
            setIsRumbling(false); setIsFlipping(true);
            setTimeout(() => { setShowCardBack(false); setIsFlipping(false); }, 300);
          }, 1200);
        } else { setIsFlipping(false); }
      }, 300); 
    } else {
      setState(prev => ({ ...prev, desk: [...prev.desk, ...cards.map(c => ({ ...c, pileIndex: null }))] }));
      onComplete();
    }
  };

  if (error) return (
    <div className="p-8 text-center h-[70vh] flex flex-col justify-center items-center">
      <AlertTriangle size={48} className="text-red-500 mb-4" />
      <p className="text-white mb-6 font-bold">{error}</p>
      <button onClick={onComplete} className="bg-slate-700 px-6 py-2 rounded text-white">Back</button>
    </div>
  );

  if (!cards) return <div className="p-8 text-center h-full flex items-center justify-center text-slate-400">Generating pack...</div>;
  if (cards.length === 0) return (
    <div className="p-8 text-center h-[70vh] flex flex-col justify-center items-center">
      <AlertTriangle size={48} className="text-red-500 mb-4" />
      <p className="text-white mb-2 font-bold">Error: Pack generated 0 cards.</p>
      <button onClick={onComplete} className="bg-slate-700 px-6 py-2 rounded text-white font-bold">Back to Inventory</button>
    </div>
  );

  const currentCard = cards[currentIndex];
  const cardData = currentCard ? dictionary[currentCard.cardId] : null;
  const isCurrentUltraRare = cardData && (cardData.rarity === 'Legendary' || cardData.rarity === 'Enchanted');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center touch-none overflow-hidden">
      {!isRipped ? (
        <div className="text-center w-full max-w-sm px-8 relative">
           <div className="absolute top-0 left-0 right-0 -mt-16 h-16 flex flex-col items-center justify-end z-20 animate-pulse">
             <div className="text-white font-bold uppercase tracking-widest text-sm mb-2 drop-shadow-lg">Slide to Rip</div>
           </div>
          <div className={`w-full aspect-[2/3] bg-gradient-to-br ${theme.bg} rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 ${theme.border} relative overflow-hidden`}>
             
             {/* Tear Strip */}
             <div className="absolute top-4 left-0 right-0 h-8 bg-black/30 border-y-2 border-dashed border-white/20 z-30 flex items-center px-2">
                <input 
                  type="range" min="0" max="100" value={ripProgress} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    setRipProgress(val);
                    if (val >= 95) handleRip();
                  }} 
                  className="w-full accent-white h-2 appearance-none bg-transparent rounded outline-none" 
                  style={{ backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.8) ${ripProgress}%, transparent ${ripProgress}%)` }}
                />
             </div>

             <div className="absolute inset-0 bg-white/10 pointer-events-none" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 10%, 0 30%)'}}></div>
             <span className={`text-6xl font-bold ${theme.text} transform drop-shadow-2xl mb-4 pointer-events-none`}>{theme.symbol}</span>
            <span className={`font-bold text-2xl drop-shadow-md tracking-widest uppercase text-center px-4 ${theme.text} pointer-events-none`}>{setName}</span>
          </div>
          <button onClick={onComplete} className="text-slate-500 hover:text-white mt-8 px-6 py-2">Cancel</button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full p-4" onClick={handleNext}>
          <div className="text-slate-400 text-sm mb-6 font-mono tracking-widest">CARD {currentIndex + 1} OF {cards.length}</div>
          <div className="relative w-72 h-[26rem] perspective-1000">
            <div className={`w-full h-full relative transition-all duration-300 transform-style-3d ${isRumbling ? 'animate-rumble' : ''}`} style={{ transform: isFlipping ? 'rotateY(90deg) scale(0.9)' : 'rotateY(0deg) scale(1)' }}>
              {showCardBack ? (
                <div className="absolute inset-0 bg-blue-900 rounded-2xl border-4 border-slate-700 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-700 to-blue-950 shadow-inner">
                  <div className="w-20 h-20 rounded-full border-4 border-yellow-500/50 flex items-center justify-center"><div className="w-14 h-14 bg-yellow-500/20 rounded-full animate-pulse"></div></div>
                  <div className="text-blue-300/50 font-bold tracking-widest mt-6 uppercase text-lg">TCG</div>
                </div>
              ) : cardData ? (
                <div className={`absolute inset-0 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 ${currentCard.isFoil ? 'border-yellow-400' : 'border-slate-800'} bg-slate-800 flex items-center justify-center relative`}>
                  {currentCard.isFoil && <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/40 to-transparent animate-shimmer mix-blend-overlay"></div>}
                  {isCurrentUltraRare && !isFlipping && (
                    <div className="absolute -inset-8 pointer-events-none z-50 overflow-visible">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div key={i} className="absolute rounded-full bg-white" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, width: `${Math.random() * 4 + 2}px`, height: `${Math.random() * 4 + 2}px`, boxShadow: '0 0 10px 2px rgba(255, 255, 255, 0.9), 0 0 15px 5px rgba(236, 72, 153, 0.8)', animation: `sparkle ${Math.random() * 1 + 1}s infinite`, animationDelay: `${Math.random() * 2}s` }} />
                      ))}
                    </div>
                  )}
                  {cardData.imageUrl ? <img src={cardData.imageUrl} alt={cardData.name} className="w-full h-full object-contain bg-slate-900" /> : <div className="p-4 text-center"><div className="text-white font-bold text-xl">{cardData.name}</div><div className="text-slate-400 mt-2">{cardData.rarity}</div></div>}
                </div>
              ) : <div className="absolute inset-0 bg-slate-800 rounded-2xl border-4 border-slate-700 animate-pulse"></div>}
            </div>
          </div>
          <div className="mt-8 text-center min-h-[4rem]">
            {cardData && (
              <div className="animate-in slide-in-from-bottom-2 fade-in">
                <div className="text-white font-bold text-xl">{cardData.name}</div>
                <div className="flex items-center justify-center space-x-2 mt-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${cardData.rarity === 'Legendary' ? 'bg-yellow-500/20 text-yellow-400' : cardData.rarity === 'Enchanted' ? 'bg-fuchsia-500/20 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'bg-slate-800 text-slate-300'}`}>{cardData.rarity}</span>
                  {currentCard?.isFoil && <span className="text-xs bg-gradient-to-r from-yellow-300 to-yellow-600 text-yellow-900 px-3 py-1 rounded-full font-bold tracking-wider">FOIL</span>}
                </div>
              </div>
            )}
          </div>
          <div className="absolute bottom-8 text-slate-500 animate-pulse font-bold tracking-widest uppercase text-sm">{currentIndex < cards.length - 1 ? 'Tap to reveal next' : 'Tap to finish'}</div>
        </div>
      )}
    </div>
  );
};
