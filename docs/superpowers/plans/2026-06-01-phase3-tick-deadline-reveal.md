# Phase 3 — `tick` Engine, Idempotency & Deadline/Reveal Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on Phases 1–2 being merged.**

**Goal:** A scheduled `tick` Cloud Function that, on each run, evaluates notification rules and sends web pushes via FCM exactly once each, using an idempotency ledger. This phase implements rules **1 (deadline-24h)**, **2 (deadline-1h)**, and **3 (reveal-open)**; the engine is built to accept rules 4–5 in Phase 4.

**Architecture:** The decision is a **pure function** `evaluateNotifications(state, now) → PlannedNotification[]` over plain data (config, players, assignments, fixtures), with zero Firebase/FCM I/O — unit-tested with fake clocks. The `tick` shell loads state from Firestore, calls the pure function, filters out keys already in `sentNotifications`, sends survivors via the Admin Messaging API, then records each sent key. Idempotency is proven by running `tick` twice over identical state and asserting one send per rule.

**Tech Stack:** `firebase-functions/v2/scheduler` (`onSchedule`), `firebase-admin/messaging`, `firebase-admin/firestore`, Vitest.

---

## Shared Contract additions (read first)

**Pure engine types** (`functions/src/engine/notifications.ts`) — Phase 4 extends `PlannedNotification` reasons but keeps this shape:

```ts
export interface SweepState {
  sweepId: string;
  config: { joinDeadline: number; contributionPence: number };
  players: StoredPlayer[];                 // includes fcmTokens + authUid
  commitmentExists: boolean;
  assignments: Assignment[];               // Phase 4 uses these
  fixtures: Fixture[];                     // Phase 4 uses these
}

export type NotificationReason =
  | 'deadline-24h' | 'deadline-1h' | 'reveal-open'
  | 'kickoff' | 'result';                  // 4,5 wired in Phase 4

export interface PlannedNotification {
  /** Idempotency key — unique per (reason, player, event). */
  key: string;
  /** Player who should receive it (resolved to tokens by the shell). */
  playerId: string;
  reason: NotificationReason;
  title: string;
  body: string;
  /** Deep-link target for the SW notificationclick handler. */
  click: 'home' | 'reveal' | 'fixtures';
}
```

**Idempotency keys** (must match the spec table exactly):
- Rule 1: `deadline-24h__{playerId}`
- Rule 2: `deadline-1h__{playerId}`
- Rule 3: `reveal-open__{playerId}`

**Windows:** the engine fires a deadline rule when `now` is within the lead window **and** before the deadline:
- 24h rule: `joinDeadline - 24h <= now < joinDeadline`
- 1h rule: `joinDeadline - 1h <= now < joinDeadline`

Because `now` advances and the ledger dedupes, the rule fires on the first tick inside the window and never again. (A tick cadence < the smallest window guarantees no window is skipped; documented in Task 5.)

**Schedule:** `onSchedule('every 10 minutes', tick)`. Local invocation in tests calls the extracted `runTick(deps)` directly (no scheduler needed).

**FCM send:** one multicast per planned notification to that player's `fcmTokens`. Tokens FCM reports as `messaging/registration-token-not-registered` or `invalid-argument` are pruned from the seat (`arrayRemove`).

---

## File Structure

| Path | Created/Modified | Responsibility |
|---|---|---|
| `functions/src/types.ts` | Modify | Add `Assignment`, `Fixture`, `SweepConfig` mirrors |
| `functions/src/engine/notifications.ts` | Create | Pure `evaluateNotifications` |
| `functions/test/notifications.test.ts` | Create | Unit tests (fake clock) |
| `functions/src/engine/keys.ts` | Create | Idempotency key builders (shared, tested) |
| `functions/test/keys.test.ts` | Create | Key-format tests |
| `functions/src/tick/loadState.ts` | Create | Firestore → `SweepState` |
| `functions/src/tick/send.ts` | Create | FCM send + dead-token prune |
| `functions/src/tick/runTick.ts` | Create | Orchestration (load → evaluate → dedupe → send → record) |
| `functions/test/runTick.test.ts` | Create | Emulator integration + idempotency |
| `functions/src/tick.ts` | Create | `onSchedule` wrapper |
| `functions/src/index.ts` | Modify | Export `tick` |

