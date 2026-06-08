import { describe, expect, it } from 'vitest';
import { PLAYERS, BASE_ASSIGNMENTS } from './sweepData';

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
