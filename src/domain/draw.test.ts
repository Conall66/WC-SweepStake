import { describe, expect, it } from 'vitest';
import type { Player, Team } from './types';
import { planDraw, revealOrder, runDraw } from './draw';
import { commitSeed, generateSeed, verifyCommitment } from './fairness';

// Build N placeholder teams ranked 1..N for arithmetic-focused tests.
function makeTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `T${i + 1}`,
    name: `Team ${i + 1}`,
    isoCode: 'xx',
    fifaRank: i + 1,
  }));
}

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P${i + 1}`,
    name: `Player ${i + 1}`,
    descriptor: '',
    joinedAt: 0,
  }));
}

describe('planDraw', () => {
  it('splits 48 teams among 10 players into 4 buckets with 8 unowned', () => {
    const plan = planDraw(makeTeams(48), 10);
    expect(plan.bucketCount).toBe(4);
    expect(plan.buckets).toHaveLength(4);
    plan.buckets.forEach((bucket) => expect(bucket).toHaveLength(10));
    expect(plan.unownedTeamIds).toHaveLength(8);
  });

  it('handles a remainder (48 teams, 11 players -> 4 buckets, 4 unowned)', () => {
    const plan = planDraw(makeTeams(48), 11);
    expect(plan.bucketCount).toBe(4);
    plan.buckets.forEach((bucket) => expect(bucket).toHaveLength(11));
    expect(plan.unownedTeamIds).toHaveLength(4);
  });

  it('puts the strongest teams in bucket 1', () => {
    const plan = planDraw(makeTeams(48), 12);
    expect(plan.buckets[0]!.map((t) => t.fifaRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('runDraw', () => {
  const teams = makeTeams(48);
  const players = makePlayers(10);
  const seed = 'fixed-seed-for-tests';

  it('gives every player exactly one team per bucket', () => {
    const assignments = runDraw(teams, players, seed);
    players.forEach((player) => {
      const own = assignments.filter((a) => a.playerId === player.id);
      expect(own).toHaveLength(4);
      expect(new Set(own.map((a) => a.bucket))).toEqual(new Set([1, 2, 3, 4]));
    });
  });

  it('assigns each used team exactly once and leaves the remainder unowned', () => {
    const assignments = runDraw(teams, players, seed);
    expect(assignments).toHaveLength(40);
    expect(new Set(assignments.map((a) => a.teamId)).size).toBe(40);
  });

  it('is deterministic — same seed reproduces the same draw (verifiability)', () => {
    const first = runDraw(teams, players, seed);
    const second = runDraw(teams, players, seed);
    expect(second).toEqual(first);
  });

  it('produces a different draw for a different seed', () => {
    const a = runDraw(teams, players, 'seed-a');
    const b = runDraw(teams, players, 'seed-b');
    expect(b).not.toEqual(a);
  });
});

describe('revealOrder', () => {
  it('orders a player\'s teams weakest bucket first', () => {
    const assignments = runDraw(makeTeams(48), makePlayers(10), 'seed');
    const ordered = revealOrder(assignments, 'P1');
    expect(ordered.map((a) => a.bucket)).toEqual([4, 3, 2, 1]);
  });
});

describe('commit–reveal fairness', () => {
  it('a revealed seed verifies against its commitment', async () => {
    const seed = generateSeed();
    const hash = await commitSeed(seed);
    expect(await verifyCommitment(seed, hash)).toBe(true);
  });

  it('a tampered seed fails verification', async () => {
    const seed = generateSeed();
    const hash = await commitSeed(seed);
    expect(await verifyCommitment(`${seed}00`, hash)).toBe(false);
  });
});
