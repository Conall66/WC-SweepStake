// The "active seed" the draw is computed from. Players always get DEFAULT_SEED
// (the baked-in draw). Dev mode can store an override in localStorage to preview
// a different draw on this device only — to make a draw live for everyone, the
// chosen seed is baked into sweepData.ts and redeployed.

import { DEFAULT_SEED } from './sweepData';

const SEED_OVERRIDE_KEY = 'sweep:devSeed:v1';

export function getActiveSeed(): string {
  try {
    return localStorage.getItem(SEED_OVERRIDE_KEY) ?? DEFAULT_SEED;
  } catch {
    return DEFAULT_SEED;
  }
}

export function setSeedOverride(seed: string): void {
  try {
    localStorage.setItem(SEED_OVERRIDE_KEY, seed);
  } catch {
    // Storage unavailable — nothing we can do; the default seed stands.
  }
}

export function clearSeedOverride(): void {
  try {
    localStorage.removeItem(SEED_OVERRIDE_KEY);
  } catch {
    // No-op if storage is unavailable.
  }
}

/** A fresh random seed for a reshuffle. Two halves of base-36 randomness make a
 *  collision between consecutive calls vanishingly unlikely. */
export function generateSeed(): string {
  const part = () => Math.random().toString(36).slice(2, 8);
  return `${part()}${part()}`;
}
