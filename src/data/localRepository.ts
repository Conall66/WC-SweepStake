// Development repository: holds state in memory and persists to localStorage so
// a page refresh keeps the lobby and draw. Mirrors the async shape of the
// eventual Firebase implementation, including a simple change subscription.

import type { Assignment, DrawCommitment, Fixture, Player, SweepConfig, Team } from '../domain/types';
import type { SweepRepository } from './repository';
import { SEED_FIXTURES } from './seedFixtures';
import { SAMPLE_TEAMS } from './seedTeams';

interface PersistedState {
  players: Player[];
  commitment: DrawCommitment | null;
  assignments: Assignment[];
}

const DEFAULT_CONFIG: SweepConfig = {
  contributionPence: 500, // £5
  joinDeadline: new Date('2026-06-07T23:59:59Z').getTime(),
};

function loadState(key: string): PersistedState {
  if (typeof localStorage === 'undefined') {
    return { players: [], commitment: null, assignments: [] };
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    // Corrupt or unavailable storage — start fresh.
  }
  return { players: [], commitment: null, assignments: [] };
}

export class LocalRepository implements SweepRepository {
  private readonly storageKey: string;
  private state: PersistedState;

  private readonly listeners = new Set<() => void>();

  constructor(sweepId: string) {
    this.storageKey = `sweep:state:v1:${sweepId}`;
    this.state = loadState(this.storageKey);
  }

  private persist(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    }
    this.listeners.forEach((listener) => listener());
  }

  reset(): void {
    this.state = { players: [], commitment: null, assignments: [] };
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
    this.listeners.forEach((l) => l());
  }

  async getConfig(): Promise<SweepConfig> {
    return DEFAULT_CONFIG;
  }

  async listTeams(): Promise<Team[]> {
    return SAMPLE_TEAMS;
  }

  async listFixtures(): Promise<Fixture[]> {
    return SEED_FIXTURES;
  }

  async listPlayers(): Promise<Player[]> {
    return this.state.players;
  }

  async addPlayer(player: Omit<Player, 'id' | 'joinedAt'>): Promise<Player> {
    const created: Player = { ...player, id: crypto.randomUUID(), joinedAt: Date.now() };
    this.state.players = [...this.state.players, created];
    this.persist();
    return created;
  }

  async getCommitment(): Promise<DrawCommitment | null> {
    return this.state.commitment;
  }

  async saveCommitment(commitment: DrawCommitment): Promise<void> {
    this.state.commitment = commitment;
    this.persist();
  }

  async listAssignments(): Promise<Assignment[]> {
    return this.state.assignments;
  }

  async saveAssignments(assignments: Assignment[]): Promise<void> {
    this.state.assignments = assignments;
    this.persist();
  }

  async markRevealed(playerId: string, teamIds: string[], auto: boolean): Promise<void> {
    const now = Date.now();
    const teamIdSet = new Set(teamIds);
    this.state.assignments = this.state.assignments.map((assignment) =>
      assignment.playerId === playerId && teamIdSet.has(assignment.teamId)
        ? { ...assignment, revealedAt: assignment.revealedAt ?? now, revealedAuto: auto }
        : assignment,
    );
    this.persist();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
