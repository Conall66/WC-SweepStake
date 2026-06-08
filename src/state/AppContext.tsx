// Application state. Loads the static sweep from the repository, keeps it in
// sync via the change subscription, and exposes the handful of actions the
// screens need: pick "you" and reveal teams.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Assignment, Player, SweepConfig, Team } from '../domain/types';
import { potPence } from '../domain/draw';
import { createRepository } from '../data';
import { LocalRepository } from '../data/localRepository';
import { resolveSeatPlayerId, seatStorageKey } from './seat';

const SWEEP_ID = 'wc2026';
const SEAT_KEY = seatStorageKey(SWEEP_ID);

interface AppState {
  loading: boolean;
  config: SweepConfig | null;
  teams: Team[];
  players: Player[];
  assignments: Assignment[];
  currentPlayerId: string | null;
  hasJoined: boolean;
  drawComplete: boolean;
  potPence: number;
  setCurrentPlayer: (id: string) => void;
  revealTeams: (playerId: string, teamIds: string[], auto?: boolean) => Promise<void>;
  resetSweep?: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => createRepository(), []);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SweepConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentPlayerId, setCurrentPlayerIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextPlayers, nextAssignments] = await Promise.all([
      repository.listPlayers(),
      repository.listAssignments(),
    ]);
    setPlayers(nextPlayers);
    setAssignments(nextAssignments);
  }, [repository]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [nextConfig, nextTeams] = await Promise.all([
        repository.getConfig(),
        repository.listTeams(),
      ]);
      if (!active) return;
      setConfig(nextConfig);
      setTeams(nextTeams);
      await refresh();
      setLoading(false);
    })();
    const unsubscribe = repository.subscribe(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [refresh]);

  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SEAT_KEY) : null;
    setCurrentPlayerIdState(resolveSeatPlayerId(stored, players));
  }, [players]);

  const setCurrentPlayer = useCallback((id: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SEAT_KEY, id);
    setCurrentPlayerIdState(id);
  }, []);

  const revealTeams = useCallback(
    async (playerId: string, teamIds: string[], auto = false) => {
      await repository.markRevealed(playerId, teamIds, auto);
    },
    [repository],
  );

  const resetSweep = import.meta.env.DEV
    ? () => {
        if (!window.confirm('DEV: Reset all reveals?')) return;
        (repository as LocalRepository).reset();
        if (typeof localStorage !== 'undefined') localStorage.removeItem(SEAT_KEY);
        setCurrentPlayerIdState(null);
      }
    : undefined;

  const value = useMemo<AppState>(
    () => ({
      loading,
      config,
      teams,
      players,
      assignments,
      currentPlayerId,
      hasJoined: currentPlayerId !== null,
      drawComplete: true,
      potPence: config ? potPence(players.length, config.contributionPence) : 0,
      setCurrentPlayer,
      revealTeams,
      resetSweep,
    }),
    [loading, config, teams, players, assignments, currentPlayerId, setCurrentPlayer, revealTeams, resetSweep],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider.');
  return context;
}
