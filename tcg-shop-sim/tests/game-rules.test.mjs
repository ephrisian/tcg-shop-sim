import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const typescript = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const { defaultGameState, migrateGameState } = require('../game/state.ts');
const { addCardsToInventory, availableCardCapacity, duplicateCardInstanceIds, storeDeskPiles } = require('../game/inventory.ts');
const { calculateLiveSaleOutcome } = require('../game/liveSales.ts');
const { rollRedemption } = require('../game/redemptions.ts');
const { resolveDueShipments } = require('../game/shipping.ts');
const { districtDistanceInHops } = require('../game/world.ts');
const { adjustedEnergyCost, gameTimeOfDay, MINUTES_PER_GAME_DAY, MINUTES_PER_GAME_HOUR, mustForceSleep, startsRecoverySleep } = require('../game/time.ts');

const cloneDefaultState = () => JSON.parse(JSON.stringify(defaultGameState));
const makeCard = (instanceId, pileIndex = null) => ({
  instanceId,
  cardId: 'example-card',
  isFoil: false,
  condition: 1,
  pileIndex,
});

test('migrating a current save preserves storage location and closes saved Live sessions', () => {
  const save = cloneDefaultState();
  const propertyId = 'garage-example';
  save.properties = [{ id: propertyId, type: 'garage', districtId: 'home' }];
  save.ownedLocations.push(propertyId);
  save.currentLocationId = propertyId;
  save.storage[0].locationId = propertyId;
  save.liveState = {
    ...save.liveState,
    active: true,
    requests: [{ id: 'request-example' }],
    sellableBinderIds: ['binder-example'],
  };

  const migrated = migrateGameState(save);
  assert.equal(migrated.storage[0].locationId, propertyId);
  assert.equal(migrated.liveState.active, false);
  assert.deepEqual(migrated.liveState.requests, []);
  assert.deepEqual(migrated.liveState.sellableBinderIds, []);
});

test('migrating a legacy save keeps its storage at home rather than the last visited store', () => {
  const save = cloneDefaultState();
  save.saveVersion = 1;
  save.currentLocationId = 'lgs-wolf';
  save.storage[0].locationId = undefined;
  save.storage[0].slots[0].cards = [makeCard('legacy-card')];

  const migrated = migrateGameState(save);
  assert.equal(migrated.storage[0].locationId, migrated.homeLocationId);
  assert.equal(migrated.storage[0].slots[0].cards[0].instanceId, 'legacy-card');
});

test('rejects card instances duplicated between ownership locations', () => {
  const save = cloneDefaultState();
  const duplicate = makeCard('duplicate-instance');
  save.desk = [duplicate];
  save.binders = [{
    id: 'binder-example',
    name: 'Binder',
    designId: 'classic-25',
    pageCount: 25,
    slotsPerPage: 9,
    purchasePrice: 50,
    used: true,
    cards: [duplicate],
  }];
  assert.throws(() => migrateGameState(save), /card instances in multiple locations/);
  assert.deepEqual(duplicateCardInstanceIds({ ...cloneDefaultState(), desk: [duplicate], binders: save.binders }), ['duplicate-instance']);
});

test('card collection enforces combined desk and location storage capacity', () => {
  const state = cloneDefaultState();
  const capacity = availableCardCapacity(state, state.homeLocationId);
  assert.equal(capacity, 350);
  const cards = Array.from({ length: capacity }, (_, index) => makeCard(`card-${index}`));
  const collected = addCardsToInventory(state, cards, state.homeLocationId);
  assert.ok(collected);
  assert.equal(collected.desk.length, 50);
  assert.equal(collected.storage[0].slots.reduce((sum, drawer) => sum + drawer.cards.length, 0), 300);
  assert.equal(addCardsToInventory(state, [...cards, makeCard('too-many')], state.homeLocationId), null);
});

test('desk pile transfers are immutable and leave cards that do not fit on the desk', () => {
  const state = cloneDefaultState();
  state.storage[0].slots[0].cards = Array.from({ length: 49 }, (_, index) => makeCard(`stored-${index}`));
  state.desk = [makeCard('move-1', 0), makeCard('move-2', 0)];
  const targetId = state.storage[0].slots[0].id;
  const result = storeDeskPiles(state, {}, targetId);

  assert.equal(result.moved, 1);
  assert.equal(result.remaining, 1);
  assert.equal(result.state.storage[0].slots[0].cards.length, 50);
  assert.deepEqual(result.state.desk.map(card => card.instanceId), ['move-2']);
  assert.equal(state.storage[0].slots[0].cards.length, 49);
});

