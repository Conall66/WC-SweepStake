// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Assignment, Team } from '../domain/types';
import { useReveal } from './useReveal';

const teams: Team[] = [
  { id: 't1', name: 'Alpha', isoCode: 'aa', fifaRank: 1 },
  { id: 't2', name: 'Beta', isoCode: 'bb', fifaRank: 2 },
  { id: 't3', name: 'Gamma', isoCode: 'cc', fifaRank: 3 },
  { id: 't4', name: 'Delta', isoCode: 'dd', fifaRank: 4 },
];

function assign(teamId: string, bucket: number, revealedAt: number | null): Assignment {
  return { teamId, playerId: 'p1', bucket, revealedAt, revealedAuto: false };
}

// Two of p1's four teams are already revealed, so the cursor starts mid-way.
const assignments: Assignment[] = [
  assign('t1', 1, 100),
  assign('t2', 2, 200),
  assign('t3', 3, null),
  assign('t4', 4, null),
];

describe('useReveal replay', () => {
  it('resets the cursor to 0', () => {
    const onReveal = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useReveal({ assignments, teams, playerId: 'p1', onReveal }),
    );

    expect(result.current.cursor).toBe(2); // starts at the revealed count

    act(() => result.current.replay());

    expect(result.current.cursor).toBe(0);
  });

  it('does not re-write any stored reveal state', () => {
    const onReveal = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useReveal({ assignments, teams, playerId: 'p1', onReveal }),
    );

    act(() => result.current.replay());

    expect(onReveal).not.toHaveBeenCalled();
  });
});
