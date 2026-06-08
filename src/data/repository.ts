// Storage abstraction. The app talks only to this interface. With the draw and
// roster now baked into static module data, this shrinks to read-only accessors
// plus reveal persistence.

import type { Assignment, Player, SweepConfig, Team } from '../domain/types';

export interface SweepRepository {
  getConfig(): Promise<SweepConfig>;
  listTeams(): Promise<Team[]>;
  listPlayers(): Promise<Player[]>;
  listAssignments(): Promise<Assignment[]>;
  markRevealed(playerId: string, teamIds: string[], auto: boolean): Promise<void>;
  subscribe(listener: () => void): () => void;
}
