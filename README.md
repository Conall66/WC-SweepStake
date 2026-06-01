# The Sweep — World Cup 26

A matt-black, installable PWA for running a **provably-fair** 2026 FIFA World Cup
sweepstake. Players join a lobby, a single commit-reveal draw deals every team
fairly by FIFA ranking, and each player reveals their own teams at their own pace
over a real world map.

> **Status:** working foundation. The draw engine is complete and unit-tested,
> the app runs locally on an in-memory store, and the screens are wired up. The
> Firebase backend and live tournament data are clearly-marked next steps.
>
> ⚠️ This was scaffolded in an environment with no internet access, so it has
> **not** been `npm install`-ed, type-checked, or run here. Expect to fix the odd
> small thing on first run.

## Getting started

```bash
npm install
npm run dev        # local dev server (Vite)
npm test           # run the draw-engine unit tests (Vitest)
npm run build      # type-check + production build (emits the PWA)
npm run preview    # preview the production build, incl. the service worker
```

Open the dev URL on your phone (same network) or use “Add to Home Screen” from
the built/preview version to install it.

## How the draw works (and why it’s fair)

1. **Rank** — teams are ordered by the FIFA World Ranking (1 = strongest).
2. **Bucket** — they’re split into equal buckets of size *playerCount*. The number
   of buckets is `floor(48 / players)`, so each player gets one team per bucket.
   Any leftover teams (the remainder) are unowned — expected and fine.
3. **Commit** — a random seed is generated and only its SHA-256 hash is published
   *before* the draw.
4. **Deal** — within each bucket, teams are dealt to players via a seeded
   Fisher–Yates shuffle.
5. **Reveal** — after the draw the seed is published. Anyone can hash it to check
   it matches the commitment and re-run the draw to confirm the result. No
   organiser can bias it.

The whole engine lives in `src/domain/` as pure, dependency-free functions and is
covered by `src/domain/draw.test.ts`.

## Architecture

```
src/
  domain/     pure logic: types, PRNG, fairness (commit-reveal), the draw, flags
  data/       repository interface + a localStorage-backed dev implementation
  state/      React context (app state) and the reveal hook
  components/ app shell, tab bar, countdown, world map (real borders, d3-geo)
  screens/    Home, Squad, Reveal (wired) · Fixtures, Stats (placeholders)
scripts/      admin script to pull teams/fixtures from API-Sports
```

The UI only ever talks to the `SweepRepository` interface, so swapping the dev
store for Firebase is a one-line change in `src/data/index.ts`.

## What you need to supply

- **The real field** — run `API_SPORTS_KEY=xxxx npm run fetch:tournament` to pull
  the 48 teams and fixtures. It writes `src/data/teams.json` / `fixtures.json`.
  Then point the repository at `teams.json` instead of `seedTeams.ts`, and replace
  the placeholder `fifaRank` values with the official ranking snapshot taken
  nearest the join deadline. **Check first** that the World Cup (league id 1,
  season 2026) is covered on your API-Sports plan — the free tier is limited.
- **Firebase** (for a shared, multi-device sweep) — add your web config to `.env`
  (see `.env.example`) and add a `FirebaseRepository` implementing
  `SweepRepository` (Firestore for state, Cloud Functions to run the draw once
  server-side after the deadline, FCM for the auto-reveal notifications).
- **App icons** — placeholder matt-black icons are in `public/icons`; replace with
  final art when you have it.

## Notes on the current dev build

- State persists to `localStorage` so a refresh keeps the lobby and draw. “You”
  are the most recently added player — real auth replaces this.
- The draw is triggered from the Squad screen once joining closes; in production
  this runs once, server-side, after the deadline.
- The reveal map’s country geometry is **bundled** (`world-atlas`), so it renders
  offline — no runtime CDN fetch.
- Auto-reveal (opening a player’s teams ~30 min before their first match if they
  haven’t) is implemented in the engine (`pendingAutoReveals`) and needs a
  scheduled trigger once the backend and fixtures are in place.