---

## Task 1: Idempotency key builders (TDD)

**Files:**
- Create: `functions/src/engine/keys.ts`, `functions/test/keys.test.ts`

- [ ] **Step 1: Write the failing test `functions/test/keys.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { deadline24hKey, deadline1hKey, revealOpenKey, kickoffKey, resultKey } from '../src/engine/keys.js';

describe('idempotency keys', () => {
  it('match the spec format', () => {
    expect(deadline24hKey('p1')).toBe('deadline-24h__p1');
    expect(deadline1hKey('p1')).toBe('deadline-1h__p1');
    expect(revealOpenKey('p1')).toBe('reveal-open__p1');
    expect(kickoffKey('f9', 'p1')).toBe('kickoff__f9__p1');
    expect(resultKey('f9', 'p1')).toBe('result__f9__p1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm --prefix functions exec vitest run test/keys.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `functions/src/engine/keys.ts`**

```ts
// Idempotency keys. Encode (reason, player, event) so the same notification is
// never sent twice. Format matches the design spec's table exactly.
export const deadline24hKey = (playerId: string) => `deadline-24h__${playerId}`;
export const deadline1hKey = (playerId: string) => `deadline-1h__${playerId}`;
export const revealOpenKey = (playerId: string) => `reveal-open__${playerId}`;
export const kickoffKey = (fixtureId: string, playerId: string) => `kickoff__${fixtureId}__${playerId}`;
export const resultKey = (fixtureId: string, playerId: string) => `result__${fixtureId}__${playerId}`;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm --prefix functions exec vitest run test/keys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/engine/keys.ts functions/test/keys.test.ts
git commit -m "feat: idempotency key builders matching the spec"
```

---

## Task 2: Extend functions type mirror

**Files:**
- Modify: `functions/src/types.ts`

- [ ] **Step 1: Append the remaining persistence mirrors to `functions/src/types.ts`**

```ts
export interface SweepConfig {
  contributionPence: number;
  joinDeadline: number;
}

export interface Assignment {
  teamId: string;
  playerId: string;
  bucket: number;
  revealedAt: number | null;
  revealedAuto: boolean;
}

export interface Fixture {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: number;
  stage: string;
  homeScore: number | null;
  awayScore: number | null;
}
```

- [ ] **Step 2: Build**

Run: `npm --prefix functions run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add functions/src/types.ts
git commit -m "feat: mirror Assignment/Fixture/SweepConfig types in functions"
```

---

## Task 3: Pure `evaluateNotifications` — rules 1–3 (TDD)

**Files:**
- Create: `functions/src/engine/notifications.ts`, `functions/test/notifications.test.ts`

- [ ] **Step 1: Write the failing test `functions/test/notifications.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateNotifications, type SweepState } from '../src/engine/notifications.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function state(overrides: Partial<SweepState> = {}): SweepState {
  return {
    sweepId: 'wc',
    config: { joinDeadline: 1_000_000_000_000, contributionPence: 500 },
    players: [
      { id: 'p1', name: 'A', descriptor: '', joinedAt: 1, authUid: 'u1', fcmTokens: ['t1'] },
      { id: 'p2', name: 'B', descriptor: '', joinedAt: 2, authUid: 'u2', fcmTokens: ['t2'] },
    ],
    commitmentExists: false,
    assignments: [],
    fixtures: [],
    ...overrides,
  };
}

