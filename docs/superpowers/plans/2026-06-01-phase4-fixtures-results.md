# Phase 4 — Fixtures, Kickoff/Result Notifications, API-Sports & commitDraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on Phases 1–3 being merged.**

**Goal:** Seed teams + fixtures into Firestore; extend the `tick` engine with rule 4 (your team plays soon, naming the opposing player) and rule 5 (final result), driven by an API-Sports poll that runs only when an owned-team fixture is live; and move the draw write behind a `commitDraw` callable so client write rules stay locked.

**Architecture:** A pure `resolveOwners` + message-building module produces opponent-aware kickoff/result copy (unit-tested). `evaluateNotifications` gains rules 4–5 over `fixtures` + `assignments` + `teams`. A pure `fixturesNeedingPoll` decides when to call API-Sports, so the API is hit only for live owned-team fixtures (free-tier safe). The tick writes updated scores back to `fixtures` docs (driving rule 5 and everyone's Fixtures screen). `commitDraw` receives the client-computed provably-fair result and writes `commitment` + `assignments` via the admin SDK; the client repository routes those writes through it.

**Tech Stack:** `firebase-admin/firestore`, `firebase-functions/v2/https` (callable) + `params` (secret `API_SPORTS_KEY`), `node:fetch`, Vitest.

---

## Shared Contract additions (read first)

- **`SweepState` gains `teams: Team[]`** (needed for display names in messages). `loadState` is updated to load `sweeps/{id}/teams`. Phase 3's engine signature is otherwise unchanged.
- **Owner resolution** (`functions/src/engine/opponents.ts`, pure + tested):

```ts
export function ownerOf(teamId: string, assignments: Assignment[]): string | null;
export interface OwnerView { playerId: string; teamId: string; opponentName: string | null; }
/** Owners (if any) of a fixture's two teams, each told their opponent's name. */
export function resolveFixtureOwners(
  fixture: Fixture, assignments: Assignment[], players: StoredPlayer[],
): OwnerView[];
export function kickoffMessage(view: OwnerView, fixture: Fixture, teamName: (id: string) => string): { title: string; body: string };
export function resultMessage(view: OwnerView, fixture: Fixture, teamName: (id: string) => string): { title: string; body: string };
```

- **Rule 4 window:** owned-team fixture kicks off within the next hour — `kickoff - 1h <= now < kickoff`. Key `kickoff__{fixtureId}__{playerId}`. Target: owner(s) of either team.
- **Rule 5 condition:** both scores non-null (final). Key `result__{fixtureId}__{playerId}`. Target: owner(s) of either team.
- **API-Sports gate** (`fixturesNeedingPoll`, pure): a fixture needs polling iff it has ≥1 owned team **and** `kickoff <= now <= kickoff + 3h` **and** its score is not yet final (`homeScore == null || awayScore == null`). Empty result ⇒ no API call this tick.
- **`commitDraw` payload:** `{ sweepId, commitment: DrawCommitment, assignments: Assignment[] }`. The function writes `commitment/current` and each `assignments/{teamId}` via admin SDK. Caller must be authenticated. (For this sweepstake the draw is trust-on-first-write; a future hardening could recompute server-side from the seed.)

---

## File Structure

| Path | Created/Modified | Responsibility |
|---|---|---|
| `functions/src/engine/opponents.ts` | Create | Pure owner resolution + message copy |
| `functions/test/opponents.test.ts` | Create | Unit tests |
| `functions/src/engine/poll.ts` | Create | Pure `fixturesNeedingPoll` |
| `functions/test/poll.test.ts` | Create | Unit tests |
| `functions/src/engine/notifications.ts` | Modify | Add rules 4–5; add `teams` to `SweepState` |
| `functions/test/notifications.test.ts` | Modify | Add rule 4–5 cases |
| `functions/src/types.ts` | Modify | Add `Team`, `DrawCommitment` mirrors |
| `functions/src/tick/loadState.ts` | Modify | Load `teams` |
| `functions/src/apiSports/client.ts` | Create | API-Sports fetch wrapper |
| `functions/src/apiSports/mapStatus.ts` | Create | Pure finished/score mapping |
| `functions/test/mapStatus.test.ts` | Create | Unit tests |
| `functions/src/tick/runTick.ts` | Modify | Poll + write-back before evaluation |
| `functions/test/runTick.test.ts` | Modify | Result idempotency case |
| `functions/src/commitDraw.ts` | Create | Callable draw write |
| `functions/test/commitDraw.test.ts` | Create | Emulator test |
| `functions/src/index.ts` | Modify | Export `commitDraw` |
| `functions/src/tick.ts` | Modify | Pass API key to runTick |
| `src/data/firebaseRepository.ts` | Modify | Route saveCommitment/saveAssignments via commitDraw |
| `scripts/seed-firestore.mjs` | Create | Seed teams + fixtures into Firestore |
| `scripts/fetch-tournament.mjs` | Modify | Note: feeds the seeder |
| `.env.example` | Modify | Document `API_SPORTS_KEY` for functions |

---

## Task 1: Owner resolution + message copy (TDD)

**Files:**
- Create: `functions/src/engine/opponents.ts`, `functions/test/opponents.test.ts`
- Modify: `functions/src/types.ts` (add `Team`, `DrawCommitment`)

- [ ] **Step 1: Add mirrors to `functions/src/types.ts`**

```ts
export interface Team {
  id: string;
  name: string;
  isoCode: string;
  fifaRank: number;
  mapName?: string;
}

export interface DrawCommitment {
  seedHash: string;
  seed: string | null;
  rankingSource: 'FIFA';
  createdAt: number;
}
```

- [ ] **Step 2: Write the failing test `functions/test/opponents.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  ownerOf, resolveFixtureOwners, kickoffMessage, resultMessage,
} from '../src/engine/opponents.js';
import type { Assignment, Fixture, StoredPlayer } from '../src/types.js';

const players: StoredPlayer[] = [
  { id: 'p1', name: 'You', descriptor: '', joinedAt: 1, authUid: 'u1', fcmTokens: [] },
  { id: 'p2', name: 'Dave', descriptor: '', joinedAt: 2, authUid: 'u2', fcmTokens: [] },
];
const assignments: Assignment[] = [
  { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: 1, revealedAuto: false },
  { teamId: 'BRA', playerId: 'p2', bucket: 1, revealedAt: 1, revealedAuto: false },
];
const teamName = (id: string) => ({ ESP: 'Spain', BRA: 'Brazil', ARG: 'Argentina' }[id] ?? id);
const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  id: 'f1', homeTeamId: 'ESP', awayTeamId: 'BRA', kickoff: 1000, stage: 'Group A',
  homeScore: null, awayScore: null, ...over,
});

describe('owner resolution', () => {
  it('ownerOf finds the owning player', () => {
    expect(ownerOf('ESP', assignments)).toBe('p1');
    expect(ownerOf('ARG', assignments)).toBeNull();
  });

  it('resolveFixtureOwners names the opposing player when both owned', () => {
    const views = resolveFixtureOwners(fixture(), assignments, players);
    const byTeam = Object.fromEntries(views.map((v) => [v.teamId, v]));
    expect(byTeam.ESP!.opponentName).toBe('Dave');
    expect(byTeam.BRA!.opponentName).toBe('You');
  });

  it('opponent is null when the other team is unowned', () => {
    const views = resolveFixtureOwners(
      fixture({ awayTeamId: 'ARG' }), assignments, players,
    );
    expect(views).toHaveLength(1);
    expect(views[0]!.teamId).toBe('ESP');
    expect(views[0]!.opponentName).toBeNull();
  });
});

describe('messages', () => {
  it('kickoff names the opponent', () => {
    const view = { playerId: 'p1', teamId: 'ESP', opponentName: 'Dave' };
    const m = kickoffMessage(view, fixture(), teamName);
    expect(m.body).toContain('Spain');
    expect(m.body).toContain('Dave');
  });

  it('result says you won when your team scores more', () => {
    const view = { playerId: 'p1', teamId: 'ESP', opponentName: 'Dave' };
    const m = resultMessage(view, fixture({ homeScore: 2, awayScore: 1 }), teamName);
    expect(m.body).toContain('Spain 2');
    expect(m.body.toLowerCase()).toContain('beat dave');
  });

  it('result says you lost when your team scores fewer', () => {
    const view = { playerId: 'p2', teamId: 'BRA', opponentName: 'You' };
    const m = resultMessage(view, fixture({ homeScore: 2, awayScore: 1 }), teamName);
    expect(m.body.toLowerCase()).toContain('lost');
  });

  it('result without an owned opponent omits a name', () => {
    const view = { playerId: 'p1', teamId: 'ESP', opponentName: null };
    const m = resultMessage(view, fixture({ awayTeamId: 'ARG', homeScore: 1, awayScore: 0 }), teamName);
    expect(m.body).toContain('Spain');
    expect(m.body).not.toContain('null');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm --prefix functions exec vitest run test/opponents.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `functions/src/engine/opponents.ts`**

```ts
// Pure owner resolution + opponent-aware notification copy. No I/O. The team
// name lookup is injected so this stays unit-testable.
import type { Assignment, Fixture, StoredPlayer } from '../types.js';

export interface OwnerView {
  playerId: string;
  teamId: string;
  opponentName: string | null; // opposing player's name, or null if unowned
}

export function ownerOf(teamId: string, assignments: Assignment[]): string | null {
  return assignments.find((a) => a.teamId === teamId)?.playerId ?? null;
}

export function resolveFixtureOwners(
  fixture: Fixture, assignments: Assignment[], players: StoredPlayer[],
): OwnerView[] {
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const homeOwner = ownerOf(fixture.homeTeamId, assignments);
  const awayOwner = ownerOf(fixture.awayTeamId, assignments);
  const views: OwnerView[] = [];
  if (homeOwner) {
    views.push({
      playerId: homeOwner, teamId: fixture.homeTeamId,
      opponentName: awayOwner ? nameById.get(awayOwner) ?? null : null,
    });
  }
  if (awayOwner) {
    views.push({
      playerId: awayOwner, teamId: fixture.awayTeamId,
      opponentName: homeOwner ? nameById.get(homeOwner) ?? null : null,
    });
  }
  return views;
}

export function kickoffMessage(
  view: OwnerView, fixture: Fixture, teamName: (id: string) => string,
): { title: string; body: string } {
  const mine = teamName(view.teamId);
  const otherId = view.teamId === fixture.homeTeamId ? fixture.awayTeamId : fixture.homeTeamId;
  const other = teamName(otherId);
  const versus = view.opponentName
    ? `you're up against ${view.opponentName}`
    : `against ${other}`;
  return {
    title: `${mine} play soon`,
    body: `Your ${mine} play soon — ${versus}.`,
  };
}

export function resultMessage(
  view: OwnerView, fixture: Fixture, teamName: (id: string) => string,
): { title: string; body: string } {
  const mine = teamName(view.teamId);
  const home = teamName(fixture.homeTeamId);
  const away = teamName(fixture.awayTeamId);
  const score = `${home} ${fixture.homeScore}–${away} ${fixture.awayScore}`;
  const myScore = view.teamId === fixture.homeTeamId ? fixture.homeScore! : fixture.awayScore!;
  const theirScore = view.teamId === fixture.homeTeamId ? fixture.awayScore! : fixture.homeScore!;

  let verdict: string;
  if (myScore > theirScore) {
    verdict = view.opponentName ? `You beat ${view.opponentName} 👑.` : `A win for your ${mine}.`;
  } else if (myScore < theirScore) {
    verdict = view.opponentName ? `${view.opponentName} got you that time.` : `Your ${mine} lost.`;
  } else {
    verdict = view.opponentName ? `Honours even with ${view.opponentName}.` : `Your ${mine} drew.`;
  }
  return { title: 'Full time', body: `${score}. ${verdict}` };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm --prefix functions exec vitest run test/opponents.test.ts`
Expected: PASS — all cases.

- [ ] **Step 6: Commit**

```bash
git add functions/src/engine/opponents.ts functions/test/opponents.test.ts functions/src/types.ts
git commit -m "feat: pure opponent resolution and result/kickoff copy"
```

---

## Task 2: Rules 4 & 5 in `evaluateNotifications` (TDD)

**Files:**
- Modify: `functions/src/engine/notifications.ts`, `functions/test/notifications.test.ts`

- [ ] **Step 1: Add `teams` to `SweepState` and the rule-4/5 test cases** in `functions/test/notifications.test.ts`. Extend the `state()` helper with `teams: [{ id:'ESP',name:'Spain',isoCode:'es',fifaRank:1 }, { id:'BRA',name:'Brazil',isoCode:'br',fifaRank:2 }]` and add:

```ts
const HOUR = 60 * 60 * 1000;

it('emits kickoff for owners of both teams within the hour before kickoff', () => {
  const kickoff = 5_000_000_000_000;
  const result = evaluateNotifications(state({
    teams: [
      { id: 'ESP', name: 'Spain', isoCode: 'es', fifaRank: 1 },
      { id: 'BRA', name: 'Brazil', isoCode: 'br', fifaRank: 2 },
    ],
    assignments: [
      { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: 1, revealedAuto: false },
      { teamId: 'BRA', playerId: 'p2', bucket: 1, revealedAt: 1, revealedAuto: false },
    ],
    fixtures: [
      { id: 'f1', homeTeamId: 'ESP', awayTeamId: 'BRA', kickoff, stage: 'G', homeScore: null, awayScore: null },
    ],
    commitmentExists: true,
  }), kickoff - 30 * 60 * 1000);
  const kickoffNotes = result.filter((r) => r.reason === 'kickoff');
  expect(kickoffNotes.map((r) => r.key).sort()).toEqual(['kickoff__f1__p1', 'kickoff__f1__p2']);
  expect(kickoffNotes.every((r) => r.click === 'fixtures')).toBe(true);
});

it('emits result when both scores are final', () => {
  const result = evaluateNotifications(state({
    teams: [
      { id: 'ESP', name: 'Spain', isoCode: 'es', fifaRank: 1 },
      { id: 'BRA', name: 'Brazil', isoCode: 'br', fifaRank: 2 },
    ],
    assignments: [
      { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: 1, revealedAuto: false },
      { teamId: 'BRA', playerId: 'p2', bucket: 1, revealedAt: 1, revealedAuto: false },
    ],
    fixtures: [
      { id: 'f1', homeTeamId: 'ESP', awayTeamId: 'BRA', kickoff: 1, stage: 'G', homeScore: 2, awayScore: 1 },
    ],
    commitmentExists: true,
  }), 9_999_999_999_999);
  const resultNotes = result.filter((r) => r.reason === 'result');
  expect(resultNotes.map((r) => r.key).sort()).toEqual(['result__f1__p1', 'result__f1__p2']);
});

it('does not emit result while a score is still null', () => {
  const result = evaluateNotifications(state({
    teams: [{ id: 'ESP', name: 'Spain', isoCode: 'es', fifaRank: 1 }],
    assignments: [{ teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: 1, revealedAuto: false }],
    fixtures: [{ id: 'f1', homeTeamId: 'ESP', awayTeamId: 'BRA', kickoff: 1, stage: 'G', homeScore: 2, awayScore: null }],
    commitmentExists: true,
  }), 9_999_999_999_999);
  expect(result.filter((r) => r.reason === 'result')).toEqual([]);
});
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `npm --prefix functions exec vitest run test/notifications.test.ts`
Expected: FAIL — kickoff/result not emitted yet; also a type error until `SweepState.teams` exists.

- [ ] **Step 3: Modify `functions/src/engine/notifications.ts`**

Add to the `SweepState` interface: `teams: Team[];` (import `Team` from `../types.js`). Import the opponent helpers:

```ts
import {
  resolveFixtureOwners, kickoffMessage, resultMessage,
} from './opponents.js';
import { kickoffKey, resultKey } from './keys.js';
```

After the per-player loop, add fixture-driven rules:

```ts
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;

  for (const fixture of state.fixtures) {
    const owners = resolveFixtureOwners(fixture, state.assignments, state.players);
    if (owners.length === 0) continue;

    const kickingOff = now >= fixture.kickoff - HOUR && now < fixture.kickoff;
    const isFinal = fixture.homeScore !== null && fixture.awayScore !== null;

    for (const view of owners) {
      if (kickingOff) {
        const msg = kickoffMessage(view, fixture, teamName);
        out.push({
          key: kickoffKey(fixture.id, view.playerId),
          playerId: view.playerId, reason: 'kickoff',
          title: msg.title, body: msg.body, click: 'fixtures',
        });
      }
      if (isFinal) {
        const msg = resultMessage(view, fixture, teamName);
        out.push({
          key: resultKey(fixture.id, view.playerId),
          playerId: view.playerId, reason: 'result',
          title: msg.title, body: msg.body, click: 'fixtures',
        });
      }
    }
  }
```

- [ ] **Step 4: Run to verify all notification tests pass**

Run: `npm --prefix functions exec vitest run test/notifications.test.ts`
Expected: PASS — Phase 3 cases + the new rule-4/5 cases. (Update the Phase 3 `state()` helper to include `teams: []` so existing cases still type-check.)

- [ ] **Step 5: Commit**

```bash
git add functions/src/engine/notifications.ts functions/test/notifications.test.ts
git commit -m "feat: kickoff and result notification rules with opponent-aware copy"
```

---

## Task 3: API-Sports poll gate + status mapping (TDD)

**Files:**
- Create: `functions/src/engine/poll.ts`, `functions/test/poll.test.ts`
- Create: `functions/src/apiSports/mapStatus.ts`, `functions/test/mapStatus.test.ts`

- [ ] **Step 1: Write `functions/test/poll.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { fixturesNeedingPoll } from '../src/engine/poll.js';
import type { Assignment, Fixture } from '../src/types.js';

const HOUR = 60 * 60 * 1000;
const assignments: Assignment[] = [
  { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: 1, revealedAuto: false },
];
const fx = (o: Partial<Fixture>): Fixture => ({
  id: 'f', homeTeamId: 'ESP', awayTeamId: 'BRA', kickoff: 0, stage: 'G',
  homeScore: null, awayScore: null, ...o,
});

describe('fixturesNeedingPoll', () => {
  const now = 10 * HOUR;
  it('includes a live owned fixture without a final score', () => {
    expect(fixturesNeedingPoll([fx({ id: 'a', kickoff: now - HOUR })], assignments, now)).toEqual(['a']);
  });
  it('excludes fixtures before kickoff', () => {
    expect(fixturesNeedingPoll([fx({ id: 'b', kickoff: now + HOUR })], assignments, now)).toEqual([]);
  });
  it('excludes fixtures more than 3h past kickoff', () => {
    expect(fixturesNeedingPoll([fx({ id: 'c', kickoff: now - 4 * HOUR })], assignments, now)).toEqual([]);
  });
  it('excludes fixtures already final', () => {
    expect(fixturesNeedingPoll([fx({ id: 'd', kickoff: now - HOUR, homeScore: 1, awayScore: 0 })], assignments, now)).toEqual([]);
  });
  it('excludes fixtures with no owned team', () => {
    expect(fixturesNeedingPoll([fx({ id: 'e', kickoff: now - HOUR, homeTeamId: 'ARG', awayTeamId: 'FRA' })], assignments, now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement `functions/src/engine/poll.ts`**

```ts
// Pure decision: which fixtures need an API-Sports score check this tick. Only
// owned-team fixtures that are live (kicked off, within 3h) and not yet final.
// Empty result => the tick makes no API call (free-tier safe).
import type { Assignment, Fixture } from '../types.js';

const THREE_HOURS = 3 * 60 * 60 * 1000;

export function fixturesNeedingPoll(
  fixtures: Fixture[], assignments: Assignment[], now: number,
): string[] {
  const ownedTeams = new Set(assignments.map((a) => a.teamId));
  return fixtures
    .filter((f) => ownedTeams.has(f.homeTeamId) || ownedTeams.has(f.awayTeamId))
    .filter((f) => now >= f.kickoff && now <= f.kickoff + THREE_HOURS)
    .filter((f) => f.homeScore === null || f.awayScore === null)
    .map((f) => f.id);
}
```

- [ ] **Step 3: Write `functions/test/mapStatus.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { mapFixtureUpdate } from '../src/apiSports/mapStatus.js';

describe('mapFixtureUpdate', () => {
  it('maps a finished fixture to final scores', () => {
    const update = mapFixtureUpdate({
      fixture: { status: { short: 'FT' } },
      goals: { home: 2, away: 1 },
    });
    expect(update).toEqual({ homeScore: 2, awayScore: 1, final: true });
  });
  it('maps an in-play fixture to live scores, not final', () => {
    const update = mapFixtureUpdate({
      fixture: { status: { short: '2H' } },
      goals: { home: 1, away: 0 },
    });
    expect(update).toEqual({ homeScore: 1, awayScore: 0, final: false });
  });
  it('treats missing goals as null', () => {
    const update = mapFixtureUpdate({ fixture: { status: { short: 'NS' } }, goals: {} });
    expect(update).toEqual({ homeScore: null, awayScore: null, final: false });
  });
});
```

- [ ] **Step 4: Implement `functions/src/apiSports/mapStatus.ts`**

```ts
// Pure mapping from an API-Sports fixture record to our score update.
// "final" is true only for finished statuses, so rule 5 fires once the game
// is actually over (not mid-match).
const FINISHED = new Set(['FT', 'AET', 'PEN']);

interface ApiFixture {
  fixture: { status: { short: string } };
  goals: { home?: number | null; away?: number | null };
}

export function mapFixtureUpdate(api: ApiFixture): {
  homeScore: number | null; awayScore: number | null; final: boolean;
} {
  return {
    homeScore: api.goals.home ?? null,
    awayScore: api.goals.away ?? null,
    final: FINISHED.has(api.fixture.status.short),
  };
}
```

- [ ] **Step 5: Run both test files**

Run: `npm --prefix functions exec vitest run test/poll.test.ts test/mapStatus.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement the HTTP wrapper `functions/src/apiSports/client.ts`** (thin, not unit-tested — exercised only with a real key)

```ts
// Thin API-Sports client. Called only for fixtures fixturesNeedingPoll selects.
import { mapFixtureUpdate } from './mapStatus.js';

const BASE = 'https://v3.football.api-sports.io';

export async function fetchFixtureScore(
  apiKey: string, fixtureId: string,
): Promise<{ homeScore: number | null; awayScore: number | null; final: boolean } | null> {
  const res = await fetch(`${BASE}/fixtures?id=${encodeURIComponent(fixtureId)}`, {
    headers: { 'x-apisports-key': apiKey },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { response?: unknown[] };
  const record = json.response?.[0] as Parameters<typeof mapFixtureUpdate>[0] | undefined;
  return record ? mapFixtureUpdate(record) : null;
}
```

- [ ] **Step 7: Commit**

```bash
git add functions/src/engine/poll.ts functions/test/poll.test.ts functions/src/apiSports/mapStatus.ts functions/test/mapStatus.test.ts functions/src/apiSports/client.ts
git commit -m "feat: API-Sports poll gate, status mapping, and fetch client"
```

---

## Task 4: Wire polling + write-back into `runTick`, load teams

**Files:**
- Modify: `functions/src/tick/loadState.ts`, `functions/src/tick/runTick.ts`, `functions/src/tick.ts`
- Modify: `functions/test/runTick.test.ts`

- [ ] **Step 1: Load teams in `loadState.ts`** — add `base.collection('teams').get()` to the `Promise.all`, map to `teams`, and include `teams` in the returned `SweepState`.

- [ ] **Step 2: Add an optional poller to `runTick`** so scores are refreshed before evaluation, and the test can inject a fake. Extend `RunTickDeps`:

```ts
export interface RunTickDeps {
  db: Firestore;
  sweepId: string;
  now?: number;
  send: Sender;
  /** Optional: fetch a fixture's latest score. Omitted => no polling. */
  fetchScore?: (fixtureId: string) => Promise<{ homeScore: number | null; awayScore: number | null; final: boolean } | null>;
}
```

At the start of `runTick`, after loading state and before evaluation:

```ts
  if (deps.fetchScore) {
    const { fixturesNeedingPoll } = await import('../engine/poll.js');
    const ids = fixturesNeedingPoll(state.fixtures, state.assignments, now);
    for (const id of ids) {
      const update = await deps.fetchScore(id);
      if (!update) continue;
      await db.doc(`sweeps/${sweepId}/fixtures/${id}`).update({
        homeScore: update.homeScore, awayScore: update.awayScore,
      });
      const fx = state.fixtures.find((f) => f.id === id);
      if (fx) { fx.homeScore = update.homeScore; fx.awayScore = update.awayScore; }
    }
  }
```

(The in-memory `state.fixtures` mutation lets the same tick emit rule 5 immediately once a score becomes final.)

- [ ] **Step 3: Add a result-idempotency case to `functions/test/runTick.test.ts`**

```ts
it('sends a result notification once even across ticks', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('sweeps/wc').set({ contributionPence: 500, joinDeadline: 1 });
    await db.doc('sweeps/wc/players/p1').set({ id: 'p1', name: 'You', descriptor: '', joinedAt: 1, authUid: 'u1', fcmTokens: ['t1'] });
    await db.doc('sweeps/wc/teams/ESP').set({ id: 'ESP', name: 'Spain', isoCode: 'es', fifaRank: 1 });
    await db.doc('sweeps/wc/teams/BRA').set({ id: 'BRA', name: 'Brazil', isoCode: 'br', fifaRank: 2 });
    await db.doc('sweeps/wc/assignments/ESP').set({ teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: 1, revealedAuto: false });
    await db.doc('sweeps/wc/fixtures/f1').set({ id: 'f1', homeTeamId: 'ESP', awayTeamId: 'BRA', kickoff: 1, stage: 'G', homeScore: 3, awayScore: 0 });
  });
  const send = vi.fn(async () => ({ delivered: 1 }));
  await withDb(async (db) => {
    const a = await runTick({ db, sweepId: 'wc', now: 9_999_999_999_999, send });
    const b = await runTick({ db, sweepId: 'wc', now: 9_999_999_999_999, send });
    expect(a.sent).toBeGreaterThanOrEqual(1);
    expect(b.sent).toBe(0);
  });
  const resultCalls = (send as any).mock.calls.filter((c: any[]) => c[3].reason === 'result');
  expect(resultCalls).toHaveLength(1);
});
```

- [ ] **Step 4: Run runTick tests**

Run: `npm --prefix functions exec vitest run test/runTick.test.ts`
Expected: PASS.

- [ ] **Step 5: Pass a real fetcher in `tick.ts`** using the secret key:

```ts
import { defineSecret } from 'firebase-functions/params';
import { fetchFixtureScore } from './apiSports/client.js';

const apiSportsKey = defineSecret('API_SPORTS_KEY');

export const tick = onSchedule({ schedule: 'every 10 minutes', secrets: [apiSportsKey] }, async () => {
  ensureApp();
  const db = getFirestore();
  const key = apiSportsKey.value();
  const sweeps = await db.collection('sweeps').get();
  for (const sweep of sweeps.docs) {
    await runTick({
      db, sweepId: sweep.id, send: sendToPlayer,
      fetchScore: key ? (id) => fetchFixtureScore(key, id) : undefined,
    });
  }
});
```

- [ ] **Step 6: Build**

Run: `npm --prefix functions run build`
Expected: compiles.

- [ ] **Step 7: Commit**

```bash
git add functions/src/tick/loadState.ts functions/src/tick/runTick.ts functions/src/tick.ts functions/test/runTick.test.ts
git commit -m "feat: tick polls API-Sports for live owned fixtures and writes back scores"
```

---

## Task 5: `commitDraw` callable + route client writes through it (TDD)

**Files:**
- Create: `functions/src/commitDraw.ts`, `functions/test/commitDraw.test.ts`
- Modify: `functions/src/index.ts`, `src/data/firebaseRepository.ts`

- [ ] **Step 1: Write the failing test `functions/test/commitDraw.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { applyCommitDraw } from '../src/commitDraw.js';

let env: RulesTestEnvironment;
beforeEach(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-worldcup-sweep', firestore: { host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
});
afterAll(async () => env?.cleanup());

describe('applyCommitDraw', () => {
  it('writes commitment/current and one assignment per team', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any;
      await applyCommitDraw(db, {
        sweepId: 'wc',
        commitment: { seedHash: 'h', seed: 's', rankingSource: 'FIFA', createdAt: 1 },
        assignments: [
          { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: null, revealedAuto: false },
          { teamId: 'BRA', playerId: 'p2', bucket: 1, revealedAt: null, revealedAuto: false },
        ],
      });
      const commit = await db.doc('sweeps/wc/commitment/current').get();
      expect(commit.data().seedHash).toBe('h');
      const assigns = await db.collection('sweeps/wc/assignments').get();
      expect(assigns.docs.map((d: any) => d.id).sort()).toEqual(['BRA', 'ESP']);
    });
  });

  it('refuses to overwrite an existing commitment', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any;
      await db.doc('sweeps/wc/commitment/current').set({ seedHash: 'old', seed: null, rankingSource: 'FIFA', createdAt: 1 });
      await expect(applyCommitDraw(db, {
        sweepId: 'wc',
        commitment: { seedHash: 'new', seed: 's', rankingSource: 'FIFA', createdAt: 2 },
        assignments: [],
      })).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm --prefix functions exec vitest run test/commitDraw.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `functions/src/commitDraw.ts`**

```ts
// Callable that writes the provably-fair draw result. The draw is still
// computed client-side (unchanged, verifiable); only the write is server-
// mediated so client write rules stay locked. Refuses to overwrite an existing
// commitment (the draw happens exactly once).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureApp } from './firebaseAdmin.js';
import type { Assignment, DrawCommitment } from './types.js';

interface DocLike {
  get(): Promise<{ exists: boolean }>;
  set(data: unknown): Promise<unknown>;
}
interface DbLike { doc(path: string): DocLike }

export async function applyCommitDraw(
  db: DbLike,
  args: { sweepId: string; commitment: DrawCommitment; assignments: Assignment[] },
): Promise<void> {
  const commitRef = db.doc(`sweeps/${args.sweepId}/commitment/current`);
  if ((await commitRef.get()).exists) {
    throw new Error('Draw already committed.');
  }
  await commitRef.set(args.commitment);
  for (const a of args.assignments) {
    await db.doc(`sweeps/${args.sweepId}/assignments/${a.teamId}`).set(a);
  }
}

export const commitDraw = onCall(async (request) => {
  ensureApp();
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sweepId, commitment, assignments } = (request.data ?? {}) as {
    sweepId?: string; commitment?: DrawCommitment; assignments?: Assignment[];
  };
  if (!sweepId || !commitment || !assignments) {
    throw new HttpsError('invalid-argument', 'sweepId, commitment and assignments are required.');
  }
  try {
    await applyCommitDraw(getFirestore() as unknown as DbLike, { sweepId, commitment, assignments });
    return { ok: true };
  } catch (err) {
    throw new HttpsError('failed-precondition', (err as Error).message);
  }
});
```

- [ ] **Step 4: Export it — modify `functions/src/index.ts`**

```ts
export { claimPlayer } from './claimPlayer.js';
export { commitDraw } from './commitDraw.js';
export { tick } from './tick.js';
```

- [ ] **Step 5: Route client writes through the callable — modify `src/data/firebaseRepository.ts`**

Replace the bodies of `saveCommitment` and `saveAssignments` so they buffer until both are present, then call `commitDraw` once. Simplest correct approach: have `AppContext.runDrawIfDue` call a new repo method `commitDraw(commitment, assignments)` instead of the two separate writes. Add to `FirebaseRepository`:

```ts
  async commitDraw(commitment: DrawCommitment, assignments: Assignment[]): Promise<void> {
    const callable = httpsCallable(firebaseFunctions(), 'commitDraw');
    await callable({ sweepId: this.sweepId, commitment, assignments });
  }
```

Add `commitDraw(commitment, assignments)` to the `SweepRepository` interface and implement it in `LocalRepository` as the existing two writes in sequence:

```ts
  async commitDraw(commitment: DrawCommitment, assignments: Assignment[]): Promise<void> {
    await this.saveCommitment(commitment);
    await this.saveAssignments(assignments);
  }
```

In `AppContext.runDrawIfDue`, replace the two `await repository.saveCommitment(...)` / `await repository.saveAssignments(...)` calls with a single `await repository.commitDraw({ seedHash, seed, rankingSource: 'FIFA', createdAt: Date.now() }, runDraw(teams, players, seed));`. Keep `saveCommitment`/`saveAssignments` on the interface (still used by tests), but they are no longer invoked from the client in production.

- [ ] **Step 6: Run the function test + type-check the client**

Run: `npm --prefix functions exec vitest run test/commitDraw.test.ts && npx tsc -b`
Expected: PASS + compiles.

- [ ] **Step 7: Commit**

```bash
git add functions/src/commitDraw.ts functions/test/commitDraw.test.ts functions/src/index.ts src/data/firebaseRepository.ts src/data/repository.ts src/data/localRepository.ts src/state/AppContext.tsx
git commit -m "feat: commitDraw callable; route draw writes through it"
```

---

## Task 6: Firestore seeding script

**Files:**
- Create: `scripts/seed-firestore.mjs`
- Modify: `scripts/fetch-tournament.mjs` (header note), `.env.example`, `package.json`

- [ ] **Step 1: Create `scripts/seed-firestore.mjs`** — reads `src/data/teams.json` + `src/data/fixtures.json` (produced by `fetch-tournament.mjs`) and writes them under `sweeps/{sweepId}/teams` and `.../fixtures` using the admin SDK against either the emulator (`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`) or a real project (with `GOOGLE_APPLICATION_CREDENTIALS`).

```js
// Seed teams + fixtures into Firestore for one sweep. Run once before the
// tournament; re-run if the schedule changes. Knockout TBD fixtures get their
// teams later via the tick's score updates.
//
//   # against the emulator:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-firestore.mjs wc
//   # against a real project:
//   GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/seed-firestore.mjs wc
import { readFile } from 'node:fs/promises';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sweepId = process.argv[2];
if (!sweepId) { console.error('Usage: node scripts/seed-firestore.mjs <sweepId>'); process.exit(1); }

const useEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(
  useEmulator
    ? { projectId: process.env.GCLOUD_PROJECT ?? 'demo-worldcup-sweep' }
    : { credential: process.env.GOOGLE_APPLICATION_CREDENTIALS ? applicationDefault() : undefined },
);
const db = getFirestore();

const teams = JSON.parse(await readFile('src/data/teams.json', 'utf8'));
// fixtures.json is the raw API-Sports shape; map to our Fixture model.
const rawFixtures = JSON.parse(await readFile('src/data/fixtures.json', 'utf8'));
const fixtures = rawFixtures.map((entry) => ({
  id: String(entry.fixture.id),
  homeTeamId: entry.teams.home.code ?? String(entry.teams.home.id),
  awayTeamId: entry.teams.away.code ?? String(entry.teams.away.id),
  kickoff: new Date(entry.fixture.date).getTime(),
  stage: entry.league?.round ?? 'Group stage',
  homeScore: entry.goals?.home ?? null,
  awayScore: entry.goals?.away ?? null,
}));

let batch = db.batch();
for (const team of teams) batch.set(db.doc(`sweeps/${sweepId}/teams/${team.id}`), team);
for (const fx of fixtures) batch.set(db.doc(`sweeps/${sweepId}/fixtures/${fx.id}`), fx);
await batch.commit();
console.log(`Seeded ${teams.length} teams and ${fixtures.length} fixtures into sweeps/${sweepId}.`);
```

- [ ] **Step 2: Add a script to root `package.json`**

```json
"seed:firestore": "node scripts/seed-firestore.mjs"
```

- [ ] **Step 3: Update `.env.example`** — append:

```
# API-Sports key for the tick's live-score polling. Set as a Functions secret
# in production:  firebase functions:secrets:set API_SPORTS_KEY
# (the same key the fetch-tournament script uses; never shipped to the client).
```

- [ ] **Step 4: Add a header note to `scripts/fetch-tournament.mjs`** pointing to `seed-firestore.mjs` as the next step (write JSON → seed into Firestore). Do not change its fetch logic.

- [ ] **Step 5: Smoke test against the emulator** — with `npm run emulators` running and a `teams.json`/`fixtures.json` present (or a tiny hand-written stub of each), run:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-worldcup-sweep npm run seed:firestore -- wc
```
Expected: logs the seeded counts; the Emulator UI shows `sweeps/wc/teams` and `.../fixtures`. (If no JSON files exist yet, create a 2-team / 1-fixture stub to verify the script path, then delete it.)

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-firestore.mjs scripts/fetch-tournament.mjs .env.example package.json
git commit -m "feat: Firestore seeding script for teams and fixtures"
```

---

## Task 7: Full verification & deployment notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the production deployment checklist in `README.md`:**
  - Create a Firebase project; put its public config in `.env` (`VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`) and set `VITE_USE_FIREBASE=true`, unset the emulator flag for the deployed build.
  - Enable Anonymous Auth, Firestore, Cloud Messaging.
  - `firebase deploy --only firestore:rules,functions`.
  - `firebase functions:secrets:set API_SPORTS_KEY`.
  - Seed: `GOOGLE_APPLICATION_CREDENTIALS=… node scripts/seed-firestore.mjs <sweepId>`.
  - Cloud Scheduler is provisioned automatically by the `onSchedule` deploy.
  - Verify on a real iOS device (installed to Home Screen) and Android Chrome (tab + installed) per the spec's testing note.

- [ ] **Step 2: Run the entire suite**

Run: `npm test && npm --prefix functions run test && npm run build`
Expected: all green; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: production deployment checklist and device verification"
```

---

## Self-Review Notes

- **Spec coverage:** fixtures seeding into Firestore (✓ Task 6, replaces JSON), rule 4 kickoff naming the opposing player (✓ Tasks 1–2), rule 5 result with opponent-aware copy (✓ Tasks 1–2), opponent resolution as a pure tested module (✓ Task 1), unowned-opposition fallback to team name (✓ Task 1 tests), API-Sports polling only for live owned fixtures (✓ Task 3 `fixturesNeedingPoll` + Task 4 wiring), score write-back driving rule 5 + Fixtures screen (✓ Task 4), "just kicked off" from `kickoff` timestamp / "final" from non-null scores + finished status (✓ Tasks 2/3 `mapFixtureUpdate`), ledger prevents duplicate results (✓ Task 4 idempotency test), `commitDraw` callable with locked client writes (✓ Task 5), draw stays client-computed (✓ Task 5 — `runDraw` unchanged, only the write moves).
- **Type consistency:** `OwnerView` shape identical across `opponents.ts`, its tests, and `notifications.ts`. `kickoffKey`/`resultKey` reused from Phase 3 `keys.ts`. `SweepState.teams` added once and loaded in `loadState`. `fetchScore` return shape matches `mapFixtureUpdate`'s output and `client.ts`. `commitDraw({ sweepId, commitment, assignments })` payload matches between callable, `FirebaseRepository.commitDraw`, and `LocalRepository.commitDraw`. `DrawCommitment`/`Assignment` mirrors match `src/domain/types.ts`.
- **Free-tier safety:** no owned-team fixture live ⇒ `fixturesNeedingPoll` returns `[]` ⇒ zero API calls (✓ Task 3 tests).
```
