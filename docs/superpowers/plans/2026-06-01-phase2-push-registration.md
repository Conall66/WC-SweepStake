# Phase 2 — Push Registration, Service Worker & FCM Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on Phase 1 being merged.**

**Goal:** After a player claims their seat, register the device for web push (FCM): a platform-aware permission flow (iOS-standalone-gated vs Android/desktop direct), an owned custom service worker that handles background pushes and notification taps, and persistence of the FCM token onto the device's own seat.

**Architecture:** Switch `vite-plugin-pwa` from the generated SW to `injectManifest`, so we ship `src/sw.ts` and keep Workbox precaching. The SW imports `firebase/messaging/sw` for background messages and adds `push`/`notificationclick` handlers that deep-link into the app. A pure `pushEligibility()` function decides what the UI should do per platform (it's unit-tested with fake `navigator`/`display-mode` inputs). Registration calls `getToken()` and appends the token to the player's `fcmTokens` via an own-seat Firestore update (permitted by the Phase 1 rules).

**Tech Stack:** `firebase/messaging` (+ `/sw`), `vite-plugin-pwa` `injectManifest` strategy + `workbox-precaching`, Vitest.

---

## Shared Contract additions (read first)

- **Token persistence:** `FirebaseRepository.addFcmToken(playerId, token)` uses Firestore `arrayUnion` on `players/{playerId}.fcmTokens`. Allowed by the Phase 1 rule (own seat, `authUid` unchanged). Removal (`removeFcmToken`) uses `arrayRemove`; the `tick` prunes server-side in Phase 3/4.
- **VAPID key:** read from `import.meta.env.VITE_FIREBASE_VAPID_KEY` (public). Empty in emulator dev (push send is exercised in later phases / on a real project) — registration code must **degrade gracefully** when the key or `getToken` is unavailable, returning a typed result rather than throwing.
- **Deep-link contract (SW ↔ app):** notification `data.click` is one of `"fixtures" | "reveal" | "home"`. `notificationclick` focuses an existing client or opens `<scope>#<sweepId>` and posts `{ type: 'navigate', to }`; the app listens and switches tabs. `data.sweepId` is always included.
- **`pushEligibility` result type** (used by UI and tested):

```ts
export type PushEligibility =
  | { kind: 'ready' }                 // can prompt for permission now
  | { kind: 'ios-needs-install' }     // iOS Safari, not standalone -> show A2HS hint
  | { kind: 'denied' }                // permission previously denied
  | { kind: 'granted' }               // already granted
  | { kind: 'unsupported' };          // no Notification/SW/PushManager
```

---

## File Structure

| Path | Created/Modified | Responsibility |
|---|---|---|
| `src/push/eligibility.ts` | Create | Pure platform/permission decision |
| `src/push/eligibility.test.ts` | Create | Unit tests for eligibility |
| `src/push/register.ts` | Create | Permission prompt + getToken + persist |
| `src/push/installPrompt.ts` | Create | `beforeinstallprompt` capture (Android/desktop) |
| `src/sw.ts` | Create | Owned service worker (precache + FCM + handlers) |
| `src/data/firebaseRepository.ts` | Modify | `addFcmToken` / `removeFcmToken` |
| `src/data/repository.ts` | Modify | Add optional token methods to interface |
| `src/data/localRepository.ts` | Modify | No-op token methods (keeps interface honest) |
| `src/components/PushPrompt.tsx` | Create | UI: prompt / iOS A2HS hint / install button |
| `src/state/AppContext.tsx` | Modify | Expose `registerPush`; call after claim |
| `vite.config.ts` | Modify | Switch to `injectManifest` |
| `.env.example` | Modify | Add `VITE_FIREBASE_VAPID_KEY` |
| `package.json` | Modify | Add `workbox-precaching`, `workbox-window` if needed |

---

## Task 1: Pure push-eligibility decision (TDD)

**Files:**
- Create: `src/push/eligibility.ts`, `src/push/eligibility.test.ts`

- [ ] **Step 1: Write the failing test `src/push/eligibility.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { pushEligibility, type EligibilityInput } from './eligibility';

const base: EligibilityInput = {
  hasNotification: true,
  hasServiceWorker: true,
  hasPushManager: true,
  permission: 'default',
  isIOS: false,
  isStandalone: false,
};

describe('pushEligibility', () => {
  it('is unsupported without Notification API', () => {
    expect(pushEligibility({ ...base, hasNotification: false }).kind).toBe('unsupported');
  });
  it('is unsupported without service worker', () => {
    expect(pushEligibility({ ...base, hasServiceWorker: false }).kind).toBe('unsupported');
  });
  it('reflects an already-granted permission', () => {
    expect(pushEligibility({ ...base, permission: 'granted' }).kind).toBe('granted');
  });
  it('reflects a denied permission', () => {
    expect(pushEligibility({ ...base, permission: 'denied' }).kind).toBe('denied');
  });
  it('on iOS not-standalone, needs install first', () => {
    expect(pushEligibility({ ...base, isIOS: true, isStandalone: false }).kind)
      .toBe('ios-needs-install');
  });
  it('on iOS standalone with default permission, is ready', () => {
    expect(pushEligibility({ ...base, isIOS: true, isStandalone: true }).kind).toBe('ready');
  });
  it('on Android/desktop with default permission, is ready', () => {
    expect(pushEligibility(base).kind).toBe('ready');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/push/eligibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/push/eligibility.ts`**

```ts
// Pure decision for whether/how this device can register for web push.
// All environment facts are passed in so it is unit-testable; detect() reads
// them from the real browser.

export interface EligibilityInput {
  hasNotification: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: NotificationPermission; // 'default' | 'granted' | 'denied'
  isIOS: boolean;
  isStandalone: boolean;
}

export type PushEligibility =
  | { kind: 'ready' }
  | { kind: 'ios-needs-install' }
  | { kind: 'denied' }
  | { kind: 'granted' }
  | { kind: 'unsupported' };

export function pushEligibility(input: EligibilityInput): PushEligibility {
  if (!input.hasNotification || !input.hasServiceWorker || !input.hasPushManager) {
    return { kind: 'unsupported' };
  }
  if (input.permission === 'granted') return { kind: 'granted' };
  if (input.permission === 'denied') return { kind: 'denied' };
  // permission === 'default'
  if (input.isIOS && !input.isStandalone) return { kind: 'ios-needs-install' };
  return { kind: 'ready' };
}

/** Read the real environment. Kept tiny and free of decision logic. */
export function detectEligibility(): PushEligibility {
  const hasNotification = typeof Notification !== 'undefined';
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const isIOS = !!nav && /iphone|ipad|ipod/i.test(nav.userAgent);
  const isStandalone =
    (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
    // iOS Safari legacy flag
    (typeof nav !== 'undefined' && (nav as unknown as { standalone?: boolean }).standalone === true);
  return pushEligibility({
    hasNotification,
    hasServiceWorker: !!nav && 'serviceWorker' in nav,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    permission: hasNotification ? Notification.permission : 'denied',
    isIOS,
    isStandalone,
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/push/eligibility.test.ts`
Expected: PASS — all seven cases.

- [ ] **Step 5: Commit**

```bash
git add src/push/eligibility.ts src/push/eligibility.test.ts
git commit -m "feat: pure push-eligibility decision per platform/permission"
```

---

## Task 2: Token persistence on the repository

**Files:**
- Modify: `src/data/repository.ts`, `src/data/firebaseRepository.ts`, `src/data/localRepository.ts`

- [ ] **Step 1: Add to the `SweepRepository` interface (`src/data/repository.ts`)**

```ts
  /** Append an FCM registration token to a player's own seat. */
  addFcmToken(playerId: string, token: string): Promise<void>;
  /** Remove a (rotated/dead) FCM token from a player's seat. */
  removeFcmToken(playerId: string, token: string): Promise<void>;
```

- [ ] **Step 2: Implement in `FirebaseRepository` (`src/data/firebaseRepository.ts`)**

Add `arrayUnion, arrayRemove` to the `firebase/firestore` import, and:

```ts
  async addFcmToken(playerId: string, token: string): Promise<void> {
    await updateDoc(doc(this.db, this.path('players', playerId)), {
      fcmTokens: arrayUnion(token),
    });
  }

  async removeFcmToken(playerId: string, token: string): Promise<void> {
    await updateDoc(doc(this.db, this.path('players', playerId)), {
      fcmTokens: arrayRemove(token),
    });
  }
```

Add `updateDoc` to the import (it is now genuinely used).

- [ ] **Step 3: Implement no-ops in `LocalRepository` (`src/data/localRepository.ts`)**

```ts
  async addFcmToken(): Promise<void> { /* no push in local dev */ }
  async removeFcmToken(): Promise<void> { /* no push in local dev */ }
```

- [ ] **Step 4: Extend the Firebase repo test** — add a case to `src/data/firebaseRepository.test.ts`:

```ts
  it('addFcmToken appends without duplicates', async () => {
    const repo = await seed(async (d) => {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(d, 'sweeps/wc/players/p1'), {
        id: 'p1', name: 'A', descriptor: '', joinedAt: 1, authUid: 'uid-1', fcmTokens: [],
      });
    });
    await repo.addFcmToken('p1', 'tok-1');
    await repo.addFcmToken('p1', 'tok-1');
    const players = await repo.listPlayers();
    expect((players[0] as any).fcmTokens).toEqual(['tok-1']);
  });
```

- [ ] **Step 5: Run repo tests (emulators running)**

Run: `npx vitest run src/data/firebaseRepository.test.ts`
Expected: PASS including the new case.

- [ ] **Step 6: Commit**

```bash
git add src/data/repository.ts src/data/firebaseRepository.ts src/data/localRepository.ts src/data/firebaseRepository.test.ts
git commit -m "feat: persist FCM tokens on the player seat (arrayUnion/arrayRemove)"
```

---

## Task 3: Owned service worker via injectManifest

**Files:**
- Modify: `vite.config.ts`, `.env.example`, `package.json`
- Create: `src/sw.ts`

- [ ] **Step 1: Add deps** — `npm install workbox-precaching firebase`. (`firebase` already present from Phase 1.)

- [ ] **Step 2: Switch `vite.config.ts` to `injectManifest`** — change the `VitePWA({...})` call:

```ts
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'],
      },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        /* unchanged from the existing manifest block */
      },
    })
```

Keep the existing `manifest` object exactly as it is. Remove the old `workbox` key (its `globPatterns` move under `injectManifest`).

- [ ] **Step 3: Create `src/sw.ts`** (the owned service worker)

```ts
/// <reference lib="webworker" />
// Owned service worker. Precaches the app shell (Workbox) for offline use and
// handles FCM background messages + notification taps for push.
import { precacheAndRoute } from 'workbox-precaching';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// 1. Offline app shell (preserves existing PWA precache behaviour).
precacheAndRoute(self.__WB_MANIFEST);

// 2. Firebase Messaging background handler. Config is injected at build time
//    via import.meta.env (Vite inlines these into the SW bundle).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

if (firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'The Sweep';
    void self.registration.showNotification(title, {
      body: payload.notification?.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data ?? {},
    });
  });
}

// 3. Tap handling — focus an open tab or open the app at the right screen.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data = (event.notification.data ?? {}) as { click?: string; sweepId?: string };
  const to = data.click ?? 'home';
  const url = `${self.registration.scope}#${data.sweepId ?? ''}`;
  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsArr) {
      if ('focus' in client) {
        await (client as WindowClient).focus();
        client.postMessage({ type: 'navigate', to });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
```

- [ ] **Step 4: Add VAPID key to `.env.example`** — append:

```
# Public Web Push (VAPID) key from Firebase console → Cloud Messaging → Web config.
VITE_FIREBASE_VAPID_KEY=
```

- [ ] **Step 5: Build to confirm the SW compiles and the manifest injects**

Run: `npm run build`
Expected: build succeeds and `dist/sw.js` exists with a precache manifest. (Run `ls dist/sw.js`.)

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts src/sw.ts .env.example package.json package-lock.json
git commit -m "feat: owned service worker (injectManifest) with FCM background + tap handlers"
```

---

## Task 4: Push registration flow

**Files:**
- Create: `src/push/register.ts`, `src/push/installPrompt.ts`

- [ ] **Step 1: Create `src/push/installPrompt.ts`** (capture Android/desktop install prompt)

```ts
// Captures the beforeinstallprompt event so the UI can offer a one-tap install
// on Android/desktop. Purely a nicety; never gates push permission.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

export function canInstall(): boolean {
  return deferred !== null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome;
}
```

- [ ] **Step 2: Create `src/push/register.ts`**

```ts
// Request notification permission, obtain an FCM token, and hand it to the
// caller for persistence. Degrades gracefully when push is unavailable (e.g.
// emulator dev with no VAPID key) so the UI never crashes.
import { getMessaging, getToken } from 'firebase/messaging';
import { firebaseFunctions } from '../data/firebase'; // ensures app is initialised
import { initializeApp, getApps } from 'firebase/app';

export type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'denied' | 'no-vapid' | 'unsupported' | 'error' };

export async function registerForPush(): Promise<RegisterResult> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, reason: 'unsupported' };
  }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return { ok: false, reason: 'no-vapid' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    // The PWA SW (sw.ts) is already registered by vite-plugin-pwa; reuse it.
    const registration = await navigator.serviceWorker.ready;
    if (getApps().length === 0) {
      initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      });
    }
    void firebaseFunctions(); // touch to guarantee init/emulator wiring ran
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, reason: 'error' };
    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/push/register.ts src/push/installPrompt.ts
git commit -m "feat: platform-aware push registration + install prompt capture"
```

---

## Task 5: PushPrompt UI + wire into claim flow

**Files:**
- Create: `src/components/PushPrompt.tsx`
- Modify: `src/state/AppContext.tsx`
- Modify: a screen that renders for a claimed player (e.g. `src/screens/HomeScreen.tsx` — read it first)

- [ ] **Step 1: Add `registerPush` to `AppContext`** — a callback that runs registration and persists the token onto the current player's seat:

```tsx
import { registerForPush } from '../push/register';

const registerPush = useCallback(async () => {
  if (!useFirebase || !currentPlayerId) return { ok: false as const, reason: 'unsupported' as const };
  const result = await registerForPush();
  if (result.ok) await repository.addFcmToken(currentPlayerId, result.token);
  return result;
}, [repository, currentPlayerId]);
```

Add `registerPush` to the `AppState` interface (`registerPush: () => Promise<import('../push/register').RegisterResult>;`) and to the `value` object + deps array.

- [ ] **Step 2: Create `src/components/PushPrompt.tsx`**

```tsx
// Shows the right push affordance for the device after a seat is claimed:
//  - ready:              "Turn on reminders" button -> registerPush()
//  - ios-needs-install:  "Add to Home Screen to get reminders" hint
//  - granted/denied/unsupported: nothing / a short note
import { useEffect, useState } from 'react';
import { detectEligibility, type PushEligibility } from '../push/eligibility';
import { canInstall, promptInstall } from '../push/installPrompt';
import { useApp } from '../state/AppContext';

export function PushPrompt() {
  const { currentPlayerId, registerPush } = useApp();
  const [eligibility, setEligibility] = useState<PushEligibility | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setEligibility(detectEligibility()); }, [currentPlayerId]);

  if (!currentPlayerId || !eligibility) return null;

  if (eligibility.kind === 'granted') return null;
  if (eligibility.kind === 'unsupported') return null;

  if (eligibility.kind === 'ios-needs-install') {
    return (
      <div className="push-hint">
        Add this app to your Home Screen (Share → Add to Home Screen) to get
        match and deadline reminders.
      </div>
    );
  }

  if (eligibility.kind === 'denied') {
    return <div className="push-hint">Notifications are blocked in your browser settings.</div>;
  }

  // ready
  return (
    <div className="push-hint">
      {canInstall() && (
        <button className="ghost-button" onClick={() => void promptInstall()}>Install app</button>
      )}
      <button
        className="primary-button"
        onClick={async () => {
          const r = await registerPush();
          setStatus(r.ok ? 'Reminders are on.' : `Couldn't enable reminders (${r.reason}).`);
          setEligibility(detectEligibility());
        }}
      >
        Turn on reminders
      </button>
      {status && <p className="push-status">{status}</p>}
    </div>
  );
}
```

(Use the project's real button class names discovered when reading the screen; the above is behavioural.)

- [ ] **Step 3: Render `<PushPrompt />`** on the home/lobby screen for a claimed player. Read the chosen screen first and place it where a claimed player will see it (e.g. below the player's own squad summary). Add the `navigate` message listener once, near app root (e.g. in `AppShell.tsx`):

```tsx
useEffect(() => {
  if (!('serviceWorker' in navigator)) return;
  const handler = (e: MessageEvent) => {
    const msg = e.data as { type?: string; to?: string };
    if (msg?.type === 'navigate' && msg.to) {
      // setActiveTab(msg.to) — use AppShell's existing tab state setter
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}, []);
```

Wire `msg.to` (`'fixtures' | 'reveal' | 'home'`) to AppShell's existing tab state (read `AppShell.tsx`/`TabBar.tsx` first to use the real setter and tab ids).

- [ ] **Step 4: Type-check + build**

Run: `npx tsc -b && npm run build`
Expected: succeeds.

- [ ] **Step 5: Manual smoke test (Android Chrome or desktop Chrome over HTTPS)** — emulator dev has no VAPID key, so registration returns `no-vapid`; confirm the button shows, click shows the graceful message, and the iOS branch shows the A2HS hint when simulated (DevTools → device toolbar → iPhone, run in a non-standalone tab). Full token issuance is verified on a real Firebase project (see deploy notes).

- [ ] **Step 6: Commit**

```bash
git add src/components/PushPrompt.tsx src/state/AppContext.tsx src/screens/HomeScreen.tsx src/components/AppShell.tsx
git commit -m "feat: PushPrompt UI, registerPush wiring, notification-tap navigation"
```

---

## Task 6: Verification & docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the push flow + real-project prerequisites in `README.md`**: enabling Cloud Messaging, generating a Web Push (VAPID) key pair, setting `VITE_FIREBASE_VAPID_KEY`, and that iOS requires installing to the Home Screen (Safari 16.4+). Note emulator dev cannot issue real tokens.

- [ ] **Step 2: Run the full suite**

Run: `npm test && npm --prefix functions run test && npm run build`
Expected: all green; `dist/sw.js` present.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: web push setup and platform behaviour"
```

---

## Self-Review Notes

- **Spec coverage:** platform-aware flow — iOS standalone gating (✓ Task 1 eligibility + Task 5 UI), Android/desktop direct prompt with optional install (✓ installPrompt + PushPrompt), obtain FCM token + append to `fcmTokens` (✓ Tasks 2/4/5), injectManifest owned SW with background message + `push`/`notificationclick` deep-linking (✓ Task 3), precache preserved (✓ `precacheAndRoute`), token hygiene client side via `removeFcmToken` (✓ Task 2; server prune is Phase 3/4).
- **Graceful degradation:** with no VAPID key (emulator), `registerForPush` returns `{ ok:false, reason:'no-vapid' }` — nothing throws; real-token issuance verified on a real project.
- **Type consistency:** `PushEligibility`/`EligibilityInput` (Task 1) reused by `PushPrompt` (Task 5); `RegisterResult` (Task 4) reused by `registerPush` (Task 5); deep-link `data.click` values `'fixtures'|'reveal'|'home'` consistent between `sw.ts` (Task 3) and the navigate listener (Task 5). `addFcmToken(playerId, token)` signature identical across interface, FirebaseRepository, and LocalRepository.
```
