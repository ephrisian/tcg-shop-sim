import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../game/state';
import { heroRushPool } from '../game/heroRush/cards';
import { planAiTurn } from '../game/heroRush/ai';
import {
  Action, applyAction, attackableSlots, buildRandomDeck, canTarget, fieldLevels, HRCard, HRState, isBattleSkipped,
  makeRng, mulliganTurn, newGame, opponentOf, RULES, Slot, SLOTS, callsAllowed,
} from '../game/heroRush/engine';

type Mode = 'ai' | 'hotseat';
const SLOT_LABEL: Record<Slot, string> = { front: 'FRONT', wing1: 'WING', wing2: 'WING', back: 'BACK' };

const CardTile = ({ card, hidden, selected, onClick, note }: { card?: HRCard | null; hidden?: boolean; selected?: boolean; onClick?: () => void; note?: string }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    title={card && !hidden ? `${card.name}\n${card.effect}` : undefined}
    className={`relative h-28 w-20 shrink-0 overflow-hidden rounded border text-left text-[10px] leading-tight ${selected ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-slate-600'} ${card && !hidden ? 'bg-slate-800' : 'bg-slate-900'} ${onClick ? 'hover:border-blue-400' : ''}`}
  >
    {card && !hidden ? (
      <>
        {card.imageUrl && <img src={card.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
        <span className="relative block bg-slate-950/80 p-0.5 font-bold text-white">{card.name}</span>
        <span className="absolute bottom-0 left-0 right-0 bg-slate-950/85 p-0.5 text-slate-200">
          Lv{card.level} · {card.power} · R{card.range}
        </span>
      </>
    ) : (
      <span className="flex h-full items-center justify-center text-slate-500">{hidden ? 'SET' : note || ''}</span>
    )}
  </button>
);

export const ScreenHeroRush = () => {
  const { dictionary } = useGame();
  const pool = useMemo(() => heroRushPool(dictionary), [dictionary]);
  const [game, setGame] = useState<HRState | null>(null);
  const [mode, setMode] = useState<Mode>('ai');
  const [message, setMessage] = useState('');
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [payment, setPayment] = useState<string[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [mulliganPick, setMulliganPick] = useState<string[]>([]);
  const [handoff, setHandoff] = useState(false);

  const start = (chosen: Mode) => {
    const rng = makeRng(Date.now());
    const decks = [buildRandomDeck(pool, rng), buildRandomDeck(pool, rng)];
    if (!decks[0] || !decks[1]) {
      setMessage('Not enough Hero Rush cards to build a legal deck. Import the Hero Rush set first.');
      return;
    }
    setMode(chosen);
    setGame(newGame({ decks: [decks[0], decks[1]], seed: Date.now() }));
    setMessage('');
    setSelectedHand(null); setPayment([]); setSelectedField(null); setMulliganPick([]); setHandoff(false);
  };

  const viewer: 0 | 1 = game && mode === 'hotseat' ? (game.phase === 'mulligan' ? mulliganTurn(game) ?? 0 : game.active) : 0;

  const dispatch = (action: Action, afterTurnChange = false) => {
    if (!game) return;
    const result = applyAction(game, action);
    if (result.error) { setMessage(result.error); return; }
    setMessage('');
    setGame(result.state);
    setSelectedHand(null); setPayment([]); setSelectedField(null); setMulliganPick([]);
    if (mode === 'hotseat' && (afterTurnChange || action.type === 'mulligan') && result.state.phase !== 'over') setHandoff(true);
  };

  // The AI (Player 2) resolves its mulligan and full turns automatically.
  useEffect(() => {
    if (!game || mode !== 'ai' || game.phase === 'over') return;
    const aiTurn = game.phase === 'mulligan' ? mulliganTurn(game) === 1 : game.active === 1;
    if (!aiTurn) return;
    const timer = setTimeout(() => {
      let state = game;
      for (const action of planAiTurn(game)) {
        const result = applyAction(state, action);
        if (!result.error) state = result.state;
      }
      setGame(state);
    }, 700);
    return () => clearTimeout(timer);
  }, [game, mode]);

  if (!game) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6 text-white">
        <h2 className="text-2xl font-bold">Marvel Hero Rush</h2>
        <p className="text-sm text-slate-300">
          Each side gets a random legal 50-card deck (2 colors max, 3 copies max) from the Hero Rush cards in the catalog.
          First to 9 Rush Points wins. Card effect text is shown but not yet scripted.
        </p>
        <p className="text-xs text-slate-400">{pool.length} Hero Rush character cards available.</p>
        {message && <p className="text-sm text-red-400">{message}</p>}
        <div className="flex gap-3">
          <button onClick={() => start('ai')} className="rounded bg-blue-600 px-4 py-2 font-bold">Play vs AI</button>
          <button onClick={() => start('hotseat')} className="rounded bg-slate-700 px-4 py-2 font-bold">Hot-seat (2 players)</button>
        </div>
      </div>
    );
  }

  if (handoff) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-white">
        <p className="text-lg">Pass the device to Player {(game.phase === 'mulligan' ? mulliganTurn(game) ?? 0 : game.active) + 1}</p>
        <button onClick={() => setHandoff(false)} className="rounded bg-blue-600 px-4 py-2 font-bold">Ready</button>
      </div>
    );
  }

  const me = game.players[viewer];
  const foe = game.players[opponentOf(viewer)];
  const myTurn = game.phase !== 'mulligan' && game.phase !== 'over' && game.active === viewer;
  const mulliganing = game.phase === 'mulligan' && mulliganTurn(game) === viewer;
  const hand = me.hand.find(card => card.uid === selectedHand);
  const needsPayment = !!hand && hand.level > RULES.directCallMaxLevel;
  const paymentTotal = payment.reduce((sum, uid) => sum + (fieldLevels(me).find(item => item.uid === uid)?.level || 0), 0);
  const attackable = myTurn ? attackableSlots(game) : [];
  const attackerSlot = SLOTS.find(slot => me.battle[slot]?.card.uid === selectedField && attackable.includes(slot));
  const attackerCard = attackerSlot ? me.battle[attackerSlot]!.card : null;

  const fieldClick = (uid: string) => {
    if (!myTurn) return;
    if (needsPayment) {
      setPayment(current => current.includes(uid) ? current.filter(item => item !== uid) : [...current, uid]);
    } else {
      setSelectedField(current => current === uid ? null : uid);
    }
  };

  const callTo = (to: Slot | 'base') =>
    hand && dispatch({ type: 'call', uid: hand.uid, to, retreatUids: needsPayment ? payment : undefined });

  const renderBattle = (player: typeof me, own: boolean) => {
    const cell = (slot: Slot) => {
      const unit = player.battle[slot];
      const targetable = !own && attackerCard && canTarget(attackerCard.range, slot);
      const placeable = own && myTurn && ((hand && !needsPayment && !unit) || (selectedField && !unit && game.phase === 'action'));
      return (
        <div key={slot} className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-slate-400">{SLOT_LABEL[slot]}</span>
          <CardTile
            card={unit?.card}
            note={targetable ? 'WEAKNESS' : 'empty'}
            selected={unit ? selectedField === unit.card.uid || payment.includes(unit.card.uid) : false}
            onClick={
              targetable ? () => dispatch({ type: 'attack', from: attackerSlot!, target: slot })
              : own && unit ? () => fieldClick(unit.card.uid)
              : placeable ? () => (hand ? callTo(slot) : dispatch({ type: 'move', uid: selectedField!, to: slot }))
              : undefined
            }
          />
        </div>
      );
    };
    // Three rows per side: Front, the two Wings, then Back; the opponent's rows are mirrored.
    const rows: Slot[][] = [['front'], ['wing1', 'wing2'], ['back']];
    const ordered = own ? rows : [...rows].reverse();
    return (
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 justify-items-center">
        {ordered.map((row, index) => row.length === 1
          ? <React.Fragment key={index}><div />{cell(row[0])}<div /></React.Fragment>
          : <React.Fragment key={index}>{cell(row[0])}<div />{cell(row[1])}</React.Fragment>)}
      </div>
    );
  };

  const ZoneBox = ({ label, count, cards }: { label: string; count: number; cards?: HRCard[] }) => (
    <div className="flex w-20 flex-col items-center rounded border border-slate-700 bg-slate-950/60 p-1 text-[10px] text-slate-300" title={cards?.slice(-5).map(card => card.name).join('\n')}>
      <span className="font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-lg font-bold text-white">{count}</span>
    </div>
  );

  const renderTimeline = (player: typeof me) => (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase text-slate-400">Timeline</span>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: RULES.rushPointsToWin }, (_, index) => (
          <div key={index} className={`h-6 w-4 rounded-sm border text-center text-[9px] leading-6 ${index < player.timeline ? 'border-yellow-400 bg-yellow-500 font-bold text-slate-900' : 'border-slate-700 bg-slate-950 text-slate-600'}`}>{index + 1}</div>
        ))}
      </div>
    </div>
  );

  const renderSide = (player: typeof me, own: boolean) => (
    <div className="flex items-start justify-center gap-3">
      <div className="flex flex-col gap-1">
        <ZoneBox label="Deck" count={player.deck.length} />
        <ZoneBox label="Retreat" count={player.retreat.length} cards={player.retreat} />
        <ZoneBox label="Void" count={player.void.length} cards={player.void} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {own ? renderBattle(player, true) : renderBase(player, false)}
        <div className="text-center text-[10px] font-bold uppercase text-slate-500">{own ? `Base ${player.base.length}/${RULES.baseSize}` : `Battle Zone`}</div>
        {own ? renderBase(player, true) : renderBattle(player, false)}
      </div>
      {renderTimeline(player)}
    </div>
  );

  const renderBase = (player: typeof me, own: boolean) => (
    <div className="flex flex-wrap justify-center gap-1">
      {player.base.length === 0 && <span className="text-xs text-slate-500">BASE empty</span>}
      {player.base.map(entry => (
        <CardTile
          key={entry.card.uid}
          card={entry.card}
          hidden={entry.faceDown && !own}
          selected={selectedField === entry.card.uid || payment.includes(entry.card.uid)}
          onClick={own && myTurn ? () => fieldClick(entry.card.uid) : undefined}
        />
      ))}
    </div>
  );

  const selectedIsBattle = SLOTS.some(slot => me.battle[slot]?.card.uid === selectedField);
  const selectedIsBase = me.base.some(entry => entry.card.uid === selectedField);
  const recentLog = game.log.slice(-6);

  return (
    <div className="mx-auto max-w-4xl space-y-3 p-3 text-white">
      <div className="flex items-center justify-between text-sm">
        <span>Turn {game.turn} · {game.phase === 'over' ? 'Game over' : game.phase === 'mulligan' ? 'Mulligan' : `Player ${game.active + 1} · ${game.phase}`}</span>
        <button onClick={() => setGame(null)} className="rounded bg-slate-700 px-2 py-1 text-xs">Quit</button>
      </div>
      {game.phase === 'over' && (
        <div className="rounded border border-yellow-600 bg-yellow-950/40 p-3 text-center font-bold text-yellow-300">
          Player {game.winner! + 1} wins! {game.winReason}
        </div>
      )}

      <section className="rounded border border-slate-700 bg-slate-900 p-2">
        <div className="mb-1 flex justify-between text-xs text-slate-300">
          <span>Opponent · Hand {foe.hand.length}</span>
          <span>Rush Points {foe.timeline}/{RULES.rushPointsToWin}</span>
        </div>
        {renderSide(foe, false)}
      </section>

      <section className="rounded border border-slate-700 bg-slate-900 p-2">
        <div className="mb-1 flex justify-between text-xs text-slate-300">
          <span>You (Player {viewer + 1})</span>
          <span>Rush Points {me.timeline}/{RULES.rushPointsToWin} · Calls {game.callsThisTurn}/{callsAllowed(game)}</span>
        </div>
        {renderSide(me, true)}
      </section>

      {message && <p className="text-sm text-red-400">{message}</p>}

      {mulliganing && (
        <div className="rounded border border-slate-700 bg-slate-900 p-2 text-sm">
          Pick cards to put on the bottom and redraw, then confirm.
          <button onClick={() => dispatch({ type: 'mulligan', uids: mulliganPick })} className="ml-2 rounded bg-blue-600 px-3 py-1 font-bold">
            Mulligan {mulliganPick.length}
          </button>
        </div>
      )}

      {myTurn && (
        <div className="flex flex-wrap gap-2 text-sm">
          {game.phase === 'action' && (
            <>
              {hand && !needsPayment && <button onClick={() => callTo('base')} className="rounded bg-slate-700 px-3 py-1">Call to BASE</button>}
              {hand && <button onClick={() => dispatch({ type: 'baseDeploy', uid: hand.uid })} className="rounded bg-slate-700 px-3 py-1">Set in BASE (+1 draw)</button>}
              {hand && needsPayment && (
                <span className="rounded bg-slate-800 px-3 py-1 text-xs">
                  Lv{hand.level}: pick field cards ({paymentTotal}/{hand.level}), then choose a slot:
                  {SLOTS.map(slot => (
                    <button key={slot} onClick={() => callTo(slot)} className="ml-1 rounded bg-blue-700 px-2 py-0.5">{SLOT_LABEL[slot]}</button>
                  ))}
                  <button onClick={() => callTo('base')} className="ml-1 rounded bg-blue-700 px-2 py-0.5">BASE</button>
                </span>
              )}
              {selectedField && selectedIsBattle && <button onClick={() => dispatch({ type: 'move', uid: selectedField, to: 'base' })} className="rounded bg-slate-700 px-3 py-1">Move to BASE</button>}
              {selectedField && selectedIsBase && <span className="px-1 py-1 text-xs text-slate-400">Click an empty BATTLE slot to move there</span>}
              <button onClick={() => dispatch({ type: 'startBattle' })} className="rounded bg-red-700 px-3 py-1 font-bold">
                {isBattleSkipped(game) ? 'Skip Battle' : 'Go to Battle'}
              </button>
            </>
          )}
          {game.phase === 'battle' && (
            <>
              {!isBattleSkipped(game) && attackerCard && <span className="py-1 text-xs text-slate-300">Click an opponent card or WEAKNESS to attack with {attackerCard.name}.</span>}
              {!isBattleSkipped(game) && attackable.length > 0 && !attackerCard && <span className="py-1 text-xs text-slate-300">Select an attacker ({attackable.map(slot => SLOT_LABEL[slot]).join('/')} next).</span>}
              {attackerCard && <button onClick={() => dispatch({ type: 'skipAttack', from: attackerSlot! })} className="rounded bg-slate-700 px-3 py-1">Skip this attack</button>}
              <button onClick={() => dispatch({ type: 'endTurn' }, true)} className="rounded bg-green-700 px-3 py-1 font-bold">End Turn</button>
            </>
          )}
        </div>
      )}

      <section className="rounded border border-slate-700 bg-slate-900 p-2">
        <div className="mb-1 text-xs text-slate-400">Hand ({me.hand.length})</div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {me.hand.map(card => (
            <CardTile
              key={card.uid}
              card={card}
              selected={mulliganing ? mulliganPick.includes(card.uid) : selectedHand === card.uid}
              onClick={
                mulliganing ? () => setMulliganPick(current => current.includes(card.uid) ? current.filter(uid => uid !== card.uid) : [...current, card.uid])
                : myTurn && game.phase === 'action' ? () => { setPayment([]); setSelectedField(null); setSelectedHand(current => current === card.uid ? null : card.uid); }
                : undefined
              }
            />
          ))}
        </div>
      </section>

      <div className="space-y-0.5 text-[11px] text-slate-400">
        {recentLog.map((line, index) => <div key={index}>{line}</div>)}
      </div>
    </div>
  );
};
