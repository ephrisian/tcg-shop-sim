import { applyAction, attackableSlots, canTarget, opponentOf, RULES, SLOTS } from './engine';
import type { Action, HRState, Slot } from './engine';

// Plays one complete turn for the active player using a simple greedy strategy.
export const planAiTurn = (start: HRState): Action[] => {
  const actions: Action[] = [];
  let state = start;
  const run = (action: Action): boolean => {
    const result = applyAction(state, action);
    if (result.error) return false;
    state = result.state;
    actions.push(action);
    return true;
  };

  if (state.phase === 'mulligan') {
    const who = state.mulliganDone[state.firstPlayer] ? opponentOf(state.firstPlayer) : state.firstPlayer;
    const hand = state.players[who].hand;
    run({ type: 'mulligan', uids: hand.filter(card => card.level >= 5).map(card => card.uid) });
    return actions;
  }

  const me = () => state.players[state.active];
  // Set the weakest card face down for the draw and later Lv-payment.
  const weakest = [...me().hand].sort((a, b) => a.level - b.level || a.power - b.power)[0];
  if (weakest && me().hand.length > 2) run({ type: 'baseDeploy', uid: weakest.uid });

  const slotPreference: Slot[] = ['front', 'wing1', 'wing2', 'back'];
  for (let guard = 0; guard < 6 && state.phase === 'action'; guard++) {
    const open = slotPreference.find(slot => !me().battle[slot]);
    if (!open) break;
    const callable = [...me().hand].sort((a, b) => b.power - a.power);
    let called = false;
    for (const card of callable) {
      if (card.level <= RULES.directCallMaxLevel) {
        if (run({ type: 'call', uid: card.uid, to: open })) { called = true; break; }
      } else {
        const payment = findPayment(state, card.level);
        if (payment && run({ type: 'call', uid: card.uid, to: open, retreatUids: payment })) { called = true; break; }
      }
    }
    if (!called) break;
  }

  // Pull base characters forward into empty battle slots.
  me().base.filter(entry => !entry.faceDown).forEach(entry => {
    const open = slotPreference.find(slot => !me().battle[slot]);
    if (open) run({ type: 'move', uid: entry.card.uid, to: open });
  });

  if (state.phase === 'action') run({ type: 'startBattle' });

  for (let guard = 0; guard < 8; guard++) {
    const ready = attackableSlots(state);
    if (!ready.length) break;
    const from = ready[0];
    const attacker = me().battle[from]!;
    const foe = state.players[opponentOf(state.active)];
    const options = SLOTS.filter(slot => canTarget(attacker.card.range, slot));
    const weakness = options.find(slot => !foe.battle[slot]);
    const winnable = options
      .filter(slot => foe.battle[slot] && foe.battle[slot]!.card.power < attacker.card.power)
      .sort((a, b) => foe.battle[b]!.card.power - foe.battle[a]!.card.power)[0];
    const target = weakness ?? winnable;
    if (!target || !run({ type: 'attack', from, target })) run({ type: 'skipAttack', from });
    if (state.phase === 'over') return actions;
  }

  run({ type: 'endTurn' });
  return actions;
};

// Finds field cards whose Levels sum exactly to the target, preferring set cards.
const findPayment = (state: HRState, level: number): string[] | null => {
  const player = state.players[state.active];
  const pool = [
    ...player.base.map(entry => ({ uid: entry.card.uid, level: entry.faceDown ? 1 : entry.card.level })),
    ...SLOTS.flatMap(slot => player.battle[slot] ? [{ uid: player.battle[slot]!.card.uid, level: player.battle[slot]!.card.level }] : []),
  ];
  const search = (index: number, remaining: number, picked: string[]): string[] | null => {
    if (remaining === 0) return picked;
    if (index >= pool.length || remaining < 0) return null;
    return search(index + 1, remaining - pool[index].level, [...picked, pool[index].uid]) || search(index + 1, remaining, picked);
  };
  return search(0, level, []);
};