describe('evaluateNotifications (rules 1-3)', () => {
  const deadline = 1_000_000_000_000;

  it('emits deadline-24h for every player inside the 24h window', () => {
    const result = evaluateNotifications(state(), deadline - 23 * HOUR);
    const keys = result.map((r) => r.key).sort();
    expect(keys).toEqual(['deadline-24h__p1', 'deadline-24h__p2']);
  });

  it('emits both deadline rules inside the 1h window', () => {
    const result = evaluateNotifications(state(), deadline - 30 * 60 * 1000);
    const reasons = new Set(result.map((r) => r.reason));
    expect(reasons.has('deadline-24h')).toBe(true);
    expect(reasons.has('deadline-1h')).toBe(true);
  });

  it('emits nothing deadline-related before the 24h window', () => {
    const result = evaluateNotifications(state(), deadline - 2 * DAY);
    expect(result).toEqual([]);
  });

  it('emits nothing deadline-related after the deadline', () => {
    const result = evaluateNotifications(state(), deadline + HOUR);
    expect(result.filter((r) => r.reason.startsWith('deadline'))).toEqual([]);
  });

  it('emits reveal-open for every player once the commitment exists', () => {
    const result = evaluateNotifications(
      state({ commitmentExists: true }),
      deadline + DAY, // after deadline, deadline rules silent
    );
    expect(result.map((r) => r.key).sort()).toEqual(['reveal-open__p1', 'reveal-open__p2']);
    expect(result.every((r) => r.click === 'reveal')).toBe(true);
  });

  it('targets each planned notification at a single player', () => {
    const result = evaluateNotifications(state(), deadline - 23 * HOUR);
    expect(result.every((r) => typeof r.playerId === 'string')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm --prefix functions exec vitest run test/notifications.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `functions/src/engine/notifications.ts`**

```ts
// Pure notification rule evaluation. Given the full sweep state and the current
// time, return the notifications that *should* exist. No Firebase, no FCM, no
// dedupe — the tick shell handles I/O and the idempotency ledger. Fully
// unit-testable with fake clocks.
import type { Assignment, Fixture, SweepConfig, StoredPlayer } from '../types.js';
import { deadline24hKey, deadline1hKey, revealOpenKey } from './keys.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface SweepState {
  sweepId: string;
  config: SweepConfig;
  players: StoredPlayer[];
  commitmentExists: boolean;
  assignments: Assignment[];
  fixtures: Fixture[];
}

export type NotificationReason =
  | 'deadline-24h' | 'deadline-1h' | 'reveal-open' | 'kickoff' | 'result';

export interface PlannedNotification {
  key: string;
  playerId: string;
  reason: NotificationReason;
  title: string;
  body: string;
  click: 'home' | 'reveal' | 'fixtures';
}

function inWindow(now: number, deadline: number, lead: number): boolean {
  return now >= deadline - lead && now < deadline;
}

export function evaluateNotifications(state: SweepState, now: number): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const { joinDeadline } = state.config;

  for (const player of state.players) {
    // Rule 1: deadline tomorrow.
    if (inWindow(now, joinDeadline, DAY)) {
      out.push({
        key: deadline24hKey(player.id),
        playerId: player.id,
        reason: 'deadline-24h',
        title: 'The Sweep closes tomorrow',
        body: 'Last chance to make sure your name is in — joining closes within a day.',
        click: 'home',
      });
    }
    // Rule 2: deadline in ~1 hour.
    if (inWindow(now, joinDeadline, HOUR)) {
      out.push({
        key: deadline1hKey(player.id),
        playerId: player.id,
        reason: 'deadline-1h',
        title: 'The Sweep closes soon',
        body: 'Joining closes in about an hour. Get in while you can.',
        click: 'home',
      });
    }
    // Rule 3: reveal is open.
    if (state.commitmentExists) {
      out.push({
        key: revealOpenKey(player.id),
        playerId: player.id,
        reason: 'reveal-open',
        title: 'The draw is done',
        body: 'Your teams have been drawn — open the app to reveal them.',
        click: 'reveal',
      });
    }
  }

  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm --prefix functions exec vitest run test/notifications.test.ts`
Expected: PASS — all six cases.

- [ ] **Step 5: Commit**

```bash
git add functions/src/engine/notifications.ts functions/test/notifications.test.ts
git commit -m "feat: pure evaluateNotifications for deadline + reveal-open rules"
```

---

## Task 4: State loader + FCM send shell

**Files:**
- Create: `functions/src/tick/loadState.ts`, `functions/src/tick/send.ts`

- [ ] **Step 1: Create `functions/src/tick/loadState.ts`**

```ts
// Read a sweep's full state from Firestore into the plain SweepState the pure
// engine consumes.
import type { Firestore } from 'firebase-admin/firestore';
import type { SweepState } from '../engine/notifications.js';
import type { Assignment, Fixture, StoredPlayer } from '../types.js';

export async function loadSweepState(db: Firestore, sweepId: string): Promise<SweepState> {
  const base = db.doc(`sweeps/${sweepId}`);
  const [configSnap, playersSnap, commitmentSnap, assignmentsSnap, fixturesSnap] = await Promise.all([
    base.get(),
    base.collection('players').get(),
    base.collection('commitment').doc('current').get(),
    base.collection('assignments').get(),
    base.collection('fixtures').get(),
  ]);
  const config = configSnap.data() ?? {};
  return {
    sweepId,
    config: {
      contributionPence: Number(config.contributionPence ?? 0),
      joinDeadline: Number(config.joinDeadline ?? 0),
    },
    players: playersSnap.docs.map((d) => d.data() as StoredPlayer),
    commitmentExists: commitmentSnap.exists,
    assignments: assignmentsSnap.docs.map((d) => d.data() as Assignment),
    fixtures: fixturesSnap.docs.map((d) => d.data() as Fixture),
  };
}
```

- [ ] **Step 2: Create `functions/src/tick/send.ts`**

```ts
// FCM delivery + dead-token pruning. Sends one planned notification to all of a
// player's tokens; tokens FCM rejects as unregistered/invalid are removed from
// the seat so the ledger and token list stay clean.
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { PlannedNotification } from '../engine/notifications.js';
import type { StoredPlayer } from '../types.js';

const DEAD = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export async function sendToPlayer(
  db: Firestore,
  sweepId: string,
  player: StoredPlayer,
  note: PlannedNotification,
): Promise<{ delivered: number }> {
  const tokens = player.fcmTokens ?? [];
  if (tokens.length === 0) return { delivered: 0 };

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: note.title, body: note.body },
    data: { click: note.click, sweepId },
    webpush: { fcmOptions: { link: `/#${sweepId}` } },
  });

  const dead: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD.has(r.error.code)) dead.push(tokens[i]!);
  });
  if (dead.length > 0) {
    await db.doc(`sweeps/${sweepId}/players/${player.id}`)
      .update({ fcmTokens: FieldValue.arrayRemove(...dead) });
  }
  return { delivered: response.successCount };
}
```

- [ ] **Step 3: Build**

Run: `npm --prefix functions run build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add functions/src/tick/loadState.ts functions/src/tick/send.ts
git commit -m "feat: tick state loader and FCM send/prune shell"
```

---

## Task 5: `runTick` orchestration + idempotency (TDD against emulator)

**Files:**
- Create: `functions/src/tick/runTick.ts`, `functions/test/runTick.test.ts`

- [ ] **Step 1: Implement `functions/src/tick/runTick.ts`** (written before its test because the test injects a fake sender)

```ts
// Orchestrates one tick: load state -> evaluate -> drop already-sent keys ->
// send survivors -> record keys in the idempotency ledger. The sender is
// injected so tests can assert sends without standing up FCM.
import type { Firestore } from 'firebase-admin/firestore';
import { loadSweepState } from './loadState.js';
import { evaluateNotifications, type PlannedNotification } from '../engine/notifications.js';
import type { StoredPlayer } from '../types.js';

