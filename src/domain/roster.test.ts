import { describe, expect, it } from 'vitest';
import type { Assignment, Player, Team } from './types';
import { buildRoster } from './roster';

const players: Player[] = [
  { id: 'p1', name: 'Ana', descriptor: '', joinedAt: 0 },
  { id: 'p2', name: 'Bo', descriptor: '', joinedAt: 0 },
];

const teams: Team[] = [
  { id: 't1', name: 'Alpha', isoCode: 'aa', fifaRank: 1 },
  { id: 't2', name: 'Beta', isoCode: 'bb', fifaRank: 2 },
  { id: 't3', name: 'Gamma', isoCode: 'cc', fifaRank: 3 },
];

function assign(teamId: string, playerId: string, bucket: number, revealed: boolean): Assignment {
  return { teamId, playerId, bucket, revealedAt: revealed ? 100 : null, revealedAuto: false };
}

describe('buildRoster', () => {
  it('groups every assignment by player, including unrevealed teams', () => {
    const assignments = [
      assign('t1', 'p1', 1, true),
      assign('t2', 'p1', 2, false), // unrevealed — still listed
      assign('t3', 'p2', 1, false),
    ];

    const roster = buildRoster(assignments, players, teams);

    expect(roster).toHaveLength(2);
    expect(roster[0]!.player.id).toBe('p1');
    expect(roster[0]!.teams.map((t) => t.team.id)).toEqual(['t1', 't2']);
    expect(roster[1]!.player.id).toBe('p2');
    expect(roster[1]!.teams.map((t) => t.team.id)).toEqual(['t3']);
  });

  it('orders each player\'s teams by bucket ascending (strongest first)', () => {
    const assignments = [
      assign('t3', 'p1', 3, false),
      assign('t1', 'p1', 1, true),
      assign('t2', 'p1', 2, false),
    ];

    const roster = buildRoster(assignments, players.slice(0, 1), teams);

    expect(roster[0]!.teams.map((t) => t.assignment.bucket)).toEqual([1, 2, 3]);
  });

  it('orders players by the players array, not assignment order', () => {
    const assignments = [assign('t3', 'p2', 1, false), assign('t1', 'p1', 1, true)];

    const roster = buildRoster(assignments, players, teams);

    expect(roster.map((entry) => entry.player.id)).toEqual(['p1', 'p2']);
  });

  it('omits players who have no assignments', () => {
    const assignments = [assign('t1', 'p1', 1, true)];

    const roster = buildRoster(assignments, players, teams);

    expect(roster.map((entry) => entry.player.id)).toEqual(['p1']);
  });
});
