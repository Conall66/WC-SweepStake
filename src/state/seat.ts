// "Your seat" persistence helpers. A person holds one seat per sweep; the seat
// id is stored on the device so a refresh keeps you as the same player. Pure so
// the resolution rule (including clearing a stale id) is unit-testable.

import type { Player } from '../domain/types';

export function seatStorageKey(sweepId: string): string {
  return `sweep:me:v1:${sweepId}`;
}

/** Returns the stored seat id only if it still matches a known player; null
 *  otherwise (no seat, or the seat points at a player that no longer exists). */
export function resolveSeatPlayerId(storedId: string | null, players: Player[]): string | null {
  if (!storedId) return null;
  return players.some((player) => player.id === storedId) ? storedId : null;
}
