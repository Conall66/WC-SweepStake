// Storage abstraction. The app talks only to this interface, so the in-memory
// dev implementation can be swapped for a Firebase one without touching the UI.

import type { Assignment, DrawCommitment, Fixture, Player, SweepConfig, Team } from '../domain/types';

export interface SweepRepository {
  getConfig(): Promise<SweepConfig>;
  listTeams(): Promise<Team[]>;

  listPlayers(): Promise<Player[]>;
  addPlayer(player: Omit<Player, 'id' | 'joinedAt'>): Promise<Player>;

  getCommitment(): Promise<DrawCommitment | null>;
  saveCommitment(commitment: DrawCommitment): Promise<void>;

  listFixtures(): Promise<Fixture[]>;

  listAssignments(): Promise<Assignment[]>;
  saveAssignments(assignments: Assignment[]): Promise<void>;
  markRevealed(playerId: string, teamIds: string[], auto: boolean): Promise<void>;

  /** Subscribe to any change. Returns an unsubscribe function.
   *  The Firebase implementation will back this with realtime listeners. */
  subscribe(listener: () => void): () => void;
}
