# Phase 1 — FirebaseRepository, Anonymous Auth & Join/Claim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `localStorage`-only backend with a Firebase (Firestore + Anonymous Auth + Cloud Functions) implementation of the existing `SweepRepository` interface, plus a single share-link join/claim flow, all developed and tested against the Firebase Emulator Suite.

**Architecture:** A new `FirebaseRepository` implements the unchanged `SweepRepository` interface and is selected at `src/data/index.ts` behind `VITE_USE_FIREBASE`, leaving `LocalRepository` for offline dev/tests. Realtime Firestore listeners back `subscribe()`. A `claimPlayer` callable Cloud Function binds a device's anonymous `authUid` to an unclaimed player seat. Firestore security rules make sweep state world-readable (provably fair) but writable only by Cloud Functions, except `players/{id}.authUid`/`fcmTokens` which the owning device may write.

**Tech Stack:** Firebase JS SDK v10 (modular), `firebase-admin` + `firebase-functions` v2 (Node 20, TypeScript), Firebase Emulator Suite (Auth + Firestore + Functions), Vitest, `@firebase/rules-unit-testing`.

---

## Shared Contract (read before any task)

These names/shapes are referenced by every later phase — do not rename without updating Phases 2–4.

**Firestore layout** (all under one document tree):

```
sweeps/{sweepId}
  (doc fields)              -> SweepConfig            (contributionPence, joinDeadline)
  players/{playerId}        -> StoredPlayer           (Player + authUid + fcmTokens)
  commitment/current        -> DrawCommitment         (single doc, id "current")
  assignments/{teamId}      -> Assignment
  teams/{teamId}            -> Team
  fixtures/{fixtureId}      -> Fixture
  sentNotifications/{key}   -> { sentAt: number }      (Phase 3+)
```

Decision: `config` is stored as **fields on the `sweeps/{sweepId}` document itself** (not a sub-doc), because Firestore cannot store a bare document without a collection and this avoids an extra read. `commitment` is a **single doc at `commitment/current`** so its existence is a simple boolean ("draw done ⇒ reveal open").

**New stored type (server + client agree on this shape):**

```ts
// Player as stored in Firestore. The client domain `Player` is unchanged;
// these two fields are persistence concerns layered on top.
export interface StoredPlayer extends Player {
  authUid: string | null;   // null = unclaimed seat
  fcmTokens: string[];      // one per installed device (Phase 2 populates)
}
```

**Env flags:**
- `VITE_USE_FIREBASE` — `"true"` selects `FirebaseRepository`, anything else keeps `LocalRepository`.
- `VITE_USE_FIREBASE_EMULATOR` — `"true"` connects the client SDK to local emulators.
- `VITE_FIREBASE_*` — public web config (already stubbed in `.env.example`).

**Functions ↔ client type sharing decision:** Cloud Functions deploy bundles only the `functions/` directory, so it cannot import `../src/domain/types.ts` at runtime. Functions therefore keep a small, intentionally-duplicated `functions/src/types.ts` mirroring the document shapes they touch. `src/domain/types.ts` remains the single source of truth for the client; the duplication is limited to persistence shapes and called out in a comment in both files.

**Emulator ports** (fixed in `firebase.json`, referenced everywhere):
- Auth `9099`, Firestore `8080`, Functions `5001`, Emulator UI `4000`.

---

## File Structure

| Path | Created/Modified | Responsibility |
|---|---|---|
| `firebase.json` | Create | Emulator + functions + rules config |
| `.firebaserc` | Create | Placeholder project alias (`demo-worldcup-sweep` for emulator) |
| `firestore.rules` | Create | Security rules |
| `firestore.indexes.json` | Create | Empty index config |
| `functions/package.json` | Create | Functions package (Node 20, own deps) |
| `functions/tsconfig.json` | Create | Functions TS build |
| `functions/.gitignore` | Create | Ignore `lib/`, `node_modules` |
| `functions/src/types.ts` | Create | Mirrored persistence types (see contract) |
| `functions/src/index.ts` | Create | Function exports (`claimPlayer`) |
| `functions/src/claimPlayer.ts` | Create | Callable: bind authUid to unclaimed seat |
| `functions/test/claimPlayer.test.ts` | Create | Emulator test for claimPlayer |
| `functions/vitest.config.ts` | Create | Vitest for functions package |
| `src/data/firebase.ts` | Create | Client SDK init + emulator wiring |
| `src/data/firebaseRepository.ts` | Create | `SweepRepository` over Firestore |
| `src/data/firebaseRepository.test.ts` | Create | Emulator test for the repo |
| `src/data/index.ts` | Modify | Select repo behind `VITE_USE_FIREBASE` |
| `src/data/types.ts` | Create | `StoredPlayer` (client side) |
| `src/auth/anonymousAuth.ts` | Create | Silent anonymous sign-in helper |
| `src/state/AppContext.tsx` | Modify | Sign in; current player from claim, not "last added" |
| `src/screens/SquadScreen.tsx` | Modify | Claim-a-seat affordance (read after exploring) |
| `.env.example` | Modify | Document new flags |
| `package.json` | Modify | Add `firebase` dep + emulator scripts |
| `README.md` | Modify | Emulator dev instructions |

