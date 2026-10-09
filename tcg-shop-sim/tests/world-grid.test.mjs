import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  addDistrict, addLocation, deleteDistrict, deleteLocation, editDistrict, editLocation,
  emptyWorld, exportConfig, populateDistrict, validateWorld,
} from '../developer-tools/world-grid.mjs';

const cliPath = resolve('developer-tools/world-grid-cli.mjs');

const withNeighbors = () => {
  let w = emptyWorld();
  w = addDistrict(w, { name: 'Uptown', x: 1, y: 0 });
  w = addDistrict(w, { name: 'Downtown', x: -1, y: 0 });
  return w;
};

test('empty world is valid with Home District at center', () => {
  assert.deepEqual(validateWorld(emptyWorld()), []);
});

test('rejects moving/deleting home and a non-centered home', () => {
  assert.throws(() => deleteDistrict(emptyWorld(), 'home'), /cannot be deleted/);
  assert.throws(() => editDistrict(emptyWorld(), 'home', { x: 1 }), /cannot be moved/);
  const w = emptyWorld();
  w.districts[0].x = 1;
  assert.ok(validateWorld(w).some(e => /center/.test(e)));
});

test('rejects overlapping and disconnected districts', () => {
  assert.throws(() => addDistrict(emptyWorld(), { name: 'Dup', x: 0, y: 0 }), /overlaps/);
  assert.throws(() => addDistrict(emptyWorld(), { name: 'Far', x: 3, y: 3 }), /not connected/);
});

test('home supports four neighbors and no more are possible on the grid', () => {
  let w = withNeighbors();
  w = addDistrict(w, { name: 'City Center', x: 0, y: 1 });
  w = addDistrict(w, { name: 'Suburbs', x: 0, y: -1 });
  assert.deepEqual(validateWorld(w), []);
  // A forced fifth connection is reported by validation.
  const bad = structuredClone(w);
  bad.districts.push({ id: 'x', name: 'X', cityId: 'home-city', x: 0, y: 0, availableProperties: ['shop'] });
  assert.ok(validateWorld(bad).length > 0);
});

test('delete district is blocked while it holds locations, and cannot orphan others', () => {
  let w = addDistrict(emptyWorld(), { name: 'Uptown', x: 1, y: 0 });
  w = addDistrict(w, { name: 'Edge', x: 2, y: 0 });
  assert.throws(() => deleteDistrict(w, 'uptown'), /not connected/);
  w = addLocation(w, { name: 'Shop A', type: 'lgs', districtId: 'edge' });
  assert.throws(() => deleteDistrict(w, 'edge'), /still contains/);
  w = deleteLocation(w, 'shop-a');
  assert.deepEqual(Object.keys(deleteDistrict(w, 'edge').locations), []);
});

test('location create/edit validates district and type', () => {
  let w = addLocation(emptyWorld(), { name: 'Wolf Cards', type: 'lgs', districtId: 'home', baseMarkup: 0.2 });
  w = editLocation(w, 'wolf-cards', { baseMarkup: 0.3 });
  assert.equal(w.locations['wolf-cards'].baseMarkup, 0.3);
  assert.throws(() => addLocation(w, { name: 'Bad', type: 'lgs', districtId: 'nowhere' }), /unknown district/);
  assert.throws(() => addLocation(w, { name: 'Bad', type: 'zoo', districtId: 'home' }), /invalid type/);
});

test('populate adds unique valid shops deterministically', () => {
  let n = 0;
  const rng = () => ((n += 0.137) % 1);
  const w = populateDistrict(emptyWorld(), 'home', 4, rng);
  assert.equal(Object.keys(w.locations).length, 4);
  assert.deepEqual(validateWorld(w), []);
});

test('export mirrors GAME_CONFIG shape and refuses invalid worlds', () => {
  const w = addLocation(withNeighbors(), { name: 'Wolf Cards', type: 'lgs', districtId: 'home' });
  const out = exportConfig(w);
  assert.equal(out.worldMap.districts.length, 3);
  assert.ok(out.locations['wolf-cards']);
  const bad = structuredClone(w);
  bad.districts = bad.districts.filter(d => d.id !== 'home');
  assert.throws(() => exportConfig(bad), /Home District/);
});

test('world-grid CLI creates, validates, and exports a world definition', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tcg-world-grid-'));
  try {
    const worldPath = join(directory, 'world.json');
    const outputPath = join(directory, 'world-config.json');
    const run = (...args) => spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' });

    assert.equal(run('init', worldPath).status, 0);
    assert.equal(run('add-district', worldPath, '--name', 'Uptown', '--x', '1', '--y', '0', '--properties', 'shop').status, 0);
    assert.equal(run('add-location', worldPath, '--name', 'Wolf Cards', '--district', 'home', '--markup', '0.2').status, 0);
    assert.equal(run('validate', worldPath).status, 0);
    assert.equal(run('export', worldPath, '--out', outputPath).status, 0);
    const exported = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.ok(exported.locations['wolf-cards']);
    assert.ok(exported.worldMap.districts.some(district => district.id === 'uptown'));
    assert.notEqual(run('add-district', worldPath, '--name', 'Far Away', '--x', '5', '--y', '5').status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