export type Sender = (
  db: Firestore, sweepId: string, player: StoredPlayer, note: PlannedNotification,
) => Promise<{ delivered: number }>;

export interface RunTickDeps {
  db: Firestore;
  sweepId: string;
  now?: number;
  send: Sender;
}

export async function runTick(deps: RunTickDeps): Promise<{ sent: number; skipped: number }> {
  const { db, sweepId, send } = deps;
  const now = deps.now ?? Date.now();

  const state = await loadSweepState(db, sweepId);
  const planned = evaluateNotifications(state, now);
  const playersById = new Map(state.players.map((p) => [p.id, p]));

  let sent = 0;
  let skipped = 0;
  for (const note of planned) {
    const ledgerRef = db.doc(`sweeps/${sweepId}/sentNotifications/${note.key}`);
    const exists = (await ledgerRef.get()).exists;
    if (exists) { skipped += 1; continue; }

    const player = playersById.get(note.playerId);
    if (player) await send(db, sweepId, player, note);

    // Record AFTER a successful send attempt so a thrown send is retried next tick.
    await ledgerRef.set({ sentAt: now });
    sent += 1;
  }
  return { sent, skipped };
}
```

- [ ] **Step 2: Write the failing test `functions/test/runTick.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { runTick, type Sender } from '../src/tick/runTick.js';

