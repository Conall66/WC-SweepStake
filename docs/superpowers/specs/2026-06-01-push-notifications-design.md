# Push Notifications & Multi-User Backend — Design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)
**Author:** Conall + Claude

## Summary

Turn the sweepstake PWA from a single-device, `localStorage`-only app into a
multi-user app where each player installs the PWA on their own phone and
receives web push notifications. Notifications cover: joining-deadline reminders
(24h and 1h before), reveal-is-open, "your team plays soon" (with the opposing
player named), and match results for games involving a player's teams.

The backend is **Firebase** (Firestore + Cloud Functions + Cloud Messaging). A
single scheduled "tick" Cloud Function (Approach A) decides what to send on each
run and uses an idempotency ledger so it can run on a coarse (~10 min) schedule
without duplicating or missing notifications.

## Goals

- Each player installs the PWA on their own device and gets their own pushes.
- Five notification types fire reliably (see Notification Rules).
- Match kickoff/result data is ingested server-side from API-Sports within the
  free tier (100 requests/day).
- The existing UI, domain types, and provably-fair draw logic are preserved;
  this is primarily a new repository implementation + a notification engine.

## Non-Goals

- Live goal-by-goal alerts (final score + kickoff only).
- A generic multi-tournament product. The data model carries `sweepId` so
  multiple sweep groups can coexist, but this targets the 2026 World Cup.
- To-the-minute notification timing. ±~10 min is acceptable and messages are
  phrased loosely ("plays soon", "closes in about an hour") to hide it.
- Payments (the pot remains informational, as today).

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Usage model | Every player on their own phone (full multi-user) |
| Backend | Firebase (Firestore, Cloud Functions, FCM) |
| Joining | Single share link + claim-your-name, bound via Anonymous Auth |
| Match updates | Kickoff reminder + final score (no live goals) |
| Notification engine | Approach A — single scheduled polling tick |
| Draw write | Through a callable Cloud Function (rules stay locked) |

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────────────────┐
│  PWA on each phone  │         │              Firebase                 │
│  (existing React    │         │  ┌────────────┐   ┌─────────────────┐ │
│   app)              │ realtime│  │ Firestore  │   │ Cloud Functions │ │
│ FirebaseRepository ─┼─────────┼─▶│ shared      │◀──│  • tick (cron)  │ │
│  (new)              │  sync   │  │ sweep state │   │  • claimPlayer  │ │
│ FCM token register ─┼─────────┼─▶│             │   │  • commitDraw   │ │
│ Service worker      │◀────────┼── push (FCM) ──┘   └────────┬────────┘ │
│  (push handler)     │         │                            │ poll      │
└─────────────────────┘         └────────────────────────────┼──────────┘
                                                              ▼
                                                   ┌────────────────────┐
                                                   │  API-Sports (v3)    │
                                                   └────────────────────┘
