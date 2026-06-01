// Application state. Loads everything from the repository, keeps it in sync via
// the change subscription, and exposes the handful of actions the screens need.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Assignment, DrawCommitment, Fixture, Player, SweepConfig, Team } from '../domain/types';
import { potPence, runDraw } from '../domain/draw';
import { commitSeed, generateSeed } from '../domain/fairness';
import { createRepository } from '../data';
import { LocalRepository } from '../data/localRepository';

interface AppState {
  loading: boolean;
  config: SweepConfig | null;
  teams: Team[];
  players: Player[];
  assignments: Assignment[];
  commitment: DrawCommitment | null;
  /** The current device's player. In production this comes from auth; in dev we
   *  treat the most recently added player as "you". */
  currentPlayerId: string | null;

  fixtures: Fixture[];
  joinClosed: boolean;
  drawComplete: boolean;
  potPence: number;

  addPlayer: (input: Omit<Player, 'id' | 'joinedAt'>) => Promise<void>;
  runDrawIfDue: () => Promise<void>;
  revealTeams: (playerId: string, teamIds: string[], auto?: boolean) => Promise<void>;
  /** DEV only. Wipes all persisted state for the current sweep and reloads. */
  resetSweep?: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children, sweepId }: { children: ReactNode; sweepId: string }) {
  const repository = useMemo(() => createRepository(sweepId), [sweepId]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SweepConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [commitment, setCommitment] = useState<DrawCommitment | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextPlayers, nextAssignments, nextCommitment] = await Promise.all([
      repository.listPlayers(),
      repository.listAssignments(),
      repository.getCommitment(),
    ]);
    setPlayers(nextPlayers);
    setAssignments(nextAssignments);
    setCommitment(nextCommitment);
  }, [repository]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [nextConfig, nextTeams, nextFixtures] = await Promise.all([
        repository.getConfig(),
        repository.listTeams(),
        repository.listFixtures(),
      ]);
      if (!active) return;
      setConfig(nextConfig);
      setTeams(nextTeams);
      setFixtures(nextFixtures);
      await refresh();
      setLoading(false);
    })();
    const unsubscribe = repository.subscribe(() => {
      void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  // In dev, "you" are the latest player to join. Replace with auth in production.
  useEffect(() => {
    if (players.length > 0) {
      setCurrentPlayerId((current) => current ?? players[players.length - 1]!.id);
    }
  }, [players]);

  const joinClosed = config ? Date.now() > config.joinDeadline : false;
  const drawComplete = assignments.length > 0;

  const addPlayer = useCallback(async (input: Omit<Player, 'id' | 'joinedAt'>) => {
    const created = await repository.addPlayer(input);
    setCurrentPlayerId(created.id);
  }, [repository]);

  // In production this runs once, server-side, after the deadline. Exposed here
  // so the lobby can trigger it in local development.
  const runDrawIfDue = useCallback(async () => {
    if (assignments.length > 0 || players.length === 0) return;
    const seed = generateSeed();
    const seedHash = await commitSeed(seed);
    // Commit first, then reveal the seed alongside the result. A real backend
    // would publish the commitment, pause, then run and publish the seed.
    await repository.saveCommitment({
      seedHash,
      seed,
      rankingSource: 'FIFA',
      createdAt: Date.now(),
    });
    await repository.saveAssignments(runDraw(teams, players, seed));
  }, [repository, assignments.length, players, teams]);

  const revealTeams = useCallback(
    async (playerId: string, teamIds: string[], auto = false) => {
      await repository.markRevealed(playerId, teamIds, auto);
    },
    [repository],
  );

  const resetSweep = import.meta.env.DEV
    ? () => {
        if (!window.confirm('DEV: Reset this sweep? All players and the draw will be cleared.')) return;
        (repository as LocalRepository).reset();
        window.location.reload();
      }
    : undefined;

  const value = useMemo<AppState>(
    () => ({
      loading,
      config,
      teams,
      fixtures,
      players,
      assignments,
      commitment,
      currentPlayerId,
      joinClosed,
      drawComplete,
      potPence: config ? potPence(players.length, config.contributionPence) : 0,
      addPlayer,
      runDrawIfDue,
      revealTeams,
      resetSweep,
    }),
    [
      loading,
      config,
      teams,
      fixtures,
      players,
      assignments,
      commitment,
      currentPlayerId,
      joinClosed,
      drawComplete,
      addPlayer,
      runDrawIfDue,
      revealTeams,
      resetSweep,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider.');
  return context;
}
