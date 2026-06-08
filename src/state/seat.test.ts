import { describe, expect, it } from 'vitest';
import type { Player } from '../domain/types';
import { resolveSeatPlayerId } from './seat';

function makePlayers(ids: string[]): Player[] {
  return ids.map((id) => ({ id, name: id, descriptor: '', joinedAt: 0 }));
}

describe('resolveSeatPlayerId', () => {
  it('returns the stored id when it matches an existing player', () => {
    const players = makePlayers(['a', 'b', 'c']);
    expect(resolveSeatPlayerId('b', players)).toBe('b');
  });

  it('returns null when no seat is stored', () => {
    const players = makePlayers(['a', 'b']);
    expect(resolveSeatPlayerId(null, players)).toBeNull();
  });

  it('returns null when the stored id no longer matches any player (stale seat)', () => {
    const players = makePlayers(['a', 'b']);
    expect(resolveSeatPlayerId('gone', players)).toBeNull();
  });
});
