// The draw engine. Pure functions over the data model — no storage, no UI.
//
// Mechanics:
//   * Teams are ranked by FIFA ranking and split into equal buckets of size
//     `playerCount`. Bucket 1 holds the strongest band, ascending to the weakest.
//   * The number of buckets is floor(totalTeams / playerCount); each player
//     receives exactly one team from every bucket. Any leftover teams (the
//     remainder) are unowned and sit the sweepstake out — this is expected.
//   * Within each bucket, teams are dealt to players via a seeded shuffle, so
//     the whole draw is reproducible from the seed alone.

import type { Assignment, Player, Team } from './types';
import { makeRandom, shuffle } from './prng';

export interface DrawPlan {
  /** Number of buckets, and therefore the number of teams each player gets. */
  bucketCount: number;
  /** Buckets from strongest (index 0 = bucket 1) to weakest. */
  buckets: Team[][];
  /** Teams left over after even division — owned by nobody. */
  unownedTeamIds: string[];
}

/** Work out the bucket structure for a given set of teams and player count. */
export function planDraw(teams: readonly Team[], playerCount: number): DrawPlan {
  if (playerCount < 1) {
    throw new Error('A draw needs at least one player.');
  }

  const ranked = teams.slice().sort((a, b) => a.fifaRank - b.fifaRank);
  const bucketCount = Math.floor(ranked.length / playerCount);
  const usedCount = bucketCount * playerCount;

  const buckets: Team[][] = [];
  for (let i = 0; i < bucketCount; i += 1) {
    buckets.push(ranked.slice(i * playerCount, (i + 1) * playerCount));
  }

  const unownedTeamIds = ranked.slice(usedCount).map((team) => team.id);
  return { bucketCount, buckets, unownedTeamIds };
}

/**
 * Run the full draw deterministically from a seed. Re-running with the same
 * teams, players and seed always yields identical assignments — the property
 * that makes the result verifiable.
 */
export function runDraw(
  teams: readonly Team[],
  players: readonly Player[],
  seed: string,
): Assignment[] {
  const plan = planDraw(teams, players.length);
  const random = makeRandom(seed);
  const assignments: Assignment[] = [];

  plan.buckets.forEach((bucketTeams, index) => {
    const bucketNumber = index + 1; // 1 = strongest band
    const dealtPlayers = shuffle(players, random);
    bucketTeams.forEach((team, position) => {
      assignments.push({
        teamId: team.id,
        playerId: dealtPlayers[position]!.id,
        bucket: bucketNumber,
        revealedAt: null,
        revealedAuto: false,
      });
    });
  });

  return assignments;
}

/**
 * A player's own teams in reveal order: weakest bucket first, strongest last,
 * so their marquee team lands at the end.
 */
export function revealOrder(assignments: readonly Assignment[], playerId: string): Assignment[] {
  return assignments
    .filter((assignment) => assignment.playerId === playerId)
    .sort((a, b) => b.bucket - a.bucket);
}

/** The pot total in pence — purely informational; no money is handled here. */
export function potPence(playerCount: number, contributionPence: number): number {
  return playerCount * contributionPence;
}

/**
 * Assignments that should be auto-revealed because their team is about to play
 * and the owner has not opened them yet. Keeps everyone's view complete before
 * any result can appear.
 */
export function pendingAutoReveals(
  assignments: readonly Assignment[],
  kickoffByTeamId: Readonly<Record<string, number>>,
  now: number,
  leadMs: number = 30 * 60 * 1000,
): Assignment[] {
  return assignments.filter((assignment) => {
    if (assignment.revealedAt !== null) return false;
    const kickoff = kickoffByTeamId[assignment.teamId];
    return kickoff !== undefined && kickoff - now <= leadMs;
  });
}