let env: RulesTestEnvironment;
const HOUR = 60 * 60 * 1000;
const deadline = 2_000_000_000_000;

beforeEach(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-worldcup-sweep',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
});

afterAll(async () => env?.cleanup());

async function seedSweep() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('sweeps/wc').set({ contributionPence: 500, joinDeadline: deadline });
    await db.doc('sweeps/wc/players/p1').set({
      id: 'p1', name: 'A', descriptor: '', joinedAt: 1, authUid: 'u1', fcmTokens: ['t1'],
    });
    await db.doc('sweeps/wc/players/p2').set({
      id: 'p2', name: 'B', descriptor: '', joinedAt: 2, authUid: 'u2', fcmTokens: ['t2'],
    });
  });
}

function withDb<T>(fn: (db: any) => Promise<T>): Promise<T> {
  return env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

describe('runTick idempotency', () => {
  it('sends each deadline-24h notification exactly once across two ticks', async () => {
    await seedSweep();
    const send: Sender = vi.fn(async () => ({ delivered: 1 }));
    const now = deadline - 23 * HOUR;

    await withDb(async (db) => {
      const first = await runTick({ db, sweepId: 'wc', now, send });
      expect(first.sent).toBe(2); // p1, p2
      const second = await runTick({ db, sweepId: 'wc', now, send });
      expect(second.sent).toBe(0);
      expect(second.skipped).toBe(2);
    });
    expect((send as any).mock.calls).toHaveLength(2); // never re-sent
  });

  it('writes a ledger entry per sent key', async () => {
    await seedSweep();
    const send: Sender = vi.fn(async () => ({ delivered: 1 }));
    await withDb(async (db) => {
      await runTick({ db, sweepId: 'wc', now: deadline - 23 * HOUR, send });
      const ledger = await db.collection('sweeps/wc/sentNotifications').get();
      expect(ledger.docs.map((d: any) => d.id).sort())
        .toEqual(['deadline-24h__p1', 'deadline-24h__p2']);
    });
  });

  it('does not send before the window opens', async () => {
    await seedSweep();
    const send: Sender = vi.fn(async () => ({ delivered: 1 }));
    await withDb(async (db) => {
      const r = await runTick({ db, sweepId: 'wc', now: deadline - 5 * 24 * HOUR, send });
      expect(r.sent).toBe(0);
    });
    expect((send as any).mock.calls).toHaveLength(0);
  });
});
```

Note: `ctx.firestore()` from rules-unit-testing is the client SDK, but `runTick`/`loadState` are typed against `firebase-admin`'s `Firestore`. The call sites use the same method surface (`doc`, `collection`, `get`, `set`, `update`); cast via `any` at the test boundary (as above) so the admin-typed code runs against the emulator client handle. This keeps `runTick` production-correct (admin SDK) while testable without admin credentials.

- [ ] **Step 3: Run to verify it fails then passes**

Run (emulators running): `npm --prefix functions exec vitest run test/runTick.test.ts`
Expected: initially FAIL if `runTick` had a bug; with the implementation from Step 1 it should PASS. Confirm all three cases green. If red, fix `runTick` (do not change the test's intent).

- [ ] **Step 4: Commit**

```bash
git add functions/src/tick/runTick.ts functions/test/runTick.test.ts
git commit -m "feat: runTick orchestration with idempotency ledger (tested twice-over)"
```

---

## Task 6: Scheduled `tick` wrapper + multi-sweep iteration

**Files:**
- Create: `functions/src/tick.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create `functions/src/tick.ts`**

```ts
// Scheduled entry point. Runs every ~10 minutes, iterating all sweeps and
// running one tick each. Sized loosely: the design accepts +/-10 min timing.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureApp } from './firebaseAdmin.js';
import { runTick } from './tick/runTick.js';
import { sendToPlayer } from './tick/send.js';

export const tick = onSchedule('every 10 minutes', async () => {
  ensureApp();
  const db = getFirestore();
  const sweeps = await db.collection('sweeps').get();
  for (const sweep of sweeps.docs) {
    await runTick({ db, sweepId: sweep.id, send: sendToPlayer });
  }
});
```

- [ ] **Step 2: Export it — modify `functions/src/index.ts`**

```ts
export { claimPlayer } from './claimPlayer.js';
export { tick } from './tick.js';
```

- [ ] **Step 3: Build**

Run: `npm --prefix functions run build`
Expected: compiles.

- [ ] **Step 4: Manual emulator check (optional but recommended)** — with `npm run emulators`, open the Emulator UI, seed a sweep whose `joinDeadline` is ~23h in the future, and trigger the scheduled function from the Functions emulator (or call `runTick` via a temporary HTTP shim). Confirm `sentNotifications` fills and a second trigger adds nothing. (FCM sends are no-ops without real credentials; that is expected — delivery is verified on a real project.)

- [ ] **Step 5: Commit**

```bash
git add functions/src/tick.ts functions/src/index.ts
git commit -m "feat: scheduled tick iterates sweeps every 10 minutes"
```

---

## Task 7: Verification & docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the notification engine** in `README.md`: the tick cadence, the idempotency ledger, that real FCM delivery needs a deployed project + Cloud Scheduler, and that the cadence (10 min) is shorter than the smallest rule window (1 h) so no window is missed.

- [ ] **Step 2: Run all tests**

Run: `npm test && npm --prefix functions run test && npm run build`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: tick engine and idempotency model"
```

---

## Self-Review Notes

- **Spec coverage:** scheduled tick ~10 min (✓ Task 6), pure rule evaluation with fake clock (✓ Task 3), idempotency ledger keyed per spec + tested twice-over (✓ Tasks 1/5), rules 1–3 (✓ Task 3), FCM send to every token + dead-token prune (✓ Task 4), loose phrasing ("within a day", "about an hour") (✓ Task 3 bodies), multi-sweep (✓ Task 6). Rules 4–5 + API-Sports + commitDraw deferred to Phase 4 (engine already typed for them).
- **Window correctness:** firing on the first tick inside `[deadline-lead, deadline)` plus ledger dedupe ⇒ once per player; cadence < smallest window ⇒ no skip (documented Task 7).
- **Type consistency:** `SweepState`/`PlannedNotification`/`NotificationReason` defined in `engine/notifications.ts` and reused by `runTick`, `send`, and Phase 4. Ledger doc shape `{ sentAt: number }` matches the spec. Deep-link `click` values match Phase 2's SW contract (`'home'|'reveal'|'fixtures'`). Key formats match `keys.ts` (Task 1) and the spec table.
```