---

## Task 1: Tooling prerequisites & functions workspace scaffold

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Confirm the Firebase CLI and a JDK are available (emulators need Java)**

Run:
```bash
firebase --version || npm i -g firebase-tools
java -version
```
Expected: a firebase-tools version prints; `java -version` prints a JDK (any 11+). If Java is missing, install Temurin/OpenJDK before continuing — the Firestore emulator will not start without it. **STOP and tell the user if Java cannot be installed.**

- [ ] **Step 2: Add the client SDK and emulator scripts to the root `package.json`**

Add to `dependencies`:
```json
"firebase": "^10.13.0"
```
Add to `scripts`:
```json
"emulators": "firebase emulators:start --only auth,firestore,functions",
"dev:firebase": "VITE_USE_FIREBASE=true VITE_USE_FIREBASE_EMULATOR=true vite",
"test:rules": "vitest run src/data/firebaseRepository.test.ts"
```
Then run `npm install`.

- [ ] **Step 3: Create `.firebaserc` with a demo project alias**

```json
{
  "projects": {
    "default": "demo-worldcup-sweep"
  }
}
```
Note: a project id beginning with `demo-` makes the emulator run fully offline with no real credentials.

- [ ] **Step 4: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20",
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ],
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 5: Create `firestore.indexes.json`**

```json
{ "indexes": [], "fieldOverrides": [] }
```

- [ ] **Step 6: Create a permissive placeholder `firestore.rules` (locked down in Task 7)**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // TEMPORARY — replaced in Task 7
    }
  }
}
```

- [ ] **Step 7: Scaffold the functions package — `functions/package.json`**

```json
{
  "name": "functions",
  "type": "module",
  "engines": { "node": "20" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "firebase-admin": "^12.6.0",
    "firebase-functions": "^6.1.0"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^3.0.4",
    "typescript": "^5.4.5",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 8: `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 9: `functions/.gitignore`**

```
lib/
node_modules/
```

- [ ] **Step 10: Install functions deps**

Run: `npm install --prefix functions`
Expected: completes without error.

- [ ] **Step 11: Verify emulators boot, then stop them**

Run: `firebase emulators:start --only auth,firestore --project demo-worldcup-sweep` in the background; confirm the log shows "All emulators ready" and the UI at `http://127.0.0.1:4000`, then Ctrl-C.
Expected: emulators start cleanly. **STOP if they don't.**

- [ ] **Step 12: Commit**

```bash
git add firebase.json .firebaserc firestore.rules firestore.indexes.json functions/package.json functions/tsconfig.json functions/.gitignore package.json package-lock.json
git commit -m "chore: scaffold Firebase emulator suite and functions workspace"
```

---

## Task 2: Shared persistence types

**Files:**
- Create: `src/data/types.ts`
- Create: `functions/src/types.ts`

- [ ] **Step 1: Create `src/data/types.ts`**

```ts
// Persistence-layer types. The domain `Player` (src/domain/types.ts) stays the
// single source of truth for the client; these add the two fields Firestore
// needs. Mirror any change here into functions/src/types.ts.
import type { Player } from '../domain/types';

export interface StoredPlayer extends Player {
  /** The anonymous auth UID that has claimed this seat, or null if unclaimed. */
  authUid: string | null;
  /** FCM registration tokens, one per installed device. Populated in Phase 2. */
  fcmTokens: string[];
}
```

- [ ] **Step 2: Create `functions/src/types.ts` (intentional mirror)**

```ts
// Server-side mirror of the persistence shapes. Kept in sync by hand with the
// client's src/domain/types.ts + src/data/types.ts (functions deploy in
// isolation and cannot import from the web app's src tree).

export interface Player {
  id: string;
  name: string;
  descriptor: string;
  photoUrl?: string;
  joinedAt: number;
}

export interface StoredPlayer extends Player {
  authUid: string | null;
  fcmTokens: string[];
}
```

- [ ] **Step 3: Type-check both**

Run: `npx tsc -b && npm --prefix functions run build`
Expected: both compile with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/types.ts functions/src/types.ts
git commit -m "feat: add StoredPlayer persistence types (client + functions mirror)"
```

---

## Task 3: `claimPlayer` callable Cloud Function (TDD against emulator)

A callable that, given `{ sweepId, playerId }`, binds the caller's `request.auth.uid` to that player doc **only if it is currently unclaimed** (`authUid == null`). Prevents seat hijacking.

**Files:**
- Create: `functions/src/claimPlayer.ts`
- Create: `functions/src/index.ts`
- Create: `functions/vitest.config.ts`
- Create: `functions/test/claimPlayer.test.ts`

- [ ] **Step 1: `functions/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20000,
    fileParallelism: false, // emulator state is shared; run serially
  },
});
```

- [ ] **Step 2: Write the failing test `functions/test/claimPlayer.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// These tests exercise the claim *logic* through the admin SDK by calling the
// extracted pure handler. The function wrapper is verified by integration in
// Task 4 once the repository can invoke it.
import { applyClaim, ClaimError } from '../src/claimPlayer.js';