```

Four pieces:

1. **`FirebaseRepository`** — new implementation of the existing
   `SweepRepository` interface, swapped in at `src/data/index.ts` behind an env
   flag. `subscribe()` is backed by Firestore realtime listeners. The UI is
   unchanged because it only talks to the interface.
2. **FCM registration (client)** — after a player claims their name in the
   installed PWA, request notification permission, obtain an FCM token, and
   store it on the player doc.
3. **`tick` Cloud Function** — scheduled ~every 10 min; evaluates notification
   rules, sends via FCM, records sends in an idempotency ledger.
4. **API-Sports polling** — performed inside `tick`, only when an owned-team
   fixture is live/recently kicked off, to stay within the free tier.

Firebase footprint stays minimal: one Firestore database, three Cloud Functions
(`tick`, `claimPlayer`, `commitDraw`), and FCM.

## Data Model (Firestore)

The domain types in `src/domain/types.ts` remain the source of truth. Stored
under `sweeps/{sweepId}`:

| Path | Holds | Notes |
|---|---|---|
| `config` (doc) | `SweepConfig` | `joinDeadline`, `contributionPence`. |
| `players/{playerId}` | `Player` + `authUid: string`, `fcmTokens: string[]` | `authUid` binds the claiming device; `fcmTokens` supports multiple devices per person. |
| `commitment` (doc) | `DrawCommitment` | Existence ⇒ draw done ⇒ reveal open. |
| `assignments/{teamId}` | `Assignment` | Owner + reveal state per team. |
| `fixtures/{fixtureId}` | `Fixture` | Seeded from API-Sports; scores updated by `tick`. |
| `sentNotifications/{key}` | `{ sentAt: number }` | Idempotency ledger; key encodes type + player + event. |

New fields beyond the current model: `authUid` and `fcmTokens` on `Player`, and
the `sentNotifications` collection. Everything else maps 1:1 onto existing
types.

## Notification Rules

On each `tick` run: load `config`, `players`, `assignments`, `fixtures`; for
each rule below, build the idempotency key, skip if it exists in
`sentNotifications`, otherwise send to every token in the target players'
`fcmTokens`, then record the key.

| # | Notification | Fires when | Target | Idempotency key |
|---|---|---|---|---|
| 1 | Deadline tomorrow | `now` within 24h-before window of `joinDeadline` | All players | `deadline-24h__{playerId}` |
| 2 | Deadline in ~1 hour | `now` within 1h-before window | All players | `deadline-1h__{playerId}` |
| 3 | Reveal is open | `commitment` doc exists | All players | `reveal-open__{playerId}` |
| 4 | Your team plays soon | a fixture with an owned team kicks off within ~next hour | owner(s) of both teams | `kickoff__{fixtureId}__{playerId}` |
| 5 | Result | a fixture with an owned team reaches a final score | owner(s) of both teams | `result__{fixtureId}__{playerId}` |

**Opponent resolution (#4 and #5):** for a fixture between team A and team B,
look up each team's owner via `assignments`. If both are owned, each owner's
message names the opposing player ("Your Spain play soon — you're up against
Dave"; "Spain 2–1 Brazil. You beat Dave 👑."). If the opposing team is unowned,
the message names only the team. This logic lives in a pure, unit-tested module.

**Loose phrasing:** time-relative messages avoid exact clock times so the ~10
min granularity is invisible.

**API-Sports polling (inside `tick`):** the API is called only when ≥1
owned-team fixture is in progress or recently kicked off (a short window after
`kickoff`). No live owned-team matches ⇒ no API call. Updated scores are written
back to `fixtures` docs, which drives #5 and live-updates everyone's Fixtures
screen. "Just kicked off" is derived from the `kickoff` timestamp; "final score"
from both scores being non-null and the API reporting a finished status. The
ledger guarantees coarse polling never duplicates or misses.

## Client Changes

- **`src/data/firebaseRepository.ts`** — implements `SweepRepository` against
  Firestore; realtime listeners back `subscribe()`. Swapped in at
  `src/data/index.ts` behind `VITE_USE_FIREBASE`, leaving `LocalRepository` for
  offline dev and tests.
- **Join + claim flow** — share link carries `sweepId`. On open, sign in with
  Firebase Anonymous Auth (silent), show the lobby, let the person claim/add
  their name. Claiming calls the `claimPlayer` callable, which writes `authUid`
  onto an unclaimed player doc (prevents hijacking claimed seats).
- **Push registration** — after a successful claim: (1) verify the app is
  running installed (`display-mode: standalone`); on iOS, show an "Add to Home
  Screen to get reminders" hint if in a Safari tab, since iOS web push requires
  the installed app; (2) request notification permission; (3) obtain the FCM
  token and append to `fcmTokens`.
- **Push service worker** — switch `vite-plugin-pwa` to `injectManifest` so we
  own the SW, and add FCM background message / `push` + `notificationclick`
  handlers (tap opens the relevant screen: Fixtures for results, Reveal for
  reveal-open). Existing precache/offline behavior is preserved.
- **Token hygiene** — refresh rotated tokens; the `tick` prunes tokens FCM
  reports as unregistered.

Screens and domain logic are unchanged.

## Server (Cloud Functions)

- **`tick`** — scheduled (~every 10 min). Evaluates notification rules, polls
  API-Sports as described, sends via FCM, maintains `sentNotifications`, prunes
  dead tokens.
- **`claimPlayer`** (callable) — binds the caller's `authUid` to an unclaimed
  player doc.
- **`commitDraw`** (callable) — receives the client-computed provably-fair draw
  result and writes `commitment` + `assignments`. The draw computation stays
  client-side (provably-fair, as today); only the write is server-mediated so
  client write rules stay locked.

**Rule-evaluation purity:** the "given state + `now` → notifications to send"
logic is a pure function, separate from the Firebase/FCM I/O shell, so it is
unit-testable with fake clocks and fixtures.

## Admin / Seeding

Adapt `scripts/fetch-tournament.mjs` to write teams + fixtures into Firestore
(`sweeps/{sweepId}/...`) instead of JSON. Run once before the tournament;
re-run if the schedule changes. Knockout fixtures with TBD teams are
score-updated later by the `tick`.

## Security Rules (Firestore)

- Any authenticated (anonymous) user may **read** sweep data — the lobby,
  fixtures, and the draw are visible by design (provably fair).
- A `players/{id}` doc's `authUid`/`fcmTokens` are writable only by the device
  whose auth UID matches; claiming is mediated by `claimPlayer` and only
  succeeds on an unclaimed seat.
- `assignments`, `commitment`, `config`, `fixtures` are **client-read-only**;
  only Cloud Functions (admin SDK) write them.

## Secrets

- `API_SPORTS_KEY` and FCM/VAPID server config live in Functions config/env,
  never in the client bundle.
- The web app ships only the public Firebase config and the public VAPID key.

## Testing

- **Domain logic** stays pure and unit-tested (existing `draw.test.ts`
  pattern). Opponent-resolution / result-phrasing is a pure tested module.
- **Tick rule evaluation** unit-tested as a pure function with fake clocks and
  fixtures; no Firebase needed.
- **`FirebaseRepository`** tested against the Firebase Emulator Suite
  (Firestore + Functions + Auth) — never touches production.
- **Idempotency** explicitly tested: run the tick twice over identical state,
  assert exactly one send per rule.

## Phasing (each phase independently shippable)

1. `FirebaseRepository` swap + Anonymous Auth + join/claim flow (`claimPlayer`).
2. Push registration + `injectManifest` service worker + FCM handlers.
3. `tick` with deadline (1, 2) and reveal-open (3) notifications.
4. Fixtures seeding + kickoff (4) and result (5) notifications + API-Sports
   polling + `commitDraw`.

## Open Questions

None outstanding at design time.

## iOS Constraints (reference)

- Web push for PWAs requires iOS 16.4+ **and** the app added to the Home Screen
  (not a Safari tab). The client detects standalone mode and guides install
  before prompting for permission.
- Installation is via Safari → Share → Add to Home Screen (the manifest is
  already configured for `display: standalone`).
