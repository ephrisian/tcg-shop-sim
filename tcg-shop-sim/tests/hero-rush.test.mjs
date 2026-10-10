import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const typescript = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const compiled = typescript.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const { applyAction, buildRandomDeck, makeRng, newGame, validateDeck, mulliganTurn } = require('../game/heroRush/engine.ts');
const { planAiTurn } = require('../game/heroRush/ai.ts');

const pool = ['bp01', 'sp01', 'sd01', 'sd02', 'sd03', 'sd04']
  .flatMap(code => JSON.parse(readFileSync(new URL(`../developer-tools/set-packages/herorush/${code}/set.json`, import.meta.url), 'utf8')).card_data)
  .filter(card => card.level > 0).map(card => ({
  defId: card.id, name: card.name, number: card.number, rarity: card.rarity, level: card.level,
  range: card.attack_range, power: card.battle_power, color: card.color, trait: card.trait, effect: card.effect, imageUrl: '',
}));

const def = (overrides = {}) => ({ defId: 'x', name: 'X', number: '', rarity: 'C', level: 1, range: 1, power: 1000, color: 'Red', trait: '', effect: '', imageUrl: '', ...overrides });
const fillerDeck = () => Array.from({ length: 50 }, (_, i) => def({ defId: `f${i}`, name: `F${i}` }));

const started = () => {
  let state = newGame({ decks: [fillerDeck(), fillerDeck()], seed: 1, firstPlayer: 0 });
  state = applyAction(state, { type: 'mulligan', uids: [] }).state;
  state = applyAction(state, { type: 'mulligan', uids: [] }).state;
  return state;
};

test('random decks are legal', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const deck = buildRandomDeck(pool, makeRng(seed));
    assert.ok(deck);
    assert.deepEqual(validateDeck(deck), []);
  }
});

test('setup: first player mulligans first and draws 2 on turn 1', () => {
  let state = newGame({ decks: [fillerDeck(), fillerDeck()], seed: 3, firstPlayer: 1 });
  assert.equal(mulliganTurn(state), 1);
  state = applyAction(state, { type: 'mulligan', uids: [state.players[1].hand[0].uid] }).state;
  assert.equal(mulliganTurn(state), 0);
  state = applyAction(state, { type: 'mulligan', uids: [] }).state;
  assert.equal(state.phase, 'action');
  assert.equal(state.active, 1);
  assert.equal(state.players[1].hand.length, 8);
});

test('first player gets only one call on turn 1 and skips battle', () => {
  let state = started();
  const [a, b] = state.players[0].hand;
  state = applyAction(state, { type: 'call', uid: a.uid, to: 'front' }).state;
  assert.match(applyAction(state, { type: 'call', uid: b.uid, to: 'wing1' }).error, /No Action Calls/);
  state = applyAction(state, { type: 'startBattle' }).state;
  assert.ok(applyAction(state, { type: 'attack', from: 'front', target: 'front' }).error);
});

test('high-level calls must retreat exactly matching Levels', () => {
  let state = started();
  state.turn = 2;
  state.active = 0;
  const me = state.players[0];
  me.hand = [{ ...def({ level: 4, name: 'Big' }), uid: 'big' }, { ...def({ name: 'A' }), uid: 'a' }, { ...def({ name: 'B', level: 3 }), uid: 'b' }];
  me.base = [{ card: { ...def({ name: 'S1' }), uid: 's1' }, faceDown: true, enteredTurn: 1, movedTurn: -1 }];
  me.battle.front = { card: { ...def({ name: 'F', level: 2 }), uid: 'f' }, enteredTurn: 1, movedTurn: -1, attackedTurn: -1 };
  assert.match(applyAction(state, { type: 'call', uid: 'big', to: 'wing1', retreatUids: ['s1'] }).error, /exactly 4/);
  const result = applyAction(state, { type: 'call', uid: 'big', to: 'wing1', retreatUids: ['s1', 'f', 'a'].slice(0, 2) });
  assert.match(result.error, /exactly 4/);
  me.base.push({ card: { ...def({ name: 'S2' }), uid: 's2' }, faceDown: true, enteredTurn: 1, movedTurn: -1 });
  const ok = applyAction(state, { type: 'call', uid: 'big', to: 'wing1', retreatUids: ['s1', 's2', 'f'] });
  assert.equal(ok.error, undefined);
  assert.equal(ok.state.players[0].battle.wing1.card.uid, 'big');
  assert.equal(ok.state.players[0].retreat.length, 3);
});

test('attacking a Weakness scores a Rush Point; ties retreat both', () => {
  let state = started();
  state.turn = 2;
  state.active = 0;
  state.phase = 'battle';
  const unit = (uid, power) => ({ card: { ...def({ power, range: 3 }), uid }, enteredTurn: 1, movedTurn: -1, attackedTurn: -1 });
  state.players[0].battle.front = unit('mine', 2000);
  state.players[0].battle.back = unit('mine2', 2000);
  state.players[1].battle.front = unit('theirs', 2000);
  let result = applyAction(state, { type: 'attack', from: 'front', target: 'front' });
  assert.equal(result.state.players[0].battle.front, null);
  assert.equal(result.state.players[1].battle.front, null);
  result = applyAction(result.state, { type: 'attack', from: 'back', target: 'back' });
  assert.equal(result.state.players[0].timeline, 1);
});

test('attack order is FRONT before BACK', () => {
  let state = started();
  state.turn = 2;
  state.active = 0;
  state.phase = 'battle';
  const unit = uid => ({ card: { ...def({ range: 3 }), uid }, enteredTurn: 1, movedTurn: -1, attackedTurn: -1 });
  state.players[0].battle.front = unit('a');
  state.players[0].battle.back = unit('b');
  assert.ok(applyAction(state, { type: 'attack', from: 'back', target: 'front' }).error);
});

test('nine Rush Points win the game', () => {
  let state = started();
  state.turn = 2;
  state.active = 0;
  state.phase = 'battle';
  state.players[0].timeline = 8;
  state.players[0].battle.front = { card: { ...def({ range: 1 }), uid: 'a' }, enteredTurn: 1, movedTurn: -1, attackedTurn: -1 };
  const result = applyAction(state, { type: 'attack', from: 'front', target: 'front' });
  assert.equal(result.state.winner, 0);
});

test('AI vs AI finishes a game with only legal actions', () => {
  const rng = makeRng(42);
  let state = newGame({ decks: [buildRandomDeck(pool, rng), buildRandomDeck(pool, rng)], seed: 7 });
  for (let i = 0; i < 400 && state.phase !== 'over'; i++) {
    const plan = planAiTurn(state);
    assert.ok(plan.length > 0);
    for (const action of plan) {
      const result = applyAction(state, action);
      assert.equal(result.error, undefined, `${action.type}: ${result.error}`);
      state = result.state;
    }
  }
  assert.equal(state.phase, 'over');
});