let env: RulesTestEnvironment;

beforeEach(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-worldcup-sweep',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
});

afterAll(async () => {
  await env?.cleanup();
});

describe('applyClaim', () => {
  it('binds the uid to an unclaimed seat', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('sweeps/wc/players/p1').set({
        id: 'p1', name: 'Dave', descriptor: '', joinedAt: 1, authUid: null, fcmTokens: [],
      });
      await applyClaim(db, { sweepId: 'wc', playerId: 'p1', uid: 'uid-123' });
      const after = await db.doc('sweeps/wc/players/p1').get();
      expect(after.data()?.authUid).toBe('uid-123');
    });
  });

  it('is idempotent when the same uid re-claims its own seat', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('sweeps/wc/players/p1').set({
        id: 'p1', name: 'Dave', descriptor: '', joinedAt: 1, authUid: 'uid-123', fcmTokens: [],
      });
      await applyClaim(db, { sweepId: 'wc', playerId: 'p1', uid: 'uid-123' });
      const after = await db.doc('sweeps/wc/players/p1').get();
      expect(after.data()?.authUid).toBe('uid-123');
    });
  });

  it('rejects claiming a seat owned by a different uid', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('sweeps/wc/players/p1').set({
        id: 'p1', name: 'Dave', descriptor: '', joinedAt: 1, authUid: 'someone-else', fcmTokens: [],
      });
      await expect(
        applyClaim(db, { sweepId: 'wc', playerId: 'p1', uid: 'uid-123' }),
      ).rejects.toThrow(ClaimError);
    });
  });

  it('rejects claiming a non-existent seat', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await expect(
        applyClaim(db, { sweepId: 'wc', playerId: 'ghost', uid: 'uid-123' }),
      ).rejects.toThrow(ClaimError);
    });
  });
});
```

Note: `@firebase/rules-unit-testing`'s `ctx.firestore()` returns a client-style Firestore handle; the `applyClaim` signature below is written against the admin-style `Firestore` from `firebase-admin`. To keep the pure handler testable without standing up admin credentials, `applyClaim` is written against the **minimal interface it actually uses** (a `doc(path)` → `{ get, update }`), which both SDKs satisfy. See Step 4.

- [ ] **Step 3: Run the test to verify it fails**

Run (with emulators running in another terminal — `npm run emulators`):
```bash
npm --prefix functions run test
```
Expected: FAIL — `applyClaim` / `ClaimError` not exported.

- [ ] **Step 4: Implement `functions/src/claimPlayer.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureApp } from './firebaseAdmin.js';

export class ClaimError extends Error {}

/** Minimal Firestore surface applyClaim needs — satisfied by both the admin
 *  and client SDKs, so the logic is unit-testable against the emulator. */
interface DocLike {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  update(data: Record<string, unknown>): Promise<unknown>;
}
interface DbLike {
  doc(path: string): DocLike;
}

