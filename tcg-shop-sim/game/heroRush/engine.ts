// Marvel TCG Hero Rush core rules engine. Pure functions over a plain-data state.
// Card effect text is carried on cards but not scripted; only the core rules are enforced.
// The counter step is omitted because it only matters for scripted COUNTER effects.

export type Slot = 'front' | 'wing1' | 'wing2' | 'back';
export const SLOTS: Slot[] = ['front', 'wing1', 'wing2', 'back'];
export const SLOT_DEPTH: Record<Slot, number> = { front: 1, wing1: 2, wing2: 2, back: 3 };
const ATTACK_RANK: Record<Slot, number> = { front: 0, wing1: 1, wing2: 1, back: 2 };

export const RULES = {
  deckSize: 50,
  rushDeckSize: 9,
  maxColors: 2,
  maxCopies: 3,
  startingHand: 6,
  drawPerTurn: 2,
  baseSize: 6,
  maxCallsPerTurn: 3,
  handLimit: 9,
  rushPointsToWin: 9,
  directCallMaxLevel: 3,
} as const;

export interface HRCardDef {
  defId: string;
  name: string;
  number: string;
  rarity: string;
  level: number;
  range: number;
  power: number;
  color: string;
  trait: string;
  effect: string;
  imageUrl: string;
}

export interface HRCard extends HRCardDef { uid: string }

export interface Unit { card: HRCard; enteredTurn: number; movedTurn: number; attackedTurn: number }
export interface BaseEntry { card: HRCard; faceDown: boolean; enteredTurn: number; movedTurn: number }

export interface HRPlayer {
  deck: HRCard[];
  hand: HRCard[];
  battle: Record<Slot, Unit | null>;
  base: BaseEntry[];
  retreat: HRCard[];
  void: HRCard[];
  timeline: number;
}

export type Phase = 'mulligan' | 'action' | 'battle' | 'over';

export interface HRState {
  players: [HRPlayer, HRPlayer];
  active: 0 | 1;
  firstPlayer: 0 | 1;
  turn: number;
  phase: Phase;
  mulliganDone: [boolean, boolean];
  callsThisTurn: number;
  baseDeployedThisTurn: boolean;
  adjustedThisTurn: boolean;
  winner: 0 | 1 | null;
  winReason: string;
  log: string[];
  rngSeed: number;
}

export type Action =
  | { type: 'mulligan'; uids: string[] }
  | { type: 'baseDeploy'; uid: string }
  | { type: 'call'; uid: string; to: Slot | 'base'; retreatUids?: string[] }
  | { type: 'move'; uid: string; to: Slot | 'base' }
  | { type: 'startBattle' }
  | { type: 'adjust'; order: [Slot, Slot, Slot, Slot] }
  | { type: 'attack'; from: Slot; target: Slot }
  | { type: 'skipAttack'; from: Slot }
  | { type: 'endTurn'; discard?: string[] };

export type Rng = () => number;

