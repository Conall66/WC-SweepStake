import { describe, expect, it } from 'vitest';
import type { Assignment } from '../domain/types';
import { PLAYERS, BASE_ASSIGNMENTS, DEFAULT_SEED, computeAssignments } from './sweepData';

const drawKey = (xs: Assignment[]) =>
  xs.map((x) => `${x.playerId}:${x.teamId}`).sort().join('|');

describe('sweepData', () => {
  it('has 16 players', () => {
    expect(PLAYERS).toHaveLength(16);
  });

  it('produces 48 assignments (16 players × 3 buckets)', () => {
    expect(BASE_ASSIGNMENTS).toHaveLength(48);
  });

  it('gives each player exactly 3 assignments across buckets 1, 2, 3', () => {
    for (const player of PLAYERS) {
      const mine = BASE_ASSIGNMENTS.filter((a) => a.playerId === player.id);
      expect(mine).toHaveLength(3);
      expect(new Set(mine.map((a) => a.bucket))).toEqual(new Set([1, 2, 3]));
    }
  });

  it('assigns every team exactly once', () => {
    const teamIds = BASE_ASSIGNMENTS.map((a) => a.teamId);
    expect(new Set(teamIds).size).toBe(48);
  });
});

describe('computeAssignments', () => {
  it('produces a valid balanced draw for any seed', () => {
    const assignments = computeAssignments('some-other-seed');
    expect(assignments).toHaveLength(48);
    for (const player of PLAYERS) {
      const mine = assignments.filter((a) => a.playerId === player.id);
      expect(mine).toHaveLength(3);
      expect(new Set(mine.map((a) => a.bucket))).toEqual(new Set([1, 2, 3]));
    }
  });

  it('gives a different draw for a different seed', () => {
    expect(drawKey(computeAssignments('seed-a'))).not.toEqual(
      drawKey(computeAssignments('seed-b')),
    );
  });

  it('matches BASE_ASSIGNMENTS when given the default seed', () => {
    expect(drawKey(computeAssignments(DEFAULT_SEED))).toEqual(drawKey(BASE_ASSIGNMENTS));
  });
});