export async function applyClaim(
  db: DbLike,
  args: { sweepId: string; playerId: string; uid: string },
): Promise<void> {
  const ref = db.doc(`sweeps/${args.sweepId}/players/${args.playerId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ClaimError('No such player seat.');
  const current = snap.data()?.authUid ?? null;
  if (current !== null && current !== args.uid) {
    throw new ClaimError('This seat is already claimed by someone else.');
  }
  if (current === args.uid) return; // idempotent re-claim
  await ref.update({ authUid: args.uid });
}

export const claimPlayer = onCall(async (request) => {
  ensureApp();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in before claiming.');
  const { sweepId, playerId } = (request.data ?? {}) as { sweepId?: string; playerId?: string };
  if (!sweepId || !playerId) {
    throw new HttpsError('invalid-argument', 'sweepId and playerId are required.');
  }
  try {
    await applyClaim(getFirestore() as unknown as DbLike, { sweepId, playerId, uid });
    return { ok: true };
  } catch (err) {
    if (err instanceof ClaimError) throw new HttpsError('failed-precondition', err.message);
    throw err;
  }
});
```

- [ ] **Step 5: Create `functions/src/firebaseAdmin.ts` (lazy admin init shared by all functions)**

```ts
import { getApps, initializeApp } from 'firebase-admin/app';

/** Initialise the admin app exactly once (safe to call from every handler). */
export function ensureApp(): void {
  if (getApps().length === 0) initializeApp();
}
```

- [ ] **Step 6: Create `functions/src/index.ts`**

```ts
export { claimPlayer } from './claimPlayer.js';
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm --prefix functions run test`
Expected: PASS — all four `applyClaim` cases green.

- [ ] **Step 8: Commit**

```bash
git add functions/src/claimPlayer.ts functions/src/firebaseAdmin.ts functions/src/index.ts functions/vitest.config.ts functions/test/claimPlayer.test.ts
git commit -m "feat: claimPlayer callable binds authUid to an unclaimed seat"
```

---

## Task 4: Client Firebase init module

**Files:**
- Create: `src/data/firebase.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create `src/data/firebase.ts`**

```ts
// Single Firebase client entry point. Initialises the app from the public
// VITE_FIREBASE_* config and, when VITE_USE_FIREBASE_EMULATOR is set, wires the
// SDK to the local Auth/Firestore/Functions emulators instead of production.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-worldcup-sweep',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'demo-app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'demo-sender',
};

let app: FirebaseApp | null = null;
let connected = false;

function getApp(): FirebaseApp {
  if (!app) app = initializeApp(config);
  return app;
}

/** Connect the SDK to local emulators exactly once. */
function connectEmulatorsOnce(auth: Auth, db: Firestore, fns: Functions): void {
  if (connected || !useEmulator) return;
  connected = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
}

export function firebaseAuth(): Auth {
  const auth = getAuth(getApp());
  connectEmulatorsOnce(auth, getFirestore(getApp()), getFunctions(getApp()));
  return auth;
}

export function firebaseDb(): Firestore {
  const db = getFirestore(getApp());
  connectEmulatorsOnce(firebaseAuth(), db, getFunctions(getApp()));
  return db;
}

export function firebaseFunctions(): Functions {
  return getFunctions(getApp());
}
```

- [ ] **Step 2: Update `.env.example`** — replace the "Phase 5+" comment block with:

```
# Firebase web config (public — safe to ship in the client bundle).
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=

# Backend selection. Set both to "true" for local emulator development.
VITE_USE_FIREBASE=
VITE_USE_FIREBASE_EMULATOR=
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: compiles (firebase types resolve).

- [ ] **Step 4: Commit**

```bash
git add src/data/firebase.ts .env.example
git commit -m "feat: client Firebase init with emulator wiring"
```

---

## Task 5: `FirebaseRepository` (TDD against emulator)

Implements `SweepRepository` over Firestore. `subscribe()` is backed by realtime `onSnapshot` listeners over the collections the UI re-reads (players, assignments, commitment).

**Files:**
- Create: `src/data/firebaseRepository.ts`
- Create: `src/data/firebaseRepository.test.ts`

- [ ] **Step 1: Add a Vitest project setting so the repo test can reach the emulator**

Confirm `vite.config.ts` test config exists; the repo test imports the real `firebase/firestore` SDK pointed at the emulator via env. Add to the test file a guard that sets emulator env before importing `firebase.ts` is unnecessary — instead the test constructs its own Firestore via `@firebase/rules-unit-testing` (admin-disabled context) and passes it in. To allow that, `FirebaseRepository` takes its `Firestore` and `Auth` via constructor injection (defaulting to the module singletons).

- [ ] **Step 2: Write the failing test `src/data/firebaseRepository.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { FirebaseRepository } from './firebaseRepository';

let env: RulesTestEnvironment;
let db: Firestore;

beforeEach(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-worldcup-sweep',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
});

afterAll(async () => env?.cleanup());

async function seed(write: (db: Firestore) => Promise<void>): Promise<FirebaseRepository> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    db = ctx.firestore() as unknown as Firestore;
    await write(db);
  });
  return new FirebaseRepository('wc', { db });
}

describe('FirebaseRepository', () => {
  it('reads config from the sweep doc', async () => {
    const repo = await seed(async (d) => {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(d, 'sweeps/wc'), { contributionPence: 500, joinDeadline: 123 });
    });
    expect(await repo.getConfig()).toEqual({ contributionPence: 500, joinDeadline: 123 });
  });

  it('lists players ordered by joinedAt', async () => {
    const repo = await seed(async (d) => {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(d, 'sweeps/wc/players/b'), { id: 'b', name: 'B', descriptor: '', joinedAt: 2, authUid: null, fcmTokens: [] });
      await setDoc(doc(d, 'sweeps/wc/players/a'), { id: 'a', name: 'A', descriptor: '', joinedAt: 1, authUid: null, fcmTokens: [] });
    });
    const players = await repo.listPlayers();
    expect(players.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('addPlayer creates an unclaimed seat', async () => {
    const repo = await seed(async () => {});
    const created = await repo.addPlayer({ name: 'Dave', descriptor: 'the optimist' });
    const players = await repo.listPlayers();
    expect(players).toHaveLength(1);
    expect(players[0]!.name).toBe('Dave');
    expect(created.id).toBeTruthy();
  });

  it('saveAssignments then listAssignments round-trips', async () => {
    const repo = await seed(async () => {});
    await repo.saveAssignments([
      { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: null, revealedAuto: false },
    ]);
    expect(await repo.listAssignments()).toEqual([
      { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: null, revealedAuto: false },
    ]);
  });

  it('markRevealed sets revealedAt for the given player+teams only', async () => {
    const repo = await seed(async () => {});
    await repo.saveAssignments([
      { teamId: 'ESP', playerId: 'p1', bucket: 1, revealedAt: null, revealedAuto: false },
      { teamId: 'BRA', playerId: 'p2', bucket: 1, revealedAt: null, revealedAuto: false },
    ]);
    await repo.markRevealed('p1', ['ESP'], true);
    const byTeam = Object.fromEntries((await repo.listAssignments()).map((a) => [a.teamId, a]));
    expect(byTeam.ESP!.revealedAt).not.toBeNull();
    expect(byTeam.ESP!.revealedAuto).toBe(true);
    expect(byTeam.BRA!.revealedAt).toBeNull();
  });

  it('subscribe fires when players change', async () => {
    const repo = await seed(async () => {});
    let calls = 0;
    const unsub = repo.subscribe(() => { calls += 1; });
    await repo.addPlayer({ name: 'X', descriptor: '' });
    await new Promise((r) => setTimeout(r, 300));
    unsub();
    expect(calls).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (emulators running): `npx vitest run src/data/firebaseRepository.test.ts`
Expected: FAIL — `FirebaseRepository` not found.

- [ ] **Step 4: Implement `src/data/firebaseRepository.ts`**

```ts
// Firestore-backed SweepRepository. The UI is unchanged: it talks only to the
// SweepRepository interface. Realtime listeners back subscribe(). Writes to
// config/commitment/assignments are allowed here for emulator/dev; in
// production Firestore rules restrict those to Cloud Functions (see Phase 4,
// commitDraw). Dependencies are injected so tests can pass an emulator handle.
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  setDoc, updateDoc, writeBatch, type Firestore,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { Auth } from 'firebase/auth';
import type { Assignment, DrawCommitment, Fixture, Player, SweepConfig, Team } from '../domain/types';
import type { StoredPlayer } from './types';
import type { SweepRepository } from './repository';
import { firebaseAuth, firebaseDb, firebaseFunctions } from './firebase';

interface Deps { db?: Firestore; auth?: Auth }

export class FirebaseRepository implements SweepRepository {
  private readonly db: Firestore;
  private readonly auth: Auth | null;

  constructor(private readonly sweepId: string, deps: Deps = {}) {
    this.db = deps.db ?? firebaseDb();
    this.auth = deps.auth ?? null;
  }

  private path(...segments: string[]): string {
    return ['sweeps', this.sweepId, ...segments].join('/');
  }

  async getConfig(): Promise<SweepConfig> {
    const snap = await getDoc(doc(this.db, this.path()));
    const data = snap.data() ?? {};
    return {
      contributionPence: Number(data.contributionPence ?? 0),
      joinDeadline: Number(data.joinDeadline ?? 0),
    };
  }

  async listTeams(): Promise<Team[]> {
    const snap = await getDocs(collection(this.db, this.path('teams')));
    return snap.docs.map((d) => d.data() as Team);
  }

  async listFixtures(): Promise<Fixture[]> {
    const snap = await getDocs(collection(this.db, this.path('fixtures')));
    return snap.docs.map((d) => d.data() as Fixture);
  }

  async listPlayers(): Promise<Player[]> {
    const snap = await getDocs(
      query(collection(this.db, this.path('players')), orderBy('joinedAt')),
    );
    return snap.docs.map((d) => d.data() as StoredPlayer);
  }

  async addPlayer(input: Omit<Player, 'id' | 'joinedAt'>): Promise<Player> {
    const id = crypto.randomUUID();
    const stored: StoredPlayer = {
      ...input, id, joinedAt: Date.now(), authUid: null, fcmTokens: [],
    };
    await setDoc(doc(this.db, this.path('players', id)), stored);
    return stored;
  }

  async getCommitment(): Promise<DrawCommitment | null> {
    const snap = await getDoc(doc(this.db, this.path('commitment', 'current')));
    return snap.exists() ? (snap.data() as DrawCommitment) : null;
  }

  async saveCommitment(commitment: DrawCommitment): Promise<void> {
    await setDoc(doc(this.db, this.path('commitment', 'current')), commitment);
  }

  async listAssignments(): Promise<Assignment[]> {
    const snap = await getDocs(collection(this.db, this.path('assignments')));
    return snap.docs.map((d) => d.data() as Assignment);
  }

  async saveAssignments(assignments: Assignment[]): Promise<void> {
    const batch = writeBatch(this.db);
    for (const a of assignments) {
      batch.set(doc(this.db, this.path('assignments', a.teamId)), a);
    }
    await batch.commit();
  }

  async markRevealed(playerId: string, teamIds: string[], auto: boolean): Promise<void> {
    const now = Date.now();
    const batch = writeBatch(this.db);
    for (const teamId of teamIds) {
      batch.update(doc(this.db, this.path('assignments', teamId)), {
        revealedAt: now, revealedAuto: auto,
      });
    }
    await batch.commit();
    void playerId; // teamIds are unique per assignment; playerId not needed for the write
  }

  /** Bind the current device's anonymous uid to a seat via the callable. */
  async claimPlayer(playerId: string): Promise<void> {
    const callable = httpsCallable(firebaseFunctions(), 'claimPlayer');
    await callable({ sweepId: this.sweepId, playerId });
  }

  subscribe(listener: () => void): () => void {
    const unsubs = [
      onSnapshot(collection(this.db, this.path('players')), () => listener()),
      onSnapshot(collection(this.db, this.path('assignments')), () => listener()),
      onSnapshot(doc(this.db, this.path('commitment', 'current')), () => listener()),
    ];
    return () => unsubs.forEach((u) => u());
  }
}
```

Note: `markRevealed`'s `updateDoc` import is via `updateDoc` in the batch; the unused direct `updateDoc` import should be removed if tsc flags it. Keep imports to those actually used (`writeBatch` covers updates).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/data/firebaseRepository.test.ts`
Expected: PASS — all six cases green.

- [ ] **Step 6: Remove any unused imports flagged by tsc, then type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/data/firebaseRepository.ts src/data/firebaseRepository.test.ts
git commit -m "feat: FirebaseRepository implements SweepRepository over Firestore"
```

---

## Task 6: Anonymous auth + repository selection + current-player-from-claim

**Files:**
- Create: `src/auth/anonymousAuth.ts`
- Modify: `src/data/index.ts`
- Modify: `src/state/AppContext.tsx`

- [ ] **Step 1: Create `src/auth/anonymousAuth.ts`**

```ts
// Silent anonymous sign-in. Every device gets a stable anonymous uid that the
// claimPlayer callable binds to a seat. No UI; resolves with the uid.
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { firebaseAuth } from '../data/firebase';

export async function ensureAnonymousUser(): Promise<string> {
  const auth = firebaseAuth();
  if (auth.currentUser) return auth.currentUser.uid;
  await signInAnonymously(auth);
  return new Promise<string>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user.uid); }
    });
  });
}
```

- [ ] **Step 2: Modify `src/data/index.ts` to select the backend**

```ts
// Single place to choose the backend. LocalRepository stays the default for
// offline dev/tests; VITE_USE_FIREBASE swaps in the Firestore implementation.
import type { SweepRepository } from './repository';
import { LocalRepository } from './localRepository';
import { FirebaseRepository } from './firebaseRepository';

