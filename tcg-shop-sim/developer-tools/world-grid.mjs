// Developer-only world grid authoring model. Not imported by the game runtime.
export const HOME_DISTRICT_ID = 'home';
export const MAX_CONNECTIONS = 4;
export const PROPERTY_TYPES = ['garage', 'shop', 'warehouse'];
export const LOCATION_TYPES = ['lgs', 'bigbox', 'resort'];

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const emptyWorld = () => ({
  schemaVersion: 1,
  cities: [{ id: 'home-city', name: 'Starting City', unlocked: true }],
  districts: [{ id: HOME_DISTRICT_ID, name: 'Home District', cityId: 'home-city', x: 0, y: 0, availableProperties: ['garage'] }],
  locations: {},
});

const clone = value => JSON.parse(JSON.stringify(value));
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const connectionsOf = (world, district) =>
  NEIGHBORS.map(([dx, dy]) => world.districts.find(d => d.cityId === district.cityId && d.x === district.x + dx && d.y === district.y + dy))
    .filter(Boolean);

export const validateWorld = world => {
  const errors = [];
  if (!world || typeof world !== 'object') return ['World must be an object.'];
  if (world.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  const cities = Array.isArray(world.cities) ? world.cities : [];
  const districts = Array.isArray(world.districts) ? world.districts : [];
  const locations = world.locations && typeof world.locations === 'object' ? world.locations : {};

  const cityIds = new Set();
  for (const city of cities) {
    if (!city.id || !city.name) errors.push('Every city needs id and name.');
    if (cityIds.has(city.id)) errors.push(`Duplicate city id "${city.id}".`);
    cityIds.add(city.id);
  }
  if (cities.filter(c => c.unlocked).length !== 1) errors.push('Exactly one city must be unlocked (the home city).');

  const ids = new Set();
  const coords = new Set();
  for (const d of districts) {
    if (!d.id || !d.name) errors.push('Every district needs id and name.');
    if (ids.has(d.id)) errors.push(`Duplicate district id "${d.id}".`);
    ids.add(d.id);
    if (!cityIds.has(d.cityId)) errors.push(`District "${d.id}" references unknown city "${d.cityId}".`);
    if (!Number.isInteger(d.x) || !Number.isInteger(d.y)) errors.push(`District "${d.id}" needs integer x/y.`);
    const key = `${d.cityId}:${d.x},${d.y}`;
    if (coords.has(key)) errors.push(`District "${d.id}" overlaps another district at ${d.x},${d.y} in ${d.cityId}.`);
    coords.add(key);
    if (!Array.isArray(d.availableProperties) || d.availableProperties.some(p => !PROPERTY_TYPES.includes(p))) {
      errors.push(`District "${d.id}" has invalid availableProperties.`);
    }
    if (connectionsOf({ districts }, d).length > MAX_CONNECTIONS) errors.push(`District "${d.id}" exceeds ${MAX_CONNECTIONS} connections.`);
  }

  const home = districts.find(d => d.id === HOME_DISTRICT_ID);
  const homeCity = cities.find(c => c.unlocked);
  if (!home) errors.push('Home District (id "home") is required.');
  else {
    if (home.x !== 0 || home.y !== 0) errors.push('Home District must be at the grid center (0,0).');
    if (homeCity && home.cityId !== homeCity.id) errors.push('Home District must belong to the unlocked home city.');
  }

  for (const city of cities) {
    const members = districts.filter(d => d.cityId === city.id);
    if (!members.length) { errors.push(`City "${city.id}" has no districts.`); continue; }
    const hub = members.find(d => d.x === 0 && d.y === 0);
    if (!hub) { errors.push(`City "${city.id}" needs a district at the center (0,0).`); continue; }
    const seen = new Set([hub.id]);
    const queue = [hub];
    while (queue.length) {
      for (const next of connectionsOf({ districts }, queue.shift())) {
        if (!seen.has(next.id)) { seen.add(next.id); queue.push(next); }
      }
    }
    for (const d of members) if (!seen.has(d.id)) errors.push(`District "${d.id}" is not connected to the center of "${city.id}".`);
  }

  for (const [key, loc] of Object.entries(locations)) {
    if (loc.id !== key) errors.push(`Location key "${key}" must equal its id.`);
    if (!loc.name) errors.push(`Location "${key}" needs a name.`);
    if (!LOCATION_TYPES.includes(loc.type)) errors.push(`Location "${key}" has invalid type "${loc.type}".`);
    if (!ids.has(loc.districtId)) errors.push(`Location "${key}" references unknown district "${loc.districtId}".`);
    if (typeof loc.baseMarkup !== 'number' || loc.baseMarkup < 0) errors.push(`Location "${key}" needs a non-negative baseMarkup.`);
  }
  return errors;
};

const commit = (world, mutate) => {
  const next = clone(world);
  mutate(next);
  const errors = validateWorld(next);
  if (errors.length) throw new Error(errors.join('\n'));
  return next;
};

const need = (list, id, label) => {
  const found = list.find(item => item.id === id);
  if (!found) throw new Error(`Unknown ${label} "${id}".`);
  return found;
};

export const addDistrict = (world, { id, name, cityId = 'home-city', x, y, availableProperties = ['shop'] }) =>
  commit(world, w => w.districts.push({ id: id ?? slug(name), name, cityId, x, y, availableProperties }));

export const editDistrict = (world, id, changes) => commit(world, w => {
  const d = need(w.districts, id, 'district');
  if (id === HOME_DISTRICT_ID && (changes.x !== undefined || changes.y !== undefined || changes.cityId !== undefined)) {
    throw new Error('Home District cannot be moved.');
  }
  for (const key of ['name', 'cityId', 'x', 'y', 'availableProperties']) if (changes[key] !== undefined) d[key] = changes[key];
});

export const deleteDistrict = (world, id) => {
  if (id === HOME_DISTRICT_ID) throw new Error('Home District cannot be deleted.');
  return commit(world, w => {
    need(w.districts, id, 'district');
    if (Object.values(w.locations).some(l => l.districtId === id)) throw new Error(`District "${id}" still contains locations.`);
    w.districts = w.districts.filter(d => d.id !== id);
  });
};

export const addLocation = (world, loc) => commit(world, w => {
  const id = loc.id ?? slug(loc.name);
  if (w.locations[id]) throw new Error(`Location "${id}" already exists.`);
  w.locations[id] = { baseMarkup: 0.15, ...loc, id };
});

export const editLocation = (world, id, changes) => commit(world, w => {
  if (!w.locations[id]) throw new Error(`Unknown location "${id}".`);
  w.locations[id] = { ...w.locations[id], ...changes, id };
});

export const deleteLocation = (world, id) => commit(world, w => {
  if (!w.locations[id]) throw new Error(`Unknown location "${id}".`);
  delete w.locations[id];
});

const NAME_A = ['Wolf', 'Dragon', 'Crit', 'Mythic', 'Pixel', 'Lucky', 'Rogue', 'Gilded'];
const NAME_B = ['Cards', 'Games', 'Vault', 'Emporium', 'Corner', 'Lair', 'Hobbies', 'Trading Post'];

// rng is injectable (returns [0,1)) so tests can be deterministic.
export const populateDistrict = (world, districtId, count, rng = Math.random) => commit(world, w => {
  need(w.districts, districtId, 'district');
  let added = 0;
  for (let attempts = 0; added < count && attempts < 1000; attempts += 1) {
    const name = `${NAME_A[Math.floor(rng() * NAME_A.length)]} ${NAME_B[Math.floor(rng() * NAME_B.length)]}`;
    const id = `lgs-${slug(name)}`;
    if (w.locations[id]) continue;
    w.locations[id] = { id, name, type: 'lgs', districtId, baseMarkup: Math.round((0.1 + rng() * 0.15) * 100) / 100, allocationCases: 10 + Math.floor(rng() * 41) };
    added += 1;
  }
  if (added < count) throw new Error(`Could only generate ${added} unique shops.`);
});

// Output shaped like GAME_CONFIG.locations and GAME_CONFIG.worldMap.
export const exportConfig = world => {
  const errors = validateWorld(world);
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    schemaVersion: 1,
    locations: clone(world.locations),
    worldMap: { districts: clone(world.districts), cities: clone(world.cities) },
  };
};