test('world travel and game clock use configured hop and time conversions', () => {
  assert.equal(districtDistanceInHops('home', 'uptown'), 1);
  assert.equal(districtDistanceInHops('uptown', 'portlandia'), 4);
  const time = gameTimeOfDay(MINUTES_PER_GAME_DAY + 13 * MINUTES_PER_GAME_HOUR + 8);
  assert.deepEqual(time, { hour: 13, minute: 8 });
});

test('energy costs rise by the configured whole-hour modifier and exhaustion begins after the limit', () => {
  assert.equal(adjustedEnergyCost(5, 2.75, 1), 7);
  assert.equal(mustForceSleep(36, 36), false);
  assert.equal(mustForceSleep(36.01, 36), true);
  assert.equal(startsRecoverySleep(22), true);
  assert.equal(startsRecoverySleep(24), false);
});

test('Singles outcomes apply the platform fee once and penalize price gaps', () => {
  assert.deepEqual(calculateLiveSaleOutcome(5.99, 5.99, 0.15, 0.25, 2), {
    netProceeds: 5.09,
    trafficPenalty: 0,
  });
  assert.deepEqual(calculateLiveSaleOutcome(10, 5, 0.15, 0.25, 2), {
    netProceeds: 8.5,
    trafficPenalty: 2,
  });
  assert.deepEqual(calculateLiveSaleOutcome(10, 0, 0.15, 0.25, 2), {
    netProceeds: 8.5,
    trafficPenalty: 0,
  });
  assert.throws(() => calculateLiveSaleOutcome(10, 5, 1.5, 0.25, 2), /Platform fee/);
});

test('shipments deliver once when due and wait when capacity or ownership is missing', () => {
  const state = cloneDefaultState();
  state.clockMinutes = 120;
  const shipment = {
    id: 'shipment-1',
    vendorId: 'vendor',
    destinationLocationId: state.homeLocationId,
    arrivalTime: 120,
    items: [{ type: 'pack', setId: 'set-1', productId: 'pack-1', quantity: 1 }],
    status: 'in-transit',
  };
  state.shipments = [shipment];

  const early = resolveDueShipments({ ...state, clockMinutes: 119 }, 100, () => 'card-1');
  assert.strictEqual(early.shipments[0], shipment);
  const delivered = resolveDueShipments(state, state.sealed.length + 1, () => 'product-1');
  assert.equal(delivered.shipments[0].status, 'delivered');
  assert.equal(delivered.sealed.at(-1).id, 'product-1');
  assert.strictEqual(resolveDueShipments(delivered, state.sealed.length + 1, () => 'duplicate'), delivered);

  const blocked = resolveDueShipments(state, state.sealed.length, () => 'unused');
  assert.equal(blocked.shipments[0].status, 'awaiting-capacity');
  assert.equal(blocked.sealed.length, state.sealed.length);
  const reassigned = {
    ...blocked,
    shipments: [{ ...blocked.shipments[0], destinationLocationId: state.homeLocationId }],
  };
  const resumed = resolveDueShipments(reassigned, state.sealed.length + 1, () => 'resumed-product');
  assert.equal(resumed.shipments[0].status, 'delivered');
  assert.equal(resumed.sealed.at(-1).locationId, state.homeLocationId);
});

test('redemption rolls respect configured frequency and prize-tier distribution', () => {
  const distribution = {
    caseCount: 4,
    packsPerCase: 2,
    tiers: [
      { id: 'common', quantity: 2, prizeType: 'card', prizeId: 'card-1' },
      { id: 'rare', quantity: 1, prizeType: 'binder', prizeId: 'classic-25' },
      { id: 'ultra', quantity: 1, prizeType: 'card', prizeId: 'card-2' },
    ],
  };
  const rolls = [0.1, 0.9];
  assert.deepEqual(rollRedemption(distribution, 10, () => rolls.shift()), distribution.tiers[2]);
  assert.equal(rollRedemption(distribution, 10, () => 0.5), undefined);
  assert.throws(() => rollRedemption({ ...distribution, caseCount: 3 }, 10), /expected 3 cases/);
});