export function createRepository(sweepId: string): SweepRepository {
  if (import.meta.env.VITE_USE_FIREBASE === 'true') {
    return new FirebaseRepository(sweepId);
  }
  return new LocalRepository(sweepId);
}
```

- [ ] **Step 3: Modify `AppContext.tsx` — sign in anonymously on mount and set current player from the claimed seat**

Replace the dev "latest player is you" effect (lines ~90–95) with auth-driven identity when Firebase is active. Add near the top of `AppProvider`:

```tsx
import { ensureAnonymousUser } from '../auth/anonymousAuth';
import type { StoredPlayer } from '../data/types';

const useFirebase = import.meta.env.VITE_USE_FIREBASE === 'true';
const [authUid, setAuthUid] = useState<string | null>(null);

useEffect(() => {
  if (!useFirebase) return;
  void ensureAnonymousUser().then(setAuthUid);
}, []);
```

Replace the current-player effect with:

```tsx
// Identify "you": with Firebase, the seat whose authUid matches this device;
// in local dev, the most recently added player.
useEffect(() => {
  if (useFirebase) {
    const mine = (players as StoredPlayer[]).find((p) => p.authUid && p.authUid === authUid);
    setCurrentPlayerId(mine ? mine.id : null);
  } else if (players.length > 0) {
    setCurrentPlayerId((current) => current ?? players[players.length - 1]!.id);
  }
}, [players, authUid]);
```

Add a `claimSeat` action to the context value:

```tsx
const claimSeat = useCallback(async (playerId: string) => {
  if (useFirebase && repository instanceof FirebaseRepository) {
    await repository.claimPlayer(playerId);
    setCurrentPlayerId(playerId);
  } else {
    setCurrentPlayerId(playerId);
  }
}, [repository]);
```

Add `claimSeat: (playerId: string) => Promise<void>;` to the `AppState` interface, and include `claimSeat` in the `value` object and its dependency array. Import `FirebaseRepository` at the top.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Manual smoke test against the emulator**

Run, in two terminals:
```bash
npm run emulators
npm run dev:firebase
```
Then seed a config + a player via the Emulator UI (`http://127.0.0.1:4000` → Firestore → add `sweeps/test` with `contributionPence: 500`, `joinDeadline: <future ms>`, and a `players/p1` doc with `authUid: null`). Open `http://localhost:5173/#test`. Expected: the lobby loads from Firestore; the seeded player appears. **STOP if data does not load.**

