import { DEVELOPER_SETTINGS } from './config';

export const MINUTES_PER_GAME_HOUR = DEVELOPER_SETTINGS.time.minutes_per_game_hour;
export const MINUTES_PER_GAME_DAY = MINUTES_PER_GAME_HOUR * 24;

export const gameDayForClock = (clockMinutes: number): number => Math.floor(clockMinutes / MINUTES_PER_GAME_DAY) + 1;

export const gameTimeOfDay = (clockMinutes: number): { hour: number; minute: number } => {
  const minutes = ((clockMinutes % MINUTES_PER_GAME_DAY) + MINUTES_PER_GAME_DAY) % MINUTES_PER_GAME_DAY;
  return {
    hour: Math.floor(minutes / MINUTES_PER_GAME_HOUR),
    minute: Math.floor(minutes % MINUTES_PER_GAME_HOUR),
  };
};

export const adjustedEnergyCost = (baseCost: number, awakeHours: number, hourlyModifier: number): number => {
  if (![baseCost, awakeHours, hourlyModifier].every(Number.isFinite) || baseCost < 0 || hourlyModifier < 0) {
    throw new Error('Energy cost inputs must be finite and non-negative.');
  }
  return baseCost + Math.floor(Math.max(0, awakeHours)) * hourlyModifier;
};

export const mustForceSleep = (awakeHours: number, maximumAwakeHours: number): boolean =>
  awakeHours > maximumAwakeHours;

export const startsRecoverySleep = (hour: number): boolean => hour >= 22 && hour < 24;
