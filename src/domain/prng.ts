// A small, deterministic pseudo-random number generator. Given the same seed
// string it always produces the same sequence, which is what makes the draw
// reproducible and therefore verifiable by anyone holding the revealed seed.
//
// xmur3 hashes the seed string into a 32-bit integer; mulberry32 turns that
// into a stream of numbers in [0, 1). Both are well-known, tiny, and pure.

function xmur3(seed: string): () => number {
  let hash = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
}

function mulberry32(state: number): () => number {
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a deterministic random function from a seed string. */
export function makeRandom(seed: string): () => number {
  const next = xmur3(seed);
  return mulberry32(next());
}

/**
 * Fisher–Yates shuffle driven by a supplied random function, returning a new
 * array. Deterministic for a given random stream; the input is left untouched.
 */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