- [ ] **Step 6: Commit**

```bash
git add src/auth/anonymousAuth.ts src/data/index.ts src/state/AppContext.tsx
git commit -m "feat: anonymous auth, Firebase backend selection, current-player from claim"
```

---

## Task 7: Claim-a-seat UI affordance

**Files:**
- Modify: `src/screens/SquadScreen.tsx`

- [ ] **Step 1: Read `src/screens/SquadScreen.tsx` and `src/screens/HomeScreen.tsx`** to learn how players are listed and how `addPlayer` is currently triggered, and match that styling.

- [ ] **Step 2: Add a "This is me" button** beside each unclaimed player (one with no `authUid`) when `useFirebase` is on and the device has not yet claimed a seat. On click call `claimSeat(player.id)`. Show a subtle "you" marker on the seat whose id equals `currentPlayerId`. Re-use existing list markup and CSS tokens — do not introduce new styling primitives.

```tsx
// Inside the player row render, when Firebase is active and currentPlayerId is null:
{currentPlayerId === null && (player as StoredPlayer).authUid == null && (
  <button className="ghost-button" onClick={() => void claimSeat(player.id)}>
    This is me
  </button>
)}
{currentPlayerId === player.id && <span className="badge">you</span>}
```

(Use the actual class names found in Step 1; the above is illustrative of behaviour, not final class names.)