export const makeRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const shuffle = <T>(items: T[], rng: Rng): T[] => {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// --- Deck construction ---

export const validateDeck = (cards: Pick<HRCardDef, 'name' | 'color'>[]): string[] => {
  const errors: string[] = [];
  if (cards.length !== RULES.deckSize) errors.push(`Deck must have ${RULES.deckSize} cards (has ${cards.length}).`);
  const colors = new Set(cards.map(card => card.color).filter(Boolean));
  if (colors.size > RULES.maxColors) errors.push(`Deck may use at most ${RULES.maxColors} colors (uses ${colors.size}).`);
  const counts = new Map<string, number>();
  cards.forEach(card => counts.set(card.name, (counts.get(card.name) || 0) + 1));
  counts.forEach((count, name) => {
    if (count > RULES.maxCopies) errors.push(`${name} has ${count} copies (max ${RULES.maxCopies}).`);
  });
  return errors;
};

// Builds a legal random deck from a character card pool. Returns null if the pool cannot fill one.
export const buildRandomDeck = (pool: HRCardDef[], rng: Rng): HRCardDef[] | null => {
  const colors = shuffle(Array.from(new Set(pool.map(card => card.color).filter(Boolean))), rng);
  const combos: string[][] = [];
  colors.forEach((first, i) => colors.slice(i + 1).forEach(second => combos.push([first, second])));
  colors.forEach(color => combos.push([color]));
  for (const combo of shuffle(combos, rng)) {
    const byName = new Map<string, HRCardDef[]>();
    pool.filter(card => combo.includes(card.color)).forEach(card => {
      byName.set(card.name, [...(byName.get(card.name) || []), card]);
    });
    const names = shuffle(Array.from(byName.keys()), rng);
    const deck: HRCardDef[] = [];
    for (const limit of [2, RULES.maxCopies]) {
      for (const name of names) {
        const options = byName.get(name)!;
        let have = deck.filter(card => card.name === name).length;
        while (have < limit && deck.length < RULES.deckSize) {
          deck.push(options[Math.floor(rng() * options.length)]);
          have++;
        }
      }
    }
    if (deck.length === RULES.deckSize) return deck;
  }
  return null;
};

// --- State helpers ---

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const opponentOf = (index: 0 | 1): 0 | 1 => (index === 0 ? 1 : 0);
const emptyBattle = (): Record<Slot, Unit | null> => ({ front: null, wing1: null, wing2: null, back: null });
const logLine = (state: HRState, text: string) => { state.log.push(`T${state.turn}: ${text}`); };

function finish(state: HRState, winner: 0 | 1, reason: string) {
  state.phase = 'over';
  state.winner = winner;
  state.winReason = reason;
  logLine(state, `Player ${winner + 1} wins. ${reason}`);
}

function draw(state: HRState, who: 0 | 1, count: number) {
  const player = state.players[who];
  for (let i = 0; i < count; i++) {
    const card = player.deck.shift();
    if (card) player.hand.push(card);
  }
  // A player whose deck reaches 0 loses.
  if (state.phase !== 'over' && player.deck.length === 0) finish(state, opponentOf(who), `Player ${who + 1}'s deck ran out.`);
}

export interface NewGameOptions {
  decks: [HRCardDef[], HRCardDef[]];
  seed?: number;
  firstPlayer?: 0 | 1;
}

export const newGame = ({ decks, seed = Date.now(), firstPlayer }: NewGameOptions): HRState => {
  const rng = makeRng(seed);
  let uid = 0;
  const players = decks.map((defs, owner) => {
    const deck = shuffle(defs.map(def => ({ ...def, uid: `p${owner}-c${uid++}` })), rng);
    const hand = deck.splice(0, RULES.startingHand);
    return { deck, hand, battle: emptyBattle(), base: [], retreat: [], void: [], timeline: 0 } as HRPlayer;
  }) as [HRPlayer, HRPlayer];
  const first = firstPlayer ?? (rng() < 0.5 ? 0 : 1);
  return {
    players, active: first, firstPlayer: first, turn: 1, phase: 'mulligan', mulliganDone: [false, false],
    callsThisTurn: 0, baseDeployedThisTurn: false, adjustedThisTurn: false, winner: null, winReason: '',
    log: [`Player ${first + 1} goes first.`], rngSeed: Math.floor(rng() * 2 ** 31),
  };
};

// Player whose mulligan decision is pending (the first player decides first).
export const mulliganTurn = (state: HRState): 0 | 1 | null => {
  if (state.phase !== 'mulligan') return null;
  return state.mulliganDone[state.firstPlayer] ? opponentOf(state.firstPlayer) : state.firstPlayer;
};

// --- Rules queries ---

export const callsAllowed = (state: HRState): number =>
  state.turn === 1 ? 1 : RULES.maxCallsPerTurn;

// Assumption: Range N reaches opposing positions up to depth N (FRONT=1, WING=2, BACK=3).
export const canTarget = (range: number, target: Slot): boolean => SLOT_DEPTH[target] <= range;

export const isBattleSkipped = (state: HRState): boolean => state.turn === 1;

export const fieldLevels = (player: HRPlayer): { uid: string; level: number }[] => [
  ...SLOTS.flatMap(slot => player.battle[slot] ? [{ uid: player.battle[slot]!.card.uid, level: player.battle[slot]!.card.level }] : []),
  ...player.base.map(entry => ({ uid: entry.card.uid, level: entry.faceDown ? 1 : entry.card.level })),
];

// Units that may still attack, honoring the FRONT -> WING -> BACK order.
export const attackableSlots = (state: HRState): Slot[] => {
  if (state.phase !== 'battle' || isBattleSkipped(state)) return [];
  const me = state.players[state.active];
  const pending = SLOTS.filter(slot => me.battle[slot] && me.battle[slot]!.attackedTurn !== state.turn);
  if (!pending.length) return [];
  const lowest = Math.min(...pending.map(slot => ATTACK_RANK[slot]));
  return pending.filter(slot => ATTACK_RANK[slot] === lowest);
};

// --- Applying actions ---

export interface ActionResult { state: HRState; error?: string }

const removeFromField = (player: HRPlayer, uid: string): HRCard | null => {
  for (const slot of SLOTS) {
    if (player.battle[slot]?.card.uid === uid) {
      const { card } = player.battle[slot]!;
      player.battle[slot] = null;
      return card;
    }
  }
  const index = player.base.findIndex(entry => entry.card.uid === uid);
  return index >= 0 ? player.base.splice(index, 1)[0].card : null;
};

function beginTurn(state: HRState) {
  state.callsThisTurn = 0;
  state.baseDeployedThisTurn = false;
  state.adjustedThisTurn = false;
  logLine(state, `Player ${state.active + 1}'s turn begins.`);
  draw(state, state.active, RULES.drawPerTurn);
}

export const applyAction = (previous: HRState, action: Action): ActionResult => {
  const fail = (error: string): ActionResult => ({ state: previous, error });
  if (previous.phase === 'over') return fail('The game is over.');
  const state = clone(previous);
  const me = state.players[state.active];
  const foe = state.players[opponentOf(state.active)];
  const label = `Player ${state.active + 1}`;

  switch (action.type) {
    case 'mulligan': {
      const who = mulliganTurn(state);
      if (who === null) return fail('Not in the mulligan step.');
      const player = state.players[who];
      const uids = Array.from(new Set(action.uids));
      const chosen = player.hand.filter(card => uids.includes(card.uid));
      if (chosen.length !== uids.length) return fail('Unknown card selected.');
      player.hand = player.hand.filter(card => !uids.includes(card.uid));
      player.deck.push(...chosen);
      player.hand.push(...player.deck.splice(0, chosen.length));
      player.deck = shuffle(player.deck, makeRng(state.rngSeed++));
      state.mulliganDone[who] = true;
      logLine(state, `Player ${who + 1} mulligans ${chosen.length} card(s).`);
      if (state.mulliganDone[0] && state.mulliganDone[1]) {
        state.phase = 'action';
        state.active = state.firstPlayer;
        beginTurn(state);
      }
      return { state };
    }
    case 'baseDeploy': {
      if (state.phase !== 'action') return fail('Base Deploy is an Action phase move.');
      if (state.baseDeployedThisTurn) return fail('Base Deploy is once per turn.');
      if (me.base.length >= RULES.baseSize) return fail('BASE is full.');
      const card = me.hand.find(item => item.uid === action.uid);
      if (!card) return fail('Card is not in hand.');
      me.hand = me.hand.filter(item => item.uid !== action.uid);
      me.base.push({ card, faceDown: true, enteredTurn: state.turn, movedTurn: -1 });
      state.baseDeployedThisTurn = true;
      logLine(state, `${label} sets a card in BASE and draws 1.`);
      draw(state, state.active, 1);
      return { state };
    }
    case 'call': {
      if (state.phase !== 'action') return fail('Calls are an Action phase move.');
      if (state.callsThisTurn >= callsAllowed(state)) return fail('No Action Calls left this turn.');
      const card = me.hand.find(item => item.uid === action.uid);
      if (!card) return fail('Card is not in hand.');
      const retreatUids = action.retreatUids || [];
      if (card.level <= RULES.directCallMaxLevel && retreatUids.length) return fail('Lv3 or below cards are called without retreating.');
      if (card.level > RULES.directCallMaxLevel) {
        const levels = fieldLevels(me);
        const picked = retreatUids.map(uid => levels.find(item => item.uid === uid));
        if (picked.some(item => !item) || new Set(retreatUids).size !== retreatUids.length) return fail('Invalid cards chosen to retreat.');
        const total = picked.reduce((sum, item) => sum + item!.level, 0);
        if (total !== card.level) return fail(`Retreated Levels must total exactly ${card.level} (got ${total}).`);
        retreatUids.forEach(uid => {
          const removed = removeFromField(me, uid);
          if (removed) me.retreat.push(removed);
        });
      }
      if (action.to === 'base') {
        if (me.base.length >= RULES.baseSize) return fail('BASE is full.');
        me.base.push({ card, faceDown: false, enteredTurn: state.turn, movedTurn: -1 });
      } else {
        if (me.battle[action.to]) return fail(`${action.to} is occupied.`);
        me.battle[action.to] = { card, enteredTurn: state.turn, movedTurn: -1, attackedTurn: -1 };
      }
      me.hand = me.hand.filter(item => item.uid !== action.uid);
      state.callsThisTurn++;
      logLine(state, `${label} calls ${card.name} (Lv${card.level}) to ${action.to}.`);
      return { state };
    }
    case 'move': {
      if (state.phase !== 'action') return fail('Moves are an Action phase move.');
      const slot = SLOTS.find(item => me.battle[item]?.card.uid === action.uid);
      const baseIndex = me.base.findIndex(entry => entry.card.uid === action.uid);
      const entry = slot ? me.battle[slot]! : me.base[baseIndex];
      if (!entry) return fail('Card is not on the field.');
      if ('faceDown' in entry && entry.faceDown) return fail('Set cards cannot move.');
      if (entry.enteredTurn === state.turn) return fail('A card that entered this turn cannot move.');
      if (entry.movedTurn === state.turn) return fail('Each card may move once per turn.');
      if (slot && action.to !== 'base') return fail('Move between BATTLE and BASE only (use Adjust to reorder BATTLE).');
      if (!slot && action.to === 'base') return fail('Card is already in BASE.');
      if (slot) {
        if (me.base.length >= RULES.baseSize) return fail('BASE is full.');
        me.battle[slot] = null;
        me.base.push({ card: entry.card, faceDown: false, enteredTurn: entry.enteredTurn, movedTurn: state.turn });
      } else {
        const to = action.to as Slot;
        if (me.battle[to]) return fail(`${to} is occupied.`);
        me.base.splice(baseIndex, 1);
        me.battle[to] = { card: entry.card, enteredTurn: entry.enteredTurn, movedTurn: state.turn, attackedTurn: -1 };
      }
      logLine(state, `${label} moves ${entry.card.name} to ${action.to}.`);
      return { state };
    }
    case 'startBattle': {
      if (state.phase !== 'action') return fail('Already past the Action phase.');
      state.phase = 'battle';
      logLine(state, isBattleSkipped(state) ? `${label} skips the Battle phase.` : `${label} enters the Battle phase.`);
      return { state };
    }
    case 'adjust': {
      if (state.phase !== 'battle' || isBattleSkipped(state)) return fail('Adjusting happens at the start of an active Battle phase.');
      if (state.adjustedThisTurn) return fail('You may adjust once per turn.');
      if (SLOTS.some(slot => me.battle[slot]?.attackedTurn === state.turn)) return fail('Adjust before attacking.');
      if (new Set(action.order).size !== 4 || action.order.some(slot => !SLOTS.includes(slot))) return fail('Invalid arrangement.');
      const before = clone(me.battle);
      SLOTS.forEach((slot, i) => { me.battle[slot] = before[action.order[i]]; });
      state.adjustedThisTurn = true;
      logLine(state, `${label} adjusts their BATTLE positions.`);
      return { state };
    }
    case 'skipAttack': {
      if (!attackableSlots(state).includes(action.from)) return fail('That card cannot act now.');
      me.battle[action.from]!.attackedTurn = state.turn;
      return { state };
    }
    case 'attack': {
      if (!attackableSlots(state).includes(action.from)) return fail('Attack in the order FRONT, WING, BACK.');
      const attacker = me.battle[action.from]!;
      if (!canTarget(attacker.card.range, action.target)) return fail('Target is out of range.');
      attacker.attackedTurn = state.turn;
      state.adjustedThisTurn = true;
      const defender = foe.battle[action.target];
      if (!defender) {
        me.timeline++;
        logLine(state, `${label}'s ${attacker.card.name} hits a Weakness: Rush Point ${me.timeline}/${RULES.rushPointsToWin}.`);
        if (me.timeline >= RULES.rushPointsToWin) finish(state, state.active, 'Collected 9 Rush Points.');
        return { state };
      }
      const attackPower = attacker.card.power;
      const defendPower = defender.card.power;
      logLine(state, `${attacker.card.name} (${attackPower}) attacks ${defender.card.name} (${defendPower}).`);
      if (attackPower >= defendPower) {
        foe.retreat.push(defender.card);
        foe.battle[action.target] = null;
      }
      if (attackPower <= defendPower) {
        me.retreat.push(attacker.card);
        me.battle[action.from] = null;
      }
      return { state };
    }
    case 'endTurn': {
      if (state.phase !== 'action' && state.phase !== 'battle') return fail('Cannot end the turn now.');
      const excess = me.hand.length - RULES.handLimit;
      if (excess > 0) {
        const preferred = (action.discard || []).filter(uid => me.hand.some(card => card.uid === uid));
        const rest = me.hand.map(card => card.uid).filter(uid => !preferred.includes(uid)).reverse();
        const chosen = [...preferred, ...rest].slice(0, excess);
        me.retreat.push(...me.hand.filter(card => chosen.includes(card.uid)));
        me.hand = me.hand.filter(card => !chosen.includes(card.uid));
        logLine(state, `${label} discards ${chosen.length} card(s) to the hand limit.`);
      }
      state.active = opponentOf(state.active);
      state.turn++;
      state.phase = 'action';
      beginTurn(state);
      return { state };
    }
  }
};
