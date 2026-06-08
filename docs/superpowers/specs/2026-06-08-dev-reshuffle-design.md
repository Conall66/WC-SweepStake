# Dev Reshuffle & Reveal Cleanup — Design

**Date:** 2026-06-08

Three changes to the static, no-backend sweep.

## Constraint

There is no shared server; reveal progress and any seed override live in each
device's `localStorage`. A dev-mode reshuffle therefore only changes the draw on
the device using it. To change the draw for **all** players, the chosen seed is
baked into `sweepData.ts` and redeployed. Workflow: preview locally → copy the
seed shown in dev mode → bake it in → deploy.

## 1. Remove the "others' teams" feed (RevealScreen)

While a player reveals their own teams, the pre-completion feed listing other
players' revealed teams is removed. Before completion: progress bar, map, and
reveal button only. After completion: the full roster stays (the Everyone tab
also covers it). Drop the now-unused `othersRevealed` memo and `teamById`.

## 2. Dev mode (owner reshuffle / reset), gated by `import.meta.env.DEV`

Present only under `npm run dev` locally — never on the deployed site.

- **Active seed** = `localStorage['sweep:devSeed:v1']` if set, else `DEFAULT_SEED`.
  Assignments are computed at runtime from the active seed, not a frozen const.
- A `DevPanel` (rendered in `AppShell` when the dev actions exist) offers:
  - **Reshuffle draw** — new random seed → store override → clear reveals.
  - **Reset reveals** — clear this device's reveals.
  - **Restore default draw** — remove the seed override.
  - Read-only display of the **active seed** (copy into code to make it live).

### Modules

- `sweepData.ts`: export `DEFAULT_SEED` and `computeAssignments(seed)`.
- `activeSeed.ts`: `getActiveSeed()`, `setSeedOverride()`, `clearSeedOverride()`,
  `generateSeed()`.
- `localRepository.ts`: compute assignments from `getActiveSeed()`; add
  `reshuffle()` and `restoreDefaultDraw()` (both clear reveals + notify);
  existing `reset()` stays as "reset reveals".
- `AppContext.tsx`: DEV-only `devReshuffle` / `devResetReveals` /
  `devRestoreDefault`, plus reactive `activeSeed` for display.

## 3. Reshuffle the live draw now

Bump `DEFAULT_SEED` to a new value, producing a fresh balanced draw for all 16
players, and redeploy. (The draw is structurally fair regardless of seed — one
team per FIFA band each — so this only changes which specific teams land where.)

## Testing

- `computeAssignments`: two different seeds yield different assignments; each
  result keeps 48 assignments, 3 per player across buckets 1/2/3.
- `activeSeed`: defaults to `DEFAULT_SEED`; returns the override when set; clears.