- [ ] **Step 3: Type-check + build**

Run: `npx tsc -b && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test** — with emulators + `dev:firebase`, claim a seat; confirm it sticks across reload (the `authUid` now matches on re-sign-in) and the "you" marker shows on the right seat.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SquadScreen.tsx
git commit -m "feat: claim-a-seat affordance bound to claimPlayer callable"
```

---

## Task 8: Lock down Firestore security rules (TDD)

**Files:**
- Modify: `firestore.rules`
- Create: `functions/test/rules.test.ts` (rules tests live with the emulator-aware test suite)

- [ ] **Step 1: Write the failing rules test `functions/test/rules.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let env: RulesTestEnvironment;

beforeEach(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-worldcup-sweep',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('../firestore.rules', 'utf8') },
  });
  await env.clearFirestore();
});

afterAll(async () => env?.cleanup());

describe('firestore rules', () => {
  it('any signed-in user can read sweep data', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(ctx.firestore(), 'sweeps/wc'), { contributionPence: 500, joinDeadline: 1 });
    });
    const db = env.authenticatedContext('uid-1').firestore();
    const { doc, getDoc } = await import('firebase/firestore');
    await assertSucceeds(getDoc(doc(db, 'sweeps/wc')));
  });

  it('clients cannot write config/assignments/commitment/fixtures', async () => {
    const db = env.authenticatedContext('uid-1').firestore();
    const { doc, setDoc } = await import('firebase/firestore');
    await assertFails(setDoc(doc(db, 'sweeps/wc'), { contributionPence: 1, joinDeadline: 1 }));
    await assertFails(setDoc(doc(db, 'sweeps/wc/assignments/ESP'), { teamId: 'ESP' }));
    await assertFails(setDoc(doc(db, 'sweeps/wc/commitment/current'), { seed: null }));
    await assertFails(setDoc(doc(db, 'sweeps/wc/fixtures/f1'), { id: 'f1' }));
  });

  it('a device may update only its own claimed seat fcmTokens', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(ctx.firestore(), 'sweeps/wc/players/p1'), {
        id: 'p1', name: 'A', descriptor: '', joinedAt: 1, authUid: 'uid-1', fcmTokens: [],
      });
    });
    const mine = env.authenticatedContext('uid-1').firestore();
    const theirs = env.authenticatedContext('uid-2').firestore();
    const { doc, updateDoc } = await import('firebase/firestore');
    await assertSucceeds(updateDoc(doc(mine, 'sweeps/wc/players/p1'), { fcmTokens: ['t1'] }));
    await assertFails(updateDoc(doc(theirs, 'sweeps/wc/players/p1'), { fcmTokens: ['evil'] }));
  });

  it('clients cannot set authUid directly (claim goes through the callable)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(ctx.firestore(), 'sweeps/wc/players/p1'), {
        id: 'p1', name: 'A', descriptor: '', joinedAt: 1, authUid: null, fcmTokens: [],
      });
    });
    const db = env.authenticatedContext('uid-1').firestore();
    const { doc, updateDoc } = await import('firebase/firestore');
    await assertFails(updateDoc(doc(db, 'sweeps/wc/players/p1'), { authUid: 'uid-1' }));
  });
});
```

