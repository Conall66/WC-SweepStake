// Local repository: serves the static players/teams/assignments and persists
// only reveal timestamps to localStorage, so a refresh keeps which of your
// teams you've already opened. Mirrors the async shape of an eventual backend.

import type { Assignment, Player, SweepConfig, Team } from '../domain/types';
import type { SweepRepository } from './repository';
import { SAMPLE_TEAMS } from './seedTeams';
import { PLAYERS, computeAssignments } from './sweepData';
import { clearSeedOverride, generateSeed, getActiveSeed, setSeedOverride } from './activeSeed';
import { STORAGE_GENERATION } from './storage';

const REVEALS_KEY = `sweep:reveals:${STORAGE_GENERATION}`;

interface RevealRecord {
  revealedAt: number;
  revealedAuto: boolean;
}

function loadReveals(): Record<string, RevealRecord> {
  try {
    return JSON.parse(localStorage.getItem(REVEALS_KEY) ?? '{}') as Record<string, RevealRecord>;
  } catch {
    return {};
  }
}

function saveReveals(reveals: Record<string, RevealRecord>): void {
  localStorage.setItem(REVEALS_KEY, JSON.stringify(reveals));
}

export class LocalRepository implements SweepRepository {
  private readonly listeners = new Set<() => void>();

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  /** The seed the draw is currently computed from (default, or a dev override). */
  activeSeed(): string {
    return getActiveSeed();
  }

  /** Clear this device's reveals only. The draw is unchanged. */
  reset(): void {
    localStorage.removeItem(REVEALS_KEY);
    this.notify();
  }

  /** Dev: pick a fresh random seed (a new draw) and clear reveals. Local-only —
   *  to make a draw live for everyone, bake its seed into sweepData.ts. */
  reshuffle(): void {
    setSeedOverride(generateSeed());
    localStorage.removeItem(REVEALS_KEY);
    this.notify();
  }

  /** Dev: drop the seed override, returning to the baked-in draw, and clear reveals. */
  restoreDefaultDraw(): void {
    clearSeedOverride();
    localStorage.removeItem(REVEALS_KEY);
    this.notify();
  }

  async getConfig(): Promise<SweepConfig> {
    return { contributionPence: 500 };
  }

  async listTeams(): Promise<Team[]> {
    return SAMPLE_TEAMS;
  }

  async listPlayers(): Promise<Player[]> {
    return PLAYERS;
  }

  async listAssignments(): Promise<Assignment[]> {
    const reveals = loadReveals();
    return computeAssignments(getActiveSeed()).map((a) => {
      const rec = reveals[`${a.playerId}:${a.teamId}`];
      return rec ? { ...a, revealedAt: rec.revealedAt, revealedAuto: rec.revealedAuto } : a;
    });
  }

  async markRevealed(playerId: string, teamIds: string[], auto: boolean): Promise<void> {
    const reveals = loadReveals();
    const now = Date.now();
    for (const teamId of teamIds) {
      const key = `${playerId}:${teamId}`;
      if (!reveals[key]) reveals[key] = { revealedAt: now, revealedAuto: auto };
    }
    saveReveals(reveals);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
