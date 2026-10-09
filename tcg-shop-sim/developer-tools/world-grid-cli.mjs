import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  addDistrict, addLocation, deleteDistrict, deleteLocation, editDistrict, editLocation,
  emptyWorld, exportConfig, populateDistrict, validateWorld,
} from './world-grid.mjs';

const [command, file, ...rest] = process.argv.slice(2);
const usage = `Usage: npm run world:grid -- <command> <world.json> [--key value ...]
Commands: init, validate, add-district, edit-district, delete-district,
          add-location, edit-location, delete-location, populate, export (--out file)`;
if (!command || !file) { console.error(usage); process.exit(2); }

const opts = {};
for (let i = 0; i < rest.length; i += 2) opts[rest[i].replace(/^--/, '')] = rest[i + 1];
const num = key => (opts[key] === undefined ? undefined : Number(opts[key]));
const list = key => (opts[key] === undefined ? undefined : opts[key].split(',').map(s => s.trim()).filter(Boolean));
const path = resolve(file);

try {
  if (command === 'init') {
    if (existsSync(path)) throw new Error(`${path} already exists.`);
    writeFileSync(path, `${JSON.stringify(emptyWorld(), null, 2)}\n`);
    console.log(`Created ${path}`);
    process.exit(0);
  }
  const world = JSON.parse(readFileSync(path, 'utf8'));
  const save = next => { writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`); console.log('OK'); };
  const district = () => ({ id: opts.id, name: opts.name, cityId: opts.city, x: num('x'), y: num('y'), availableProperties: list('properties') });
  const location = () => ({
    id: opts.id, name: opts.name, type: opts.type, districtId: opts.district, baseMarkup: num('markup'),
    allocationCases: num('cases'), unlockDay: num('unlockDay'), entryFee: num('entryFee'),
  });
  const defined = obj => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

  switch (command) {
    case 'validate': {
      const errors = validateWorld(world);
      if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
      console.log('World grid is valid.');
      break;
    }
    case 'add-district': save(addDistrict(world, defined(district()))); break;
    case 'edit-district': save(editDistrict(world, opts.id, defined(district()))); break;
    case 'delete-district': save(deleteDistrict(world, opts.id)); break;
    case 'add-location': save(addLocation(world, defined({ type: 'lgs', ...defined(location()) }))); break;
    case 'edit-location': save(editLocation(world, opts.id, defined(location()))); break;
    case 'delete-location': save(deleteLocation(world, opts.id)); break;
    case 'populate': save(populateDistrict(world, opts.district, Number(opts.count ?? 3))); break;
    case 'export': {
      const json = `${JSON.stringify(exportConfig(world), null, 2)}\n`;
      if (opts.out) { writeFileSync(resolve(opts.out), json); console.log(`Exported ${resolve(opts.out)}`); } else process.stdout.write(json);
      break;
    }
    default: console.error(usage); process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
