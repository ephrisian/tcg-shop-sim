import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const settingsPath = resolve('settings.ini');
const outputPath = resolve('game/generatedSettings.ts');
const settings = {};
let section = '';

for (const [index, rawLine] of readFileSync(settingsPath, 'utf8').split(/\r?\n/).entries()) {
  const line = rawLine.replace(/[#;].*$/, '').trim();
  if (!line) continue;
  const sectionMatch = line.match(/^\[([a-z][a-z0-9_]*)\]$/i);
  if (sectionMatch) {
    section = sectionMatch[1];
    settings[section] ??= {};
    continue;
  }
  const settingMatch = line.match(/^([a-z][a-z0-9_]*)\s*=\s*(.+)$/i);
  if (!section || !settingMatch) {
    throw new Error(`Invalid settings.ini syntax on line ${index + 1}`);
  }
  const [, key, rawValue] = settingMatch;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`Expected a numeric setting on line ${index + 1}`);
  }
  if (value < 0) {
    throw new Error(`Setting ${section}.${key} must not be negative (line ${index + 1}).`);
  }
  settings[section][key] = value;
}

const requirePositiveInteger = (section, key) => {
  const value = settings[section]?.[key];
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Setting ${section}.${key} must be a positive integer.`);
  }
};

for (const [section, key] of [
  ['time', 'minutes_per_game_hour'],
  ['energy', 'max_energy'],
  ['storage', 'container_drawers'],
  ['storage', 'maximum_containers_per_location'],
  ['storage', 'desk_capacity'],
  ['live', 'queue_limit'],
  ['redemption', 'packs_per_case'],
]) {
  requirePositiveInteger(section, key);
}

if (settings.live.queue_limit > 3) throw new Error('live.queue_limit must not exceed three.');
for (const [section, key] of [
  ['game', 'starting_profit_margin'],
  ['energy', 'forced_sleep_energy_fraction'],
  ['live', 'platform_fee_fraction'],
  ['live', 'high_search_hit_zone'],
  ['live', 'low_search_hit_zone'],
  ['live', 'price_gap_fraction'],
  ['business', 'worker_margin_penalty'],
  ['binders', 'classic_25_resale_fraction'],
  ['binders', 'portfolio_35_resale_fraction'],
  ['binders', 'showcase_45_resale_fraction'],
]) {
  const value = settings[section]?.[key];
  if (value !== undefined && value > 1) {
    throw new Error(`Setting ${section}.${key} must not exceed one.`);
  }
}

writeFileSync(
  outputPath,
  `export const DEVELOPER_SETTINGS = ${JSON.stringify(settings, null, 2)} as const;\n`,
);
