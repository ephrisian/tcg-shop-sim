(function () {
  'use strict';
  const { validatePackage, validatePackaging, BINDERS } = window.SetPackageValidation;
  const $ = id => document.getElementById(id);
  const view = $('view');
  const hasServer = location.protocol.startsWith('http');
  const TABS = ['Game & Set', 'Cards', 'Value', 'Images', 'Products', 'Redemptions', 'Credits', 'Validate & Export'];
  let tab = 0;
  let pkg = blank();
  let fileName = 'set.json';
  let packagingOnly = false;
  let showingImporter = false;
  let showingLibrary = true;
  let selectedRemoteSets = [];
  let currentPath = '';
  let packageLoaded = false;
  let libraryPackages = [];
  let libraryMessage = '';
  let libraryMessageType = 'hint';
  let importMessage = '';
  let importMessageType = 'hint';

  function blank() {
    return { schemaVersion: 1, game: { id: '', name: '' }, set: { id: '', code: '', name: '' }, card_data: [] };
  }
  function blankPackaging() {
    return {
      schemaVersion: 1,
      packageType: 'product-packaging',
      game: { id: 'lorcana', name: 'Disney Lorcana' },
      set: { id: '', code: '', name: '' },
      products: [
        {
          id: 'default-pack',
          name: 'Booster Pack',
          type: 'pack',
          cardsPerPack: 12,
          slots: [
            { rarity: ['Common'], count: 6 },
            { rarity: ['Uncommon'], count: 3 },
            { rarity: ['Rare', 'Super Rare', 'Legendary'], count: 2 },
            { rarity: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Enchanted'], count: 1, isFoil: true },
          ],
        },
        { id: 'default-box', name: 'Booster Box', type: 'box', packsPerBox: 24, packProductId: 'default-pack' },
      ],
    };
  }
  const arr = key => (pkg[key] = Array.isArray(pkg[key]) ? pkg[key] : []);

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    for (const k of kids.flat()) if (k != null) e.append(k);
    return e;
  }

  // Field codecs: parse returns {v} (v undefined removes the property) or {err}.
  const codecs = {
    text: { get: v => v ?? '', set: s => ({ v: s === '' ? undefined : s }) },
    int: { get: v => v ?? '', set: s => s === '' ? { v: undefined } : /^-?\d+$/.test(s.trim()) ? { v: Number(s) } : { err: 'integer required' } },
    num: { get: v => v ?? '', set: s => s === '' ? { v: undefined } : Number.isFinite(Number(s)) ? { v: Number(s) } : { err: 'number required' } },
    json: {
      get: v => v === undefined ? '' : JSON.stringify(v, null, 1),
      set: s => { if (s.trim() === '') return { v: undefined }; try { return { v: JSON.parse(s) }; } catch (e) { return { err: e.message }; } }
    },
    slots: {
      get: v => (v || []).map(s => `${[].concat(s.rarity).join('|')} x${s.count}${s.isFoil ? ' foil' : ''}`).join('\n'),
      set: s => {
        const out = [];
        for (const line of s.split('\n').map(l => l.trim()).filter(Boolean)) {
          const m = /^(.+?)\s+x(\d+)(\s+foil)?$/i.exec(line);
          if (!m) return { err: `bad slot line "${line}" (use: Rarity|Rarity2 x3 foil)` };
          const rs = m[1].split('|').map(r => r.trim()).filter(Boolean);
          const slot = { rarity: rs.length === 1 ? rs[0] : rs, count: Number(m[2]) };
          if (m[3]) slot.isFoil = true;
          out.push(slot);
        }
        return { v: out.length ? out : undefined };
      }
    }
  };

  function cardIdSelect(obj, key, onChange) {
    const sel = el('select');
    const ids = (pkg.card_data || []).map(c => c.id).filter(Boolean);
    if (obj[key] && !ids.includes(obj[key])) ids.push(obj[key]);
    sel.append(el('option', { value: '', textContent: '(choose card)' }));
    ids.forEach(id => sel.append(el('option', { value: id, textContent: id, selected: id === obj[key] })));
    sel.onchange = () => { obj[key] = sel.value; onChange(); };
    return sel;
  }

  // cols: {key, label, type, ids?:true (card select), choices?:[]}
  function listEditor(list, cols, newItem, opts = {}) {
    const t = el('table');
    t.append(el('tr', {}, cols.map(c => el('th', { textContent: c.label })), el('th')));
    list.forEach((item, idx) => {
      const tr = el('tr');
      for (const c of cols) {
        let input;
        if (c.ids) input = cardIdSelect(item, c.key, () => {});
        else if (c.choices) {
          input = el('select', {}, c.choices.map(ch => el('option', { value: ch, textContent: ch || '—', selected: item[c.key] === ch || (!item[c.key] && ch === '') })));
          input.onchange = () => { const r = codecs.text.set(input.value); r.v === undefined ? delete item[c.key] : (item[c.key] = r.v); if (opts.rerender) render(); };
        } else {
          const codec = codecs[c.type || 'text'];
          const multi = c.type === 'json' || c.type === 'slots';
          input = el(multi ? 'textarea' : 'input', { value: codec.get(item[c.key]), placeholder: c.hint || '' });
          input.onchange = () => {
            const r = codec.set(input.value);
            input.style.outline = r.err ? '2px solid #ff6b6b' : '';
            input.title = r.err || '';
            if (r.err) return;
            r.v === undefined ? delete item[c.key] : (item[c.key] = r.v);
            if (opts.refreshIds && c.key === 'id') {/* other tabs re-read ids on render */}
          };
        }
        if (c.show && !c.show(item)) { tr.append(el('td')); continue; }
        tr.append(el('td', {}, input));
      }
      tr.append(el('td', {}, el('button', { textContent: '✕', title: 'Remove', onclick: () => { list.splice(idx, 1); render(); } })));
      t.append(tr);
    });
    return el('div', {}, t, el('p', {}, el('button', { textContent: '+ Add', onclick: () => { list.push(newItem()); render(); } })));
  }

  function fieldGrid(obj, fields) {
    const g = el('div', { className: 'grid' });
    for (const f of fields) {
      const codec = codecs[f.type || 'text'];
      const input = el('input', { value: codec.get(obj[f.key]), placeholder: f.hint || '' });
      input.onchange = () => {
        const r = codec.set(input.value);
        input.style.outline = r.err ? '2px solid #ff6b6b' : '';
        if (r.err) return;
        r.v === undefined ? delete obj[f.key] : (obj[f.key] = r.v);
      };
      g.append(el('label', { textContent: f.label }), input);
    }
    return g;
  }

  const views = [
    function gameSet() {
      pkg.game = pkg.game || {}; pkg.set = pkg.set || {};
      const setFields = [
        { key: 'id', label: 'set.id *' }, { key: 'code', label: 'set.code *' }, { key: 'name', label: 'set.name *' },
      ];
      if (!packagingOnly) setFields.push(
        { key: 'company', label: 'set.company' },
        { key: 'runSize', label: 'set.runSize', type: 'int', hint: 'must equal redemptions.caseCount' },
      );
      return el('div', {},
        el('h2', { textContent: 'Game / provider' }),
        fieldGrid(pkg.game, [
          { key: 'id', label: 'game.id *' }, { key: 'name', label: 'game.name *' },
          { key: 'providerId', label: 'game.providerId', hint: 'optional source/provider id' }]),
        el('h2', { textContent: 'Set metadata' }),
        fieldGrid(pkg.set, setFields),
        el('p', { className: 'hint', textContent: packagingOnly
          ? 'Enter the existing API set code in set.id and set.code. This restricted config contains no card records, market values, or card images.'
          : 'Extra set metadata loaded from a file is preserved on export. Use original or licensed-for-you data only.' }));
    },
    function cards() {
      return el('div', {},
        el('p', { className: 'hint', textContent: 'Common fields are columns; any other provider-specific fields go in the JSON extras column (e.g. {"cost": 2}). Extras are merged into the card on edit.' }),
        cardTable());
    },
    function value() {
      return el('div', {}, el('p', { className: 'hint', textContent: 'Market value per card (separate from images). Extra numeric/string fields can be hand-edited in the JSON.' }),
        listEditor(arr('value'), [{ key: 'cardId', label: 'Card', ids: true }, { key: 'marketPrice', label: 'marketPrice', type: 'num' }], () => ({ cardId: '', marketPrice: 0 })),
        el('button', { textContent: 'Add records for all cards without one', onclick: () => {
          const have = new Set(arr('value').map(v => v.cardId));
          pkg.card_data.forEach(c => c.id && !have.has(c.id) && pkg.value.push({ cardId: c.id, marketPrice: 0 }));
          render();
        } }));
    },
    function images() {
      return el('div', {}, el('p', { className: 'hint', textContent: 'Relative paths only (no .., no absolute), e.g. images/card-001.png. The tool does not read image files; validate them with npm run validate:set.' }),
        listEditor(arr('image'), [{ key: 'cardId', label: 'Card', ids: true }, { key: 'path', label: 'path', hint: 'images/card-001.png' }], () => ({ cardId: '', path: '' })),
        el('button', { textContent: 'Add images/<id>.png for all cards without one', onclick: () => {
          const have = new Set(arr('image').map(v => v.cardId));
          pkg.card_data.forEach(c => c.id && !have.has(c.id) && pkg.image.push({ cardId: c.id, path: `images/${c.id}.png` }));
          render();
        } }));
    },
    function products() {
      const rows = arr('products');
      const uploads = el('div', {});
      if (currentPath) {
        rows.forEach(product => {
          const input = el('input', { type: 'file', accept: 'image/*' });
          const note = el('span', { className: 'hint', textContent: product.image ? ` current: ${product.image}` : '' });
          input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            try {
              const folder = currentPath.split('/').slice(0, -1).join('/');
              const name = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
              await writePackageFile(`${folder}/${name}`, file);
              product.image = name;
              render();
            } catch (error) {
              note.className = 'err';
              note.textContent = error instanceof Error ? error.message : 'Upload failed.';
            }
          };
          uploads.append(el('p', {}, `${product.name || product.id || 'Product'} image: `, input, note));
        });
      }
      return el('div', {}, el('h2', { textContent: 'Product images' }), uploads, el('p', { className: 'hint', textContent: 'Packs need slots (one per line: "Common x6", "Rare|Mythic x1 foil"). Boxes need packsPerBox and may reference a pack via packProductId.' }),
        listEditor(rows, [
          { key: 'id', label: 'id' }, { key: 'name', label: 'name' }, { key: 'type', label: 'type', choices: ['pack', 'box'] },
          { key: 'price', label: 'price', type: 'num' },
          { key: 'cardsPerPack', label: 'cardsPerPack', type: 'int', show: p => p.type !== 'box' },
          { key: 'slots', label: 'slots (composition)', type: 'slots', show: p => p.type !== 'box' },
          { key: 'packsPerBox', label: 'packsPerBox', type: 'int', show: p => p.type === 'box' },
          { key: 'packProductId', label: 'packProductId', choices: ['', ...rows.filter(p => p.type === 'pack').map(p => p.id)], show: p => p.type === 'box' },
          { key: 'runSize', label: 'runSize', type: 'int' },
          { key: 'image', label: 'image path', hint: 'images/products/booster-pack.png' },
          { key: 'pullRates', label: 'pullRates (JSON)', type: 'json', show: p => p.type !== 'box' }
        ], () => ({ id: '', name: '', type: 'pack' }), { rerender: true }));
    },
    function redemptions() {
      const wrap = el('div');
      const cb = el('input', { type: 'checkbox', checked: !!pkg.redemptions });
      cb.onchange = () => { cb.checked ? (pkg.redemptions = pkg.redemptions || { caseCount: pkg.set?.runSize || 1, tiers: [] }) : delete pkg.redemptions; render(); };
      wrap.append(el('label', {}, cb, ' Set has redemptions'));
      if (pkg.redemptions) {
        const r = pkg.redemptions; r.tiers = Array.isArray(r.tiers) ? r.tiers : [];
        const total = r.tiers.reduce((s, t) => s + (Number.isInteger(t.quantity) ? t.quantity : 0), 0);
        wrap.append(el('h2', { textContent: 'Redemption run' }),
          fieldGrid(r, [{ key: 'caseCount', label: 'caseCount *', type: 'int' }, { key: 'packsPerCase', label: 'packsPerCase', type: 'int' }]),
          el('h2', { textContent: 'Tiers' }),
          el('p', { className: 'hint', textContent: `Quantity total: ${total} / caseCount ${r.caseCount}. Binder prizeIds: ${BINDERS.join(', ')}.` }),
          listEditor(r.tiers, [{ key: 'id', label: 'id' }, { key: 'quantity', label: 'quantity', type: 'int' },
            { key: 'prizeType', label: 'prizeType', choices: ['card', 'binder'] }, { key: 'prizeId', label: 'prizeId', hint: 'card id or binder id' }],
            () => ({ id: '', quantity: 0, prizeType: 'card', prizeId: '' })));
      }
      return wrap;
    },
    function credits() {
      const ta = el('textarea', { className: 'big', value: codecs.json.get(pkg.credits) });
      const msg = el('span');
      ta.onchange = () => {
        const r = codecs.json.set(ta.value);
        if (r.err) { msg.className = 'err'; msg.textContent = r.err; return; }
        if (r.v !== undefined && (typeof r.v !== 'object' || r.v === null)) { msg.className = 'err'; msg.textContent = 'credits must be an object or array'; return; }
        r.v === undefined ? delete pkg.credits : (pkg.credits = r.v);
        msg.className = 'ok'; msg.textContent = 'saved';
      };
      return el('div', {}, el('p', { className: 'hint', textContent: 'Free-form object or array, e.g. {"companies": ["Example"], "artists": ["Name"]}. Leave empty to omit.' }), ta, msg);
    },
    function validateExport() {
      const { errors, warnings } = packagingOnly ? validatePackaging(pkg) : validatePackage(pkg);
      const out = el('div', {},
        el('h2', { textContent: errors.length ? `${errors.length} error(s)` : 'No structural errors' }),
        errors.map(e => el('div', { className: 'err', textContent: '• ' + e })),
        warnings.map(e => el('div', { className: 'warn', textContent: '• ' + e })),
        el('p', { className: 'hint', textContent: packagingOnly
          ? 'Packaging-only configuration does not contain or modify card data, values, or card artwork. Import it from the game Settings screen with the product image folder.'
          : 'This checks structure only (not image files on disk). Run npm run validate:set and npm run export:set on the exported file — see README.md.' }),
        el('textarea', { className: 'big', readOnly: true, value: JSON.stringify(pkg, null, 2) }));
      return out;
    }
  ];

  // Cards table: extras column holds every non-core key as JSON.
  const CORE = ['id', 'name', 'rarity', 'type'];
  function cardTable() {
    const list = arr('card_data');
    const t = el('table');
    t.append(el('tr', {}, ['id *', 'name *', 'rarity', 'type', 'provider-specific fields (JSON)', ''].map(h => el('th', { textContent: h }))));
    list.forEach((card, idx) => {
      const tr = el('tr');
      for (const k of CORE) {
        const i = el('input', { value: card[k] ?? '' });
        i.onchange = () => { i.value === '' ? delete card[k] : (card[k] = i.value); };
        tr.append(el('td', {}, i));
      }
      const extras = {};
      for (const k of Object.keys(card)) if (!CORE.includes(k)) extras[k] = card[k];
      const ta = el('textarea', { value: Object.keys(extras).length ? JSON.stringify(extras, null, 1) : '' });
      ta.onchange = () => {
        const r = codecs.json.set(ta.value);
        if (r.err || (r.v !== undefined && (typeof r.v !== 'object' || Array.isArray(r.v) || !r.v))) { ta.style.outline = '2px solid #ff6b6b'; ta.title = r.err || 'must be an object'; return; }
        ta.style.outline = '';
        for (const k of Object.keys(card)) if (!CORE.includes(k)) delete card[k];
        Object.assign(card, r.v || {}, Object.fromEntries(CORE.filter(k => card[k] !== undefined).map(k => [k, card[k]])));
      };
      tr.append(el('td', {}, ta), el('td', {}, el('button', { textContent: '✕', title: 'Remove', onclick: () => { list.splice(idx, 1); render(); } })));
      t.append(tr);
    });
    return el('div', {}, t, el('p', {}, el('button', { textContent: '+ Add card', onclick: () => { list.push({ id: '', name: '' }); render(); } })));
  }

  function setStatus() {
    const { errors } = packagingOnly ? validatePackaging(pkg) : validatePackage(pkg);
    $('status').className = errors.length ? 'err' : 'ok';
    const itemSummary = packagingOnly ? `${pkg.products?.length || 0} products` : `${pkg.card_data?.length || 0} cards`;
    $('status').textContent = `${fileName} · ${itemSummary} · ${errors.length ? errors.length + ' issue(s)' : 'valid structure'}`;
  }

  async function writePackageFile(relativePath, content) {
    const response = await fetch(`/api/files?path=${encodeURIComponent(relativePath)}`, { method: 'PUT', body: content });
    if (!response.ok) throw new Error(`Could not write ${relativePath}: ${await response.text()}`);
  }

  async function refreshLibrary() {
    if (!hasServer) {
      libraryMessageType = 'err';
      libraryMessage = 'Start the author server with "npm run author" in tcg-shop-sim and open http://localhost:5179/ so the tool can read and write developer-tools/set-packages directly.';
      return render();
    }
    try {
      const response = await fetch('/api/packages');
      if (!response.ok) throw new Error(await response.text());
      libraryPackages = (await response.json()).map(entry => ({
        path: entry.path,
        game: entry.data.game,
        set: entry.data.set,
        cardCount: entry.data.card_data.length,
        products: Array.isArray(entry.data.products) ? entry.data.products : [],
        data: entry.data,
      })).sort((left, right) => `${left.game.name} ${left.set.name}`.localeCompare(`${right.game.name} ${right.set.name}`));
      libraryMessageType = 'ok';
      libraryMessage = `Found ${libraryPackages.length} set package(s) in developer-tools/set-packages.`;
    } catch (error) {
      libraryMessageType = 'err';
      libraryMessage = `Could not read set packages: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
    render();
  }

  function packageLibraryView() {
    const wrap = el('div', {});
    const refreshButton = el('button', { textContent: 'Refresh', onclick: refreshLibrary });
    const status = el('p', { className: libraryMessageType, textContent: libraryMessage });
    const list = el('div', { className: 'package-list' });
    libraryPackages.forEach(entry => {
      const details = el('div', { className: 'package-details' },
        el('strong', { textContent: entry.set.name }),
        el('span', { textContent: `${entry.game.name} · ${entry.set.code} · ${entry.cardCount} cards · ${entry.products.length} products` }),
        el('small', { textContent: entry.path }));
      list.append(el('section', { className: 'package-card' }, details,
        el('button', { textContent: 'Edit Set', onclick: () => openLibraryPackage(entry) })));
    });
    if (hasServer && libraryPackages.length === 0 && libraryMessageType === 'ok') {
      list.append(el('p', { className: 'hint', textContent: 'No sets yet. Use the Data Importer to import one.' }));
    }
    wrap.append(
      el('h2', { textContent: 'Set Package Library' }),
      el('p', { className: 'hint', textContent: 'Sets stored in developer-tools/set-packages. Select one to edit; saves write straight back to that folder for the next build.' }),
      refreshButton, status, list);
    return wrap;
  }

  function openLibraryPackage(entry) {
    pkg = entry.data;
    currentPath = entry.path;
    fileName = entry.path.split('/').pop();
    packageLoaded = true;
    packagingOnly = false;
    showingImporter = false;
    showingLibrary = false;
    tab = 0;
    render();
  }

  async function saveCurrentPackage() {
    if (packagingOnly || !currentPath) throw new Error('Open a set from the library before saving.');
    const { errors } = validatePackage(pkg);
    if (errors.length > 0) throw new Error(`Set package has ${errors.length} validation issue(s): ${errors.join(' ')}`);
    const folder = currentPath.split('/').slice(0, -1).join('/');
    const referenced = [...(pkg.products || []).map(p => p.image), ...(pkg.image || []).map(i => i.path)].filter(Boolean);
    const missing = [];
    for (const path of referenced) {
      const response = await fetch(`/api/exists?path=${encodeURIComponent(`${folder}/${path}`)}`);
      if (!response.ok) missing.push(path);
    }
    if (missing.length) throw new Error(`Image file(s) not found in the set folder (check the extension): ${[...new Set(missing)].join(', ')}`);
    await writePackageFile(currentPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  function importerView() {
    const wrap = el('div', {});
    wrap.append(
      el('h2', { textContent: 'Lorcast Data Importer' }),
      el('p', { className: 'hint', textContent: 'Fetch a Lorcana set and write its JSON and card art directly into developer-tools/set-packages/; the app build validates and compiles them. Players cannot import sets.' }),
    );
    const fetchButton = el('button', { textContent: 'Fetch Lorcast Sets' });
    const select = el('select');
    select.setAttribute('aria-label', 'Lorcast set');
    select.append(el('option', { value: '', textContent: 'Choose a set…' }));
    selectedRemoteSets.forEach(set => select.append(el('option', {
      value: set.code,
      textContent: `${set.code.toUpperCase()} · ${set.name}`,
    })));
    const downloadArtwork = el('input', { type: 'checkbox', checked: true });
    const importButton = el('button', {
      textContent: 'Download Selected Set Package',
      disabled: true,
    });
    const message = el('p', { className: importMessageType, textContent: importMessage });

    select.onchange = () => { importButton.disabled = !select.value; };
    fetchButton.onclick = async () => {
      fetchButton.disabled = true;
      message.className = 'hint';
      message.textContent = 'Fetching set list from Lorcast…';
      try {
        const response = await fetch('https://api.lorcast.com/v0/sets');
        if (!response.ok) throw new Error(`Lorcast set request failed (${response.status}).`);
        const data = await response.json();
        if (!Array.isArray(data.results)) throw new Error('Lorcast returned an unexpected set-list response.');
        selectedRemoteSets = data.results.filter(set => typeof set.code === 'string' && typeof set.name === 'string');
        message.className = 'ok';
        message.textContent = `Loaded ${selectedRemoteSets.length} set(s). Select one to import.`;
        render();
      } catch (error) {
        message.className = 'err';
        message.textContent = error instanceof Error ? error.message : 'Could not fetch Lorcast sets.';
      } finally {
        fetchButton.disabled = false;
      }
    };
    importButton.onclick = async () => {
      if (!select.value) return;
      if (!hasServer) { message.className = 'err'; message.textContent = 'Start the author server (npm run author) and open http://localhost:5179/ to import.'; return; }
      importButton.disabled = true;
      fetchButton.disabled = true;
      try {
        const remoteSet = selectedRemoteSets.find(set => set.code === select.value);
        if (!remoteSet) throw new Error('The selected set is no longer available. Fetch the set list again.');
        const code = String(remoteSet.code).toLowerCase();
        message.className = 'hint';
        message.textContent = `Fetching cards for ${remoteSet.name}…`;
        const cards = await fetchLorcastSetCards(code, message);
        if (cards.length === 0) throw new Error(`Lorcast returned no cards for ${remoteSet.name}.`);
        const cardData = [];
        const values = [];
        const images = [];
        const artworkJobs = [];
        const seenIds = new Set();
        cards.forEach((card, index) => {
          if (typeof card.id !== 'string' || !card.id || typeof card.name !== 'string' || !card.name) {
            throw new Error(`Card ${index + 1} has no usable ID or name.`);
          }
          if (seenIds.has(card.id)) throw new Error(`Lorcast returned duplicate card ID "${card.id}".`);
          seenIds.add(card.id);
          cardData.push(card);
          const rawPrice = card.prices?.usd;
          const marketPrice = typeof rawPrice === 'number'
            ? rawPrice
            : typeof rawPrice === 'string' ? Number(rawPrice.replace(/[^0-9.-]/g, '')) : NaN;
          values.push({ cardId: card.id, marketPrice: Number.isFinite(marketPrice) && marketPrice >= 0 ? marketPrice : 0 });
          const imageUrl = card.image_uris?.digital?.normal || card.image_uris?.digital?.large ||
            card.image_uris?.normal || card.image_uris?.large;
          if (downloadArtwork.checked && imageUrl) artworkJobs.push({ cardId: card.id, imageUrl });
        });
        const packageFolder = `lorcana/${code.replace(/[^a-z0-9_-]+/g, '_')}`;
        for (let start = 0; start < artworkJobs.length; start += 6) {
          const batch = artworkJobs.slice(start, start + 6);
          const downloaded = await Promise.all(batch.map(async (job, batchIndex) => {
            const progress = Math.min(start + batchIndex + 1, artworkJobs.length);
            message.textContent = `Downloading artwork ${progress} of ${artworkJobs.length}�`;
            const asset = await fetchLorcastArtwork(job.imageUrl);
            return { ...job, asset };
          }));
          for (const item of downloaded) {
            const cardIndex = cards.findIndex(card => card.id === item.cardId);
            const imageName = `${String(cardIndex + 1).padStart(4, '0')}-${item.cardId.replace(/[^a-zA-Z0-9_-]+/g, '_')}.${item.asset.extension}`;
            const imagePath = imageName;
            await writePackageFile(`${packageFolder}/${imagePath}`, item.asset.blob);
            images.push({ cardId: item.cardId, path: imagePath });
          }
        }
        const availableRarities = [...new Set(cardData.map(card => String(card.rarity || 'Common')))];
        const commonRarity = availableRarities.find(rarity => rarity.toLowerCase() === 'common') || availableRarities[0] || 'Common';
        const uncommonRarity = availableRarities.find(rarity => rarity.toLowerCase() === 'uncommon') || commonRarity;
        const premiumRarities = availableRarities.filter(rarity =>
          rarity.toLowerCase() !== commonRarity.toLowerCase() && rarity.toLowerCase() !== uncommonRarity.toLowerCase());
        const packageData = {
          schemaVersion: 1,
          game: { id: 'lorcana', name: 'Disney Lorcana', providerId: 'lorcast' },
          set: { id: code, code: code.toUpperCase(), name: remoteSet.name, company: 'Disney Lorcana' },
          card_data: cardData,
          value: values,
          ...(images.length ? { image: images } : {}),
          products: [
            {
              id: 'booster-pack',
              name: 'Booster Pack',
              type: 'pack',
              cardsPerPack: 12,
              slots: [
                { rarity: commonRarity, count: 6 },
                { rarity: uncommonRarity, count: 3 },
                { rarity: premiumRarities.length ? premiumRarities : commonRarity, count: 2 },
                { rarity: availableRarities, count: 1, isFoil: true },
              ],
            },
            { id: 'booster-box', name: 'Booster Box', type: 'box', packsPerBox: 24, packProductId: 'booster-pack' },
          ],
        };
        const validation = validatePackage(packageData);
        if (validation.errors.length) throw new Error(`Imported package failed validation: ${validation.errors.join(' ')}`);
        pkg = packageData;
        fileName = 'set.json';
        packagingOnly = false;
        packageLoaded = true;
        showingImporter = false;
        tab = 0;
        currentPath = `${packageFolder}/set.json`;
        await writePackageFile(currentPath, JSON.stringify(packageData, null, 2) + '\n');
        importMessage = `Imported ${remoteSet.name}: ${cards.length} cards and ${images.length} artwork files written to developer-tools/set-packages/${packageFolder}.`;
        importMessageType = 'ok';
        libraryMessage = importMessage;
        libraryMessageType = 'ok';
        render();
      } catch (error) {
        message.className = 'err';
        message.textContent = error instanceof Error ? error.message : 'Could not import the selected set.';
        importButton.disabled = !select.value;
        fetchButton.disabled = false;
      }
    };
    wrap.append(
      el('div', { className: 'grid' },
        el('label', { textContent: 'Source' }),
        el('span', { textContent: 'Lorcast (Lorcana)' }),
        el('label', { textContent: 'Set' }),
        el('span', {}, select),
        el('label', { textContent: 'Card artwork' }),
        el('label', {}, downloadArtwork, ' Download and include image files'),
      ),
      el('p', { className: 'hint', textContent: 'Files are written by the local author server to developer-tools/set-packages/lorcana/<set code>/. Re-importing a set overwrites its files.' }),
      el('p', {}, fetchButton, ' ', importButton),
      message,
      el('hr'),
      cardFunImportSection(),
    );
    return wrap;
  }

  function cardFunImportSection() {
    const section = el('div', {});
    const urlInput = el('input', { type: 'text', placeholder: 'https://card.fun/products/301', value: 'https://card.fun/products/' });
    urlInput.style.width = '100%';
    const downloadArtwork = el('input', { type: 'checkbox', checked: true });
    const button = el('button', { textContent: 'Import from Card.fun' });
    const message = el('p', { className: 'hint', textContent: '' });
    button.onclick = async () => {
      if (!hasServer) { message.className = 'err'; message.textContent = 'Start the author server (npm run author) and open http://localhost:5179/ to import.'; return; }
      button.disabled = true;
      try {
        message.className = 'hint';
        message.textContent = 'Loading the page in a headless browser and expanding every section (this can take a minute)…';
        const scrapeResponse = await fetch('/api/cardfun/scrape', { method: 'POST', body: JSON.stringify({ url: urlInput.value.trim() }) });
        if (!scrapeResponse.ok) throw new Error(await scrapeResponse.text());
        const scraped = await scrapeResponse.json();
        const code = `CF${scraped.productId}`;
        const packageFolder = `cardfun/${scraped.productId}`;
        const cardData = scraped.cards.map((card, index) => ({
          id: `cf-${scraped.productId}-${String(index + 1).padStart(4, '0')}`,
          name: card.name || `Card ${index + 1}`,
          rarity: card.section || card.type || 'Base',
          type: card.type || '',
        }));
        const values = cardData.map(card => ({ cardId: card.id, marketPrice: 0 }));
        const images = [];
        if (downloadArtwork.checked) {
          for (let start = 0; start < cardData.length; start += 6) {
            const batch = cardData.slice(start, start + 6).map(async (card, offset) => {
              const asset = await fetchLorcastArtwork(scraped.cards[start + offset].imageUrl);
              const imagePath = `${String(start + offset + 1).padStart(4, '0')}-${card.id}.${asset.extension}`;
              await writePackageFile(`${packageFolder}/${imagePath}`, asset.blob);
              images.push({ cardId: card.id, path: imagePath });
            });
            await Promise.all(batch);
            message.textContent = `Downloading artwork ${Math.min(start + 6, cardData.length)} of ${cardData.length}…`;
          }
        }
        const rarities = [...new Set(cardData.map(card => card.rarity))];
        const packageData = {
          schemaVersion: 1,
          game: { id: 'cardfun', name: 'Card.fun', providerId: 'cardfun' },
          set: { id: code.toLowerCase(), code, name: scraped.title || code, company: 'Card.fun' },
          card_data: cardData,
          value: values,
          ...(images.length ? { image: images.sort((a, b) => a.path.localeCompare(b.path)) } : {}),
          products: [
            { id: 'booster-pack', name: 'Booster Pack', type: 'pack', cardsPerPack: 5, slots: [{ rarity: rarities, count: 5 }] },
            { id: 'booster-box', name: 'Booster Box', type: 'box', packsPerBox: 20, packProductId: 'booster-pack' },
          ],
        };
        const validation = validatePackage(packageData);
        if (validation.errors.length) throw new Error(`Imported package failed validation: ${validation.errors.join(' ')}`);
        pkg = packageData;
        fileName = 'set.json';
        packagingOnly = false;
        packageLoaded = true;
        showingImporter = false;
        tab = 0;
        currentPath = `${packageFolder}/set.json`;
        await writePackageFile(currentPath, JSON.stringify(packageData, null, 2) + '\n');
        importMessage = `Imported ${packageData.set.name}: ${cardData.length} cards and ${images.length} artwork files written to developer-tools/set-packages/${packageFolder}. Review pack slots and values in Products/Value.`;
        importMessageType = 'ok';
        libraryMessage = importMessage;
        libraryMessageType = 'ok';
        render();
      } catch (error) {
        message.className = 'err';
        message.textContent = error instanceof Error ? error.message : 'Could not import from Card.fun.';
        button.disabled = false;
      }
    };
    section.append(
      el('h2', { textContent: 'Card.fun Importer' }),
      el('p', { className: 'hint', textContent: 'Enter a card.fun product page. The local server opens it in a headless browser (Edge or Chrome), expands every "MORE" button, and imports each card (rarity = section title) and its art. Artwork is the 358px thumbnail card.fun serves, since its signed image links cannot be resized. Re-importing overwrites.' }),
      el('div', { className: 'grid' },
        el('label', { textContent: 'Product URL' }), urlInput,
        el('label', { textContent: 'Card artwork' }),
        el('label', {}, downloadArtwork, ' Download and include image files')),
      el('p', {}, button),
      message);
    return section;
  }

  async function fetchLorcastSetCards(setCode, progress) {
    let nextUrl = new URL(`https://api.lorcast.com/v0/cards/search?q=set:${encodeURIComponent(setCode)}`);
    const cards = [];
    while (nextUrl) {
      if (nextUrl.protocol !== 'https:' || nextUrl.hostname !== 'api.lorcast.com') {
        throw new Error('Lorcast returned an unexpected pagination URL.');
      }
      const response = await fetch(nextUrl);
      if (!response.ok) throw new Error(`Lorcast card request failed (${response.status}).`);
      const data = await response.json();
      if (!Array.isArray(data.results)) throw new Error('Lorcast returned an unexpected card-list response.');
      cards.push(...data.results);
      progress.textContent = `Fetched ${cards.length} card record(s)…`;
      nextUrl = data.has_more && data.next_page ? new URL(data.next_page, nextUrl) : null;
    }
    return cards;
  }

  async function fetchLorcastArtwork(url) {
    const imageUrl = new URL(url);
    if (imageUrl.protocol !== 'https:') throw new Error('Card artwork URL must use HTTPS.');
    const response = await fetch(`/api/art?url=${encodeURIComponent(imageUrl.href)}`);
    if (!response.ok) throw new Error(`Could not download card artwork (${response.status}): ${imageUrl.href}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`Lorcast artwork did not return an image: ${imageUrl.href}`);
    const urlExtension = imageUrl.pathname.split('.').pop().toLowerCase();
    const extension = ['png', 'jpg', 'jpeg', 'webp', 'avif'].includes(urlExtension)
      ? (urlExtension === 'jpeg' ? 'jpg' : urlExtension)
      : ({ 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[blob.type] || 'jpg');
    return { blob, extension };
  }

  function render() {
    const nav = $('tabs');
    const visibleTabs = packagingOnly ? [0, 4, 7] : TABS.map((_, index) => index);
    $('btnExport').textContent = packagingOnly ? 'Export product-packaging.json' : 'Export set.json';
    $('btnDataImporter').className = showingImporter ? 'active' : '';
    $('btnSetLibrary').className = showingLibrary ? 'active' : '';
    $('btnNew').hidden = showingImporter || showingLibrary;
    $('btnNewPackaging').hidden = showingImporter || showingLibrary;
    $('btnLoad').hidden = showingImporter || showingLibrary;
    $('btnExport').hidden = showingImporter || showingLibrary;
    $('btnSetLibrary').hidden = showingImporter || showingLibrary;
    $('btnSavePackage').hidden = showingImporter || showingLibrary || !packageLoaded || packagingOnly;
    document.querySelector('header h1').textContent = showingImporter
      ? 'Data Importer'
      : showingLibrary ? 'Set Package Author'
      : packagingOnly ? 'Product Packaging Author' : 'Set Package Author';
    nav.hidden = showingImporter || showingLibrary;
    if (showingImporter) {
      view.replaceChildren(importerView());
      $('status').textContent = importMessage || 'Fetch Lorcast set/card data into a build-ready package.';
      $('status').className = importMessageType;
      return;
    }
    if (showingLibrary) {
      view.replaceChildren(packageLibraryView());
      $('status').textContent = libraryMessage
        ? `${libraryPackages.length} set package(s) loaded`
        : 'Reading set-packages folder…';
      $('status').className = libraryMessageType;
      return;
    }
    nav.replaceChildren(...visibleTabs.map(index => el('button', { textContent: TABS[index], className: index === tab ? 'active' : '', onclick: () => { tab = index; render(); } })));
    if (!visibleTabs.includes(tab)) tab = visibleTabs[0];
    view.replaceChildren(views[tab]());
    setStatus();
  }

  $('btnNew').onclick = () => { if (confirm('Discard current package and start new?')) { pkg = blank(); currentPath = ''; packageLoaded = false; packagingOnly = false; fileName = 'set.json'; showingLibrary = false; tab = 0; render(); } };
  $('btnNewPackaging').onclick = () => {
    if (confirm('Start a packaging-only config? It will not contain or edit card records, values, or card artwork.')) {
      pkg = blankPackaging(); currentPath = ''; packageLoaded = false; packagingOnly = true; fileName = 'product-packaging.json'; showingLibrary = false; tab = 0; render();
    }
  };
  $('btnLoad').onclick = () => { showingLibrary = false; $('fileIn').click(); };
  $('btnDataImporter').onclick = () => { showingImporter = !showingImporter; render(); };
  $('btnSetLibrary').onclick = async () => {
    showingImporter = false;
    showingLibrary = true;
    refreshLibrary();
  };
  $('btnSavePackage').onclick = async () => {
    if (!packageLoaded || packagingOnly) return;
    try {
      await saveCurrentPackage();
      $('status').textContent = `Saved ${currentPath}.`;
      $('status').className = 'ok';
    } catch (error) {
      importMessage = error instanceof Error ? error.message : 'Could not save package.';
      importMessageType = 'err';
      $('status').textContent = importMessage;
      $('status').className = importMessageType;
    }
  };
  $('fileIn').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not a JSON object');
      fileName = f.name;
      currentPath = '';
      packageLoaded = false;
      if (data.packageType === 'product-packaging') {
        pkg = data;
        packagingOnly = true;
      } else if (Array.isArray(data.card_data)) {
        pkg = {
          schemaVersion: 1,
          packageType: 'product-packaging',
          game: {
            id: data.game?.id || '',
            name: data.game?.name || '',
            ...(data.game?.providerId ? { providerId: data.game.providerId } : {}),
          },
          set: {
            id: data.set?.id || '',
            code: data.set?.code || '',
            name: data.set?.name || '',
          },
          products: Array.isArray(data.products) ? data.products : [],
        };
        packagingOnly = true;
        fileName = 'product-packaging.json';
      } else {
        pkg = data;
        pkg.schemaVersion = 1;
        packagingOnly = false;
        packageLoaded = true;
      }
      tab = 0;
      render();
    } catch (err) { alert('Cannot load: ' + err.message); }
    e.target.value = '';
  };
  $('btnExport').onclick = () => {
    const { errors } = packagingOnly ? validatePackaging(pkg) : validatePackage(pkg);
    if (errors.length && !confirm(`${errors.length} validation issue(s). Export anyway?`)) return;
    const downloadName = packagingOnly && fileName === 'set.json' ? 'product-packaging.json' : fileName;
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(pkg, null, 2) + '\n'], { type: 'application/json' })), download: downloadName });
    a.click(); URL.revokeObjectURL(a.href);
  };
  window.__authoring = { get pkg() { return pkg; }, set pkg(v) { pkg = v; render(); }, render };
  refreshLibrary();
})();
