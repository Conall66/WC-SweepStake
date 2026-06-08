import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SEED } from './sweepData';
import { clearSeedOverride, generateSeed, getActiveSeed, setSeedOverride } from './activeSeed';

// Node's test runtime has no working localStorage, so stand up a faithful
// in-memory Storage fake (the real browser API) to exercise our seed logic.
function makeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('activeSeed', () => {
  it('defaults to DEFAULT_SEED when no override is set', () => {
    expect(getActiveSeed()).toBe(DEFAULT_SEED);
  });

  it('returns the override once one is set', () => {
    setSeedOverride('custom-seed');
    expect(getActiveSeed()).toBe('custom-seed');
  });

  it('falls back to the default after clearing the override', () => {
    setSeedOverride('custom-seed');
    clearSeedOverride();
    expect(getActiveSeed()).toBe(DEFAULT_SEED);
  });

  it('generateSeed produces a non-empty value that differs between calls', () => {
    const a = generateSeed();
    const b = generateSeed();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
