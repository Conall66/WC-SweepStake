# Simplified WC Sweep — Final Delivery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the app to a self-contained reveal experience — hardcoded players, pre-computed draw, no join/draw UI, 3-tab navigation — and push to GitHub Pages today.

**Architecture:** All player and assignment data is computed at module load from a fixed seed in `sweepData.ts`. The repository becomes a thin layer that returns this static data and persists only reveal timestamps to localStorage. AppContext drops the join/draw/commitment machinery and gains a `setCurrentPlayer` action. Navigation reduces to three tabs: Home (instructions + player picker), Reveal (animation), Everyone (full roster).

**Tech Stack:** React 18 + Vite + TypeScript · localStorage for reveal persistence · GitHub Pages via existing Actions workflow

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/data/sweepData.ts` | 16 static players + deterministic assignments from fixed seed |
| **Create** | `src/data/sweepData.test.ts` | Verify player count, assignment count, bucket distribution |
| **Create** | `src/screens/RosterScreen.tsx` | Everyone's teams tab |
| **Modify** | `src/data/repository.ts` | Shrink interface to what the app still needs |
| **Modify** | `src/data/localRepository.ts` | Serve static data; persist only reveal timestamps |
| **Modify** | `src/data/index.ts` | Remove sweepId param |
| **Modify** | `src/state/AppContext.tsx` | Drop join/draw/commitment; add setCurrentPlayer |
| **Modify** | `src/screens/HomeScreen.tsx` | Instructions + player picker grid |
| **Modify** | `src/screens/RevealScreen.tsx` | Remove auto-reveal notice; gate on currentPlayerId |
| **Modify** | `src/components/TabBar.tsx` | 3 tabs: Home, Reveal, Everyone |
| **Modify** | `src/components/AppShell.tsx` | Wire 3-tab routing |
| **Modify** | `src/App.tsx` | Remove useSweepId + SweepPickerScreen |

---

## Task 1: Static player and assignment data

**Files:**
- Create: `src/data/sweepData.ts`
- Create: `src/data/sweepData.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/sweepData.test.ts
import { describe, expect, it } from 'vitest';
import { PLAYERS, BASE_ASSIGNMENTS } from './sweepData';