Add a script to `functions/package.json`: `"test:rules": "vitest run test/rules.test.ts"` (or run via the existing `test`). The test reads `../firestore.rules`, so run from the `functions` dir.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix functions exec vitest run test/rules.test.ts`
Expected: FAIL — the temporary permissive rules allow the writes that should fail.

- [ ] **Step 3: Replace `firestore.rules` with locked-down rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sweeps/{sweepId} {
      // Sweep config + all sweep data is world-readable (provably fair).
      allow read: if request.auth != null;
      // Config is written only by the admin SDK (seeding) / Cloud Functions.
      allow write: if false;

      match /players/{playerId} {
        allow read: if request.auth != null;
        // A new seat may be created by anyone signed in (lobby "add me"),
        // but only as an UNCLAIMED seat (authUid must be null).
        allow create: if request.auth != null
                      && request.resource.data.authUid == null;
        // The owning device may update only its own seat, and may not change
        // authUid (claiming is mediated by the claimPlayer callable / admin).
        allow update: if request.auth != null
                      && resource.data.authUid == request.auth.uid
                      && request.resource.data.authUid == resource.data.authUid;
        allow delete: if false;
      }

      match /teams/{teamId}        { allow read: if request.auth != null; allow write: if false; }
      match /fixtures/{fixtureId}  { allow read: if request.auth != null; allow write: if false; }
      match /assignments/{teamId}  { allow read: if request.auth != null; allow write: if false; }
      match /commitment/{docId}    { allow read: if request.auth != null; allow write: if false; }
      match /sentNotifications/{key} { allow read, write: if false; }
    }
  }
}
```

Note: the admin SDK (used by Cloud Functions, seeding, and `withSecurityRulesDisabled` in tests) bypasses these rules, so `claimPlayer` and `addPlayer`-via-function still work. `addPlayer` from the client creates an unclaimed seat (allowed by the `create` rule). `saveCommitment`/`saveAssignments` from the client `FirebaseRepository` will now be **rejected in production** — that is intended; Phase 4 moves those writes into the `commitDraw` callable. For Phase 1 emulator dev they still work because the repo test uses `withSecurityRulesDisabled`. Add a TODO comment in `firebaseRepository.ts` noting `saveCommitment`/`saveAssignments` move server-side in Phase 4.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix functions exec vitest run test/rules.test.ts`
Expected: PASS — reads succeed, protected writes fail, own-seat fcmTokens update succeeds.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules functions/test/rules.test.ts functions/package.json src/data/firebaseRepository.ts
git commit -m "feat: lock down Firestore rules (world-read, function-only writes, own-seat tokens)"
```

---

## Task 9: Documentation & full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Local development with Firebase emulators" section to `README.md`** documenting: install `firebase-tools` + a JDK; `npm install && npm install --prefix functions`; run `npm run emulators`; in another terminal `npm run dev:firebase`; seed `sweeps/<id>` config + players via the Emulator UI; open `#<id>`. Note that production deploy (real project, FCM/VAPID, `API_SPORTS_KEY`) is **out of scope for emulator dev** and tracked in later phases.

- [ ] **Step 2: Run the full test suite**

Run:
```bash
npm test
npm --prefix functions run test
```
Expected: all green (existing `draw.test.ts`, `firebaseRepository.test.ts`, `claimPlayer.test.ts`, `rules.test.ts`).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: Firebase emulator development workflow"
```

---

## Self-Review Notes

- **Spec coverage:** FirebaseRepository (✓ Task 5), behind `VITE_USE_FIREBASE` (✓ Task 6), realtime `subscribe()` (✓ Task 5 Step 6 test), Anonymous Auth (✓ Task 6), `claimPlayer` callable on unclaimed seat (✓ Task 3), single share-link join (uses existing `useSweepId` hash routing — unchanged), security rules (✓ Task 8). `commitDraw` is intentionally deferred to Phase 4 per the spec's phasing. Fixtures/teams seeding into Firestore is Phase 4 (Admin/Seeding section).
- **Deferred-with-note:** client `saveCommitment`/`saveAssignments` writes are allowed only under emulator rules now; Phase 4 moves them into `commitDraw`. Flagged in Task 8 Step 3.
- **Type consistency:** `StoredPlayer` defined once (client `src/data/types.ts`, mirrored in `functions/src/types.ts`); `claimPlayer({ sweepId, playerId })` signature matches between callable (Task 3) and `FirebaseRepository.claimPlayer` (Task 5). Emulator ports (9099/8080/5001/4000) identical across `firebase.json`, `firebase.ts`, and tests.
```
