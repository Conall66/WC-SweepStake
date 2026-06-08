// Full-roster view: every player grouped with their complete set of teams,
// revealed or not. Shown once a player has revealed all of their own teams.

import type { Assignment, Player, Team } from './types';

export interface RosterTeam {
  team: Team;
  assignment: Assignment;
}

export interface RosterEntry {
  player: Player;
  teams: RosterTeam[];
}

export function buildRoster(
  assignments: readonly Assignment[],
  players: readonly Player[],
  teams: readonly Team[],
): RosterEntry[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));

  return players
    .map((player) => {
      const teamsForPlayer = assignments
        .filter((assignment) => assignment.playerId === player.id)
        .map((assignment) => {
          const team = teamById.get(assignment.teamId);
          return team ? { team, assignment } : null;
        })
        .filter((entry): entry is RosterTeam => entry !== null)
        .sort((a, b) => a.assignment.bucket - b.assignment.bucket);
      return { player, teams: teamsForPlayer };
    })
    .filter((entry) => entry.teams.length > 0);
}