describe('sweepData', () => {
  it('has 16 players', () => {
    expect(PLAYERS).toHaveLength(16);
  });

  it('produces 48 assignments (16 players × 3 buckets)', () => {
    expect(BASE_ASSIGNMENTS).toHaveLength(48);
  });

  it('gives each player exactly 3 assignments across buckets 1, 2, 3', () => {
    for (const player of PLAYERS) {
      const mine = BASE_ASSIGNMENTS.filter((a) => a.playerId === player.id);
      expect(mine).toHaveLength(3);
      expect(new Set(mine.map((a) => a.bucket))).toEqual(new Set([1, 2, 3]));
    }
  });

  it('assigns every team exactly once', () => {
    const teamIds = BASE_ASSIGNMENTS.map((a) => a.teamId);
    expect(new Set(teamIds).size).toBe(48);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/data/sweepData.test.ts
```

Expected: `Cannot find module './sweepData'`

- [ ] **Step 3: Create `src/data/sweepData.ts`**

```ts
import type { Player, Assignment } from '../domain/types';
import { SAMPLE_TEAMS } from './seedTeams';
import { runDraw } from '../domain/draw';

const SEED = 'worldcup2026';

export const PLAYERS: Player[] = [
  { id: 'conall-t',    name: 'Conall T',    descriptor: 'The Manager',           joinedAt: 1749340800000 },
  { id: 'charlotte-k', name: 'Charlotte K', descriptor: 'The Hottie',            joinedAt: 1749340800000 },
  { id: 'sam-b',       name: 'Sam B',       descriptor: 'The Stepover Merchant', joinedAt: 1749340800000 },
  { id: 'liam-d',      name: 'Liam D',      descriptor: 'The Pace Abuser',       joinedAt: 1749340800000 },
  { id: 'katie-a',     name: 'Katie A',     descriptor: 'The Brains',            joinedAt: 1749340800000 },
  { id: 'amelia-b',    name: 'Amelia B',    descriptor: 'The Two Left Feet',     joinedAt: 1749340800000 },
  { id: 'archie-w',    name: 'Archie W',    descriptor: 'The Double Agent',      joinedAt: 1749340800000 },
  { id: 'finn-m',      name: 'Finn M',      descriptor: 'The Own Goal',          joinedAt: 1749340800000 },
  { id: 'abi-w',       name: 'Abi W',       descriptor: 'The Bolognese',         joinedAt: 1749340800000 },
  { id: 'caitlin-b',   name: 'Caitlin B',   descriptor: 'The Bulldog',           joinedAt: 1749340800000 },
  { id: 'daisy-h',     name: 'Daisy H',     descriptor: 'The Southampton Fan',   joinedAt: 1749340800000 },
  { id: 'charlotte-b', name: 'Charlotte B', descriptor: 'The Fall-Off Artist',   joinedAt: 1749340800000 },
  { id: 'oscar-h',     name: 'Oscar H',     descriptor: 'The Scout',             joinedAt: 1749340800000 },
  { id: 'gracie-f',    name: 'Gracie F',    descriptor: 'The 90+5',              joinedAt: 1749340800000 },
  { id: 'caelan-e',    name: 'Caelan E',    descriptor: 'The Swollen CR7',       joinedAt: 1749340800000 },
  { id: 'tom-b',       name: 'Tom B',       descriptor: 'Big Daddy',             joinedAt: 1749340800000 },
];

export const BASE_ASSIGNMENTS: Assignment[] = runDraw(SAMPLE_TEAMS, PLAYERS, SEED);
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --reporter=verbose src/data/sweepData.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/sweepData.ts src/data/sweepData.test.ts
git commit -m "feat: static player roster and deterministic draw from fixed seed"
```

---

## Task 2: Shrink repository interface and localRepository

**Files:**
- Modify: `src/data/repository.ts`
- Modify: `src/data/localRepository.ts`
- Modify: `src/data/index.ts`

The interface loses: `addPlayer`, `getCommitment`, `saveCommitment`, `listFixtures`, `saveAssignments`. The implementation serves static data and persists only reveal timestamps.

- [ ] **Step 1: Replace `src/data/repository.ts`**

```ts
import type { Assignment, Player, SweepConfig, Team } from '../domain/types';

export interface SweepRepository {
  getConfig(): Promise<SweepConfig>;
  listTeams(): Promise<Team[]>;
  listPlayers(): Promise<Player[]>;
  listAssignments(): Promise<Assignment[]>;
  markRevealed(playerId: string, teamIds: string[], auto: boolean): Promise<void>;
  subscribe(listener: () => void): () => void;
}
```

- [ ] **Step 2: Replace `src/data/localRepository.ts`**

```ts
import type { Assignment, Player, SweepConfig, Team } from '../domain/types';
import type { SweepRepository } from './repository';
import { SAMPLE_TEAMS } from './seedTeams';
import { PLAYERS, BASE_ASSIGNMENTS } from './sweepData';

const REVEALS_KEY = 'sweep:reveals:v1';

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

  reset(): void {
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
    return BASE_ASSIGNMENTS.map((a) => {
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
```

- [ ] **Step 3: Simplify `src/data/index.ts`**

```ts
import type { SweepRepository } from './repository';
import { LocalRepository } from './localRepository';

export function createRepository(): SweepRepository {
  return new LocalRepository();
}
```

- [ ] **Step 4: Run type-check to surface any remaining consumers of removed methods**

```bash
npm run build 2>&1 | head -60
```

Expected: errors only in `AppContext.tsx` (next task). If any other file errors, fix it now.

- [ ] **Step 5: Commit**

```bash
git add src/data/repository.ts src/data/localRepository.ts src/data/index.ts
git commit -m "refactor: simplify repository to static data + reveal persistence"
```

---

## Task 3: Simplify AppContext

**Files:**
- Modify: `src/state/AppContext.tsx`

Drop: `sweepId` prop, `addPlayer`, `runDrawIfDue`, `commitment`, `fixtures`. Add: `setCurrentPlayer`. `drawComplete` is hardwired to `true` so RevealScreen's guard still compiles without touching it.

- [ ] **Step 1: Replace `src/state/AppContext.tsx`**

```tsx
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
```

- [ ] **Step 2: Run type-check**

```bash
npm run build 2>&1 | head -60
```

Expected: errors in `HomeScreen.tsx` (uses `addPlayer`, `commitment`) and `App.tsx` (passes `sweepId` prop). Fine — those are the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/state/AppContext.tsx
git commit -m "refactor: strip AppContext to reveal-only — no join/draw/commitment"
```

---

## Task 4: Redesign HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

Instructions + player grid. Clicking a player name sets them as current player and navigates to the Reveal tab.

- [ ] **Step 1: Replace `src/screens/HomeScreen.tsx`**

```tsx
import { useApp } from '../state/AppContext';
import type { TabKey } from '../components/TabBar';

export function HomeScreen({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { players, currentPlayerId, setCurrentPlayer, potPence } = useApp();
  const pounds = (potPence / 100).toFixed(0);

  function handlePickPlayer(id: string) {
    setCurrentPlayer(id);
    onNavigate('reveal');
  }

  return (
    <>
      <div className="card" style={{ marginTop: 8 }}>
        <span className="eyebrow">Season 2026 · USA · CAN · MEX</span>
        <h1 className="word" style={{ marginTop: 10 }}>
          THE
          <br />
          SWEEP
        </h1>
        <p className="sub" style={{ marginTop: 9 }}>
          48 nations. 16 players. 3 teams each. Bragging rights until July 19th.
        </p>
      </div>

      <div className="card">
        <span className="eyebrow">How it works</span>
        <ol style={{ listStyle: 'none', marginTop: 10, display: 'grid', gap: 11 }}>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--grass)' }}>1</span>
            <span className="sub">
              Teams are ranked by FIFA and split into 3 equal bands — top seeds, contenders,
              and long shots. Everyone gets one from each band.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--grass)' }}>2</span>
            <span className="sub">
              Your 3 teams were assigned by a random draw. Tap your name below to reveal them —
              weakest first, best saved for last.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--grass)' }}>3</span>
            <span className="sub">
              Each player has put in £5. Pot: <strong>£{pounds}</strong>. Settled between
              players outside the app.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--gold, #d4a017)' }}>★</span>
            <span className="sub">
              <strong>Bonus prize:</strong> 20% of the pot goes to whoever has all their teams
              knocked out first. Get eliminated early, get rewarded.
            </span>
          </li>
        </ol>
      </div>

      <div className="card">
        <span className="eyebrow">Tap your name to reveal your teams</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 12,
          }}
        >
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              className={`btn${player.id === currentPlayerId ? ' gold' : ' ghost'}`}
              style={{ fontSize: 13, padding: '10px 8px', textAlign: 'left' }}
              onClick={() => handlePickPlayer(player.id)}
            >
              <div style={{ fontWeight: 700 }}>{player.name}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{player.descriptor}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Check types compile**

```bash
npm run build 2>&1 | grep HomeScreen
```

Expected: no HomeScreen errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: homescreen — rules, gamification note, player picker grid"
```

---

## Task 5: Create RosterScreen

**Files:**
- Create: `src/screens/RosterScreen.tsx`

Shows every player's 3 teams. A player's teams only appear once they've completed their full reveal (all 3 `revealedAt !== null`), so the reveal animation retains its purpose.

- [ ] **Step 1: Create `src/screens/RosterScreen.tsx`**

```tsx
import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { buildRoster } from '../domain/roster';
import { flagEmoji } from '../domain/flags';

export function RosterScreen() {
  const { teams, players, assignments, currentPlayerId } = useApp();

  const roster = useMemo(
    () => buildRoster(assignments, players, teams),
    [assignments, players, teams],
  );

  const anyRevealed = roster.some((entry) =>
    entry.teams.some(({ assignment }) => assignment.revealedAt !== null),
  );

  return (
    <>
      <span className="eyebrow gold">Everyone's draw</span>
      <h2 className="title">THE SQUADS</h2>

      {!anyRevealed && (
        <p className="placeholder" style={{ marginTop: 16 }}>
          Teams appear here once a player has finished their reveal.
        </p>
      )}

      {roster.map((entry) => {
        const allRevealed = entry.teams.every(({ assignment }) => assignment.revealedAt !== null);
        return (
          <div key={entry.player.id} style={{ marginBottom: 20 }}>
            <div
              className="mono sub"
              style={{
                fontSize: 11,
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                {entry.player.name}
                {entry.player.id === currentPlayerId ? ' · You' : ''}
              </span>
              <span style={{ opacity: 0.5 }}>{entry.player.descriptor}</span>
            </div>

            {allRevealed ? (
              entry.teams.map(({ team, assignment }) => (
                <div className="row" key={`${entry.player.id}-${team.id}`}>
                  <span className="fl">{flagEmoji(team.isoCode)}</span>
                  <span className="nm">{team.name}</span>
                  <span className="bk">B{assignment.bucket}</span>
                </div>
              ))
            ) : (
              <p
                className="placeholder"
                style={{ fontSize: 11, margin: '4px 0', opacity: 0.5 }}
              >
                Not revealed yet
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/RosterScreen.tsx
git commit -m "feat: roster screen — everyone's teams, gated behind completed reveal"
```

---

## Task 6: Simplify RevealScreen

**Files:**
- Modify: `src/screens/RevealScreen.tsx`

Two changes: (1) gate on `!currentPlayerId` instead of `!drawComplete`, since the draw is always complete now; (2) remove the auto-reveal "notice" block (that feature isn't shipping).

- [ ] **Step 1: Change the early-return guard**

In `src/screens/RevealScreen.tsx`, find and replace:

```tsx
  if (!drawComplete) {
    return (
      <>
        <span className="eyebrow gold">Your reveal</span>
        <h2 className="title">YOUR TEAMS</h2>
        <p className="placeholder">
          The draw hasn&apos;t run yet. Once the draw is made, your teams
          appear here to reveal — weakest bucket first.
        </p>
      </>
    );
  }
```

Replace with:

```tsx
  if (!currentPlayerId) {
    return (
      <>
        <span className="eyebrow gold">Your reveal</span>
        <h2 className="title">YOUR TEAMS</h2>
        <p className="placeholder">
          Tap your name on the Home tab to get started.
        </p>
      </>
    );
  }
```

- [ ] **Step 2: Remove the auto-reveal notice**

Find and delete this block (lines 78–84):

```tsx
      <div className="notice">
        <span>⏱</span>
        <p>
          Haven&apos;t opened your teams before your first match? No problem — we&apos;ll{' '}
          <strong>reveal them automatically</strong> so you&apos;re never behind on results.
        </p>
      </div>
```

- [ ] **Step 3: Remove unused `drawComplete` from destructure**

Find:
```tsx
  const { teams, players, assignments, currentPlayerId, revealTeams, drawComplete } = useApp();
```

Replace with:
```tsx
  const { teams, players, assignments, currentPlayerId, revealTeams } = useApp();
```

- [ ] **Step 4: Type-check**

```bash
npm run build 2>&1 | grep RevealScreen
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/RevealScreen.tsx
git commit -m "fix: reveal screen — gate on player selection, remove auto-reveal notice"
```

---

## Task 7: Reduce navigation to 3 tabs

**Files:**
- Modify: `src/components/TabBar.tsx`
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Replace `src/components/TabBar.tsx`**

```tsx
import type { ReactNode } from 'react';

export type TabKey = 'home' | 'reveal' | 'roster';

const ICONS: Record<TabKey, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  reveal: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  roster: (
    <svg viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
};

const LABELS: Record<TabKey, string> = {
  home: 'Home',
  reveal: 'Reveal',
  roster: 'Everyone',
};

const ORDER: TabKey[] = ['home', 'reveal', 'roster'];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="tabbar">
      {ORDER.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`tab${tab === active ? ' active' : ''}`}
          onClick={() => onChange(tab)}
          aria-current={tab === active}
        >
          {ICONS[tab]}
          <span className="lab">{LABELS[tab]}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Replace `src/components/AppShell.tsx`**

```tsx
import { useState } from 'react';
import { TabBar, type TabKey } from './TabBar';
import { HomeScreen } from '../screens/HomeScreen';
import { RevealScreen } from '../screens/RevealScreen';
import { RosterScreen } from '../screens/RosterScreen';
import { useApp } from '../state/AppContext';

export function AppShell() {
  const [tab, setTab] = useState<TabKey>('home');
  const { loading } = useApp();

  if (loading) {
    return (
      <div className="app">
        <div className="screen">
          <p className="placeholder">Loading the sweep…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="screen">
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'reveal' && <RevealScreen />}
        {tab === 'roster' && <RosterScreen />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TabBar.tsx src/components/AppShell.tsx
git commit -m "refactor: reduce to 3 tabs — Home, Reveal, Everyone"
```

---

## Task 8: Simplify App.tsx

**Files:**
- Modify: `src/App.tsx`

Remove `useSweepId` and `SweepPickerScreen`. `AppProvider` no longer takes `sweepId`.

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { AppProvider } from './state/AppContext';
import { AppShell } from './components/AppShell';

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
```

- [ ] **Step 2: Full type-check and build**

```bash
npm run build 2>&1
```

Expected: clean build, no TypeScript errors. If there are errors, fix them before continuing.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass (sweepData suite + existing draw/seat suites).

- [ ] **Step 4: Smoke-test locally**

```bash
npm run preview
```

Open http://localhost:4173 (or wherever preview serves). Verify:
- Home tab shows instructions, gamification note, and 16 player buttons
- Tapping a player navigates to Reveal tab
- Reveal animation runs, shows 3 steps (3 teams)
- After all 3 revealed, inline roster appears
- Everyone tab shows "Not revealed yet" for players who haven't finished

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: remove sweep picker — single hardcoded sweep"
```

---

## Task 9: Deploy to GitHub Pages

The workflow at `.github/workflows/deploy.yml` auto-deploys on push to `main`. The `vite.config.ts` already handles the `/WC-SweepStake/` base path when `GITHUB_PAGES=true`.

- [ ] **Step 1: Push to main using personal credentials**

The machine defaults to the AECOM identity. Use the personal token to push as Conall66:

```bash
unset GITHUB_TOKEN
TOKEN=$(gh auth token --user Conall66)
git -c credential.helper= push "https://Conall66:$TOKEN@github.com/Conall66/WC-SweepStake.git" main
```

- [ ] **Step 2: Watch the Actions run**

```bash
gh run watch --repo Conall66/WC-SweepStake
```

Or open `https://github.com/Conall66/WC-SweepStake/actions` directly.

Expected: "Deploy to GitHub Pages" workflow succeeds (≈ 2 minutes).

- [ ] **Step 3: Verify live site**

Open `https://conall66.github.io/WC-SweepStake/` and confirm:
- App loads (not a 404 or blank screen)
- Player picker appears on Home
- Tapping a name navigates to Reveal
- Reveal animation works end-to-end

Share the URL with players: `https://conall66.github.io/WC-SweepStake/`

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|-----------|
| Open app, read instructions | Task 4 — HomeScreen rules section |
| £5 contribution noted | Task 4 — pot displayed in instructions |
| Click your profile | Task 4 — player picker grid, navigates to Reveal |
| Reveal animation | Task 6 — RevealScreen unchanged apart from guard |
| See everyone's teams after reveal | Task 5 — RosterScreen, gated per player |
| 20% bonus for first eliminated | Task 4 — called out in HomeScreen instructions |
| Pre-allocated teams (no join flow) | Tasks 1–3 — static data, no addPlayer |
| Re-reveal supported | RevealScreen "REVEAL AGAIN" button untouched |
| Deploy today | Task 9 — push to main → GH Actions |

**Placeholder scan:** None found — all steps contain actual code or commands.

**Type consistency:** `setCurrentPlayer`, `revealTeams`, `LocalRepository.reset()` are all defined in Task 3 and referenced consistently across Tasks 4–8.
