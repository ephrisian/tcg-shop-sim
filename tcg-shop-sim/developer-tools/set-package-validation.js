(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SetPackageValidation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const BINDERS = ['classic-25', 'portfolio-35', 'showcase-45'];
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const posInt = v => Number.isInteger(v) && v >= 1;

  // Mirrors scripts/validate-set-package.mjs minus filesystem checks; the CLI stays authoritative.
  function validatePackage(data) {
    const errors = [];
    const warnings = [];
    if (!isObj(data)) return { errors: ['Package must be a JSON object.'], warnings };
    if (data.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
    if (!data.game?.id || !data.game?.name) errors.push('game.id and game.name are required.');
    if (data.game?.providerId !== undefined && (typeof data.game.providerId !== 'string' || !data.game.providerId.trim())) {
      errors.push('game.providerId must be a non-empty string when provided.');
    }
    if (!data.set?.id || !data.set?.code || !data.set?.name) errors.push('set.id, set.code, and set.name are required.');
    if (data.set?.runSize !== undefined && !posInt(data.set.runSize)) errors.push('set.runSize must be a positive integer.');
    const cards = Array.isArray(data.card_data) ? data.card_data : [];
    if (cards.length === 0) errors.push('card_data must contain at least one card.');
    for (const s of ['value', 'image', 'products']) {
      if (data[s] !== undefined && !Array.isArray(data[s])) errors.push(`${s} must be an array when provided.`);
    }
    const cardIds = new Set();
    for (const c of cards) {
      if (!c?.id || !c?.name) errors.push('Each card_data entry needs an id and name.');
      else if (cardIds.has(c.id)) errors.push(`Duplicate card ID: ${c.id}`);
      else cardIds.add(c.id);
    }
    const seenValue = new Set();
    for (const v of Array.isArray(data.value) ? data.value : []) {
      if (!isObj(v)) { errors.push('Every value record must be an object.'); continue; }
      if (!cardIds.has(v.cardId)) errors.push(`Value data references unknown card ${v.cardId}.`);
      if (seenValue.has(v.cardId)) errors.push(`Duplicate value record for card ${v.cardId}.`);
      seenValue.add(v.cardId);
      if (v.marketPrice !== undefined && (!Number.isFinite(v.marketPrice) || v.marketPrice < 0)) errors.push(`Invalid marketPrice for ${v.cardId}.`);
    }
    const seenImage = new Set();
    for (const i of Array.isArray(data.image) ? data.image : []) {
      if (!isObj(i)) { errors.push('Every image record must be an object.'); continue; }
      if (!cardIds.has(i.cardId)) errors.push(`Image data references unknown card ${i.cardId}.`);
      if (seenImage.has(i.cardId)) errors.push(`Duplicate image record for card ${i.cardId}.`);
      seenImage.add(i.cardId);
      if (typeof i.path !== 'string' || !i.path || /^([a-zA-Z]:|[\\/])/.test(i.path) || i.path.split(/[\\/]/).includes('..')) {
        errors.push(`Image path must be relative and stay inside its image folder: ${i.path}`);
      }
    }
    const rarities = new Set(cards.map(c => String(c?.rarity || 'Common').toLowerCase()));
    const products = Array.isArray(data.products) ? data.products : [];
    const productIds = new Set();
    for (const p of products) {
      if (!isObj(p)) { errors.push('Every product must be an object.'); continue; }
      if (!p.id || !p.name || !['pack', 'box'].includes(p.type)) errors.push('Each product needs an id, name, and pack/box type.');
      if (p.image !== undefined && (typeof p.image !== 'string' || !p.image || /^([a-zA-Z]:|[\\/])/.test(p.image) || p.image.split(/[\\/]/).includes('..'))) {
        errors.push(`Product image path must be relative and stay inside the package: ${p.image}`);
      }
      if (productIds.has(p.id)) errors.push(`Duplicate product ID: ${p.id}`);
      productIds.add(p.id);
      if (p.type === 'pack') {
        if (!Array.isArray(p.slots) || p.slots.length === 0) errors.push(`Pack ${p.id} must define slots.`);
        let total = 0;
        for (const s of Array.isArray(p.slots) ? p.slots : []) {
          if (!isObj(s)) { errors.push(`Pack ${p.id} has an invalid slot.`); continue; }
          const rs = Array.isArray(s.rarity) ? s.rarity : [s.rarity];
          if (!posInt(s.count)) errors.push(`Pack ${p.id} has an invalid slot count.`);
          else total += s.count;
          if (rs.some(r => !rarities.has(String(r).toLowerCase()))) errors.push(`Pack ${p.id} uses a rarity absent from card_data.`);
        }
        if (p.cardsPerPack !== undefined && p.cardsPerPack !== total) errors.push(`Pack ${p.id} cardsPerPack does not equal its slot total.`);
      }
      if (p.type === 'box' && !posInt(p.packsPerBox)) errors.push(`Box ${p.id} must have a positive packsPerBox.`);
    }
    for (const p of products) {
      if (isObj(p) && p.type === 'box' && p.packProductId && !products.some(q => q?.id === p.packProductId && q?.type === 'pack')) {
        errors.push(`Box ${p.id} references an unknown pack product.`);
      }
    }
    if (data.redemptions !== undefined) {
      if (!isObj(data.redemptions)) errors.push('redemptions must be an object when provided.');
      else {
        const { caseCount, packsPerCase, tiers } = data.redemptions;
        if (!posInt(caseCount) || !Array.isArray(tiers)) errors.push('redemptions needs positive caseCount and tiers.');
        if (packsPerCase !== undefined && !posInt(packsPerCase)) errors.push('redemptions packsPerCase must be a positive integer.');
        const ids = new Set();
        let total = 0;
        for (const t of Array.isArray(tiers) ? tiers : []) {
          if (!isObj(t)) { errors.push('Each redemption tier must be an object.'); continue; }
          if (!t.id || !Number.isInteger(t.quantity) || t.quantity < 0) errors.push('Each redemption tier needs an ID and non-negative integer quantity.');
          if (ids.has(t.id)) errors.push(`Duplicate redemption tier ID: ${t.id}.`);
          ids.add(t.id);
          if (!['card', 'binder'].includes(t.prizeType) || !t.prizeId) errors.push(`Invalid prize definition for redemption tier ${t.id}.`);
          if (t.prizeType === 'card' && !cardIds.has(t.prizeId)) errors.push(`Unknown redemption prize card ${t.prizeId}.`);
          if (t.prizeType === 'binder' && !BINDERS.includes(t.prizeId)) errors.push(`Unknown redemption prize binder ${t.prizeId}.`);
          if (Number.isInteger(t.quantity)) total += t.quantity;
        }
        if (total !== caseCount) errors.push(`Redemption quantities total ${total}, not caseCount ${caseCount}.`);
        if (data.set?.runSize !== undefined && caseCount !== data.set.runSize) errors.push('Redemption caseCount must match set.runSize.');
      }
    }
    if (data.credits !== undefined && (!data.credits || typeof data.credits !== 'object')) errors.push('credits must be an object or array.');
    const allowed = ['schemaVersion', 'game', 'set', 'card_data', 'value', 'image', 'products', 'redemptions', 'credits'];
    for (const k of Object.keys(data)) if (!allowed.includes(k)) errors.push(`Unknown top-level property: ${k}`);
    if (cards.length && !(data.image || []).length) warnings.push('No image associations defined.');
    if (cards.length && !(data.value || []).length) warnings.push('No value associations defined.');
    return { errors, warnings };
  }

  function validatePackaging(data) {
    const errors = [];
    if (!isObj(data)) return { errors: ['Packaging definition must be a JSON object.'], warnings: [] };
    if (data.schemaVersion !== 1 || data.packageType !== 'product-packaging') errors.push('Expected schemaVersion 1 and packageType "product-packaging".');
    if (!data.game?.id || !data.game?.name) errors.push('game.id and game.name are required.');
    if (!data.set?.id || !data.set?.code || !data.set?.name) errors.push('set.id, set.code, and set.name are required.');
    if (!Array.isArray(data.products) || data.products.length === 0) errors.push('products must contain at least one product.');
    const products = Array.isArray(data.products) ? data.products : [];
    const ids = new Set();
    for (const p of products) {
      if (!isObj(p)) { errors.push('Every product must be an object.'); continue; }
      if (!p.id || !p.name || !['pack', 'box'].includes(p.type)) errors.push('Each product needs an id, name, and pack/box type.');
      if (ids.has(p.id)) errors.push(`Duplicate product ID: ${p.id}`);
      ids.add(p.id);
      if (p.image !== undefined && (typeof p.image !== 'string' || !p.image || /^([a-zA-Z]:|[\\/])/.test(p.image) || p.image.split(/[\\/]/).includes('..'))) {
        errors.push(`Product image path must be relative and stay inside the package: ${p.image}`);
      }
      if (p.price !== undefined && (!Number.isFinite(p.price) || p.price < 0)) errors.push(`Product ${p.id} price must be non-negative.`);
      if (p.type === 'pack') {
        if (!Array.isArray(p.slots) || p.slots.length === 0) errors.push(`Pack ${p.id} must define slots.`);
        let total = 0;
        for (const slot of Array.isArray(p.slots) ? p.slots : []) {
          if (!isObj(slot) || !posInt(slot.count) || !(Array.isArray(slot.rarity) ? slot.rarity.length : slot.rarity)) errors.push(`Pack ${p.id} has an invalid slot.`);
          else total += slot.count;
        }
        if (p.cardsPerPack !== undefined && p.cardsPerPack !== total) errors.push(`Pack ${p.id} cardsPerPack does not equal its slot total.`);
      }
      if (p.type === 'box' && !posInt(p.packsPerBox)) errors.push(`Box ${p.id} must have a positive packsPerBox.`);
    }
    for (const p of products) {
      if (p?.type === 'box' && p.packProductId && !products.some(q => q?.type === 'pack' && q.id === p.packProductId)) {
        errors.push(`Box ${p.id} references an unknown pack product.`);
      }
    }
    const allowed = ['schemaVersion', 'packageType', 'game', 'set', 'products'];
    for (const key of Object.keys(data)) if (!allowed.includes(key)) errors.push(`Unknown top-level property: ${key}`);
    return { errors, warnings: [] };
  }
  return { validatePackage, validatePackaging, BINDERS };
});
