# Sweepstake Access Control & Reveal — Design

**Date:** 2026-06-07
**Branch:** feat/push-notifications
**Scope:** Client-side only, against `LocalRepository`. No Firebase auth wired into the running app yet.

## Goal

Enforce four rules in the running (local) client:

1. A person can add **only one** name to the sweepstake.
2. A person can reveal **only their own** set of teams.
3. A person can **re-reveal** their own teams.
4. After revealing all their own teams, a person can see **every other player's full squad** (teams they have / will have).

## Current State

- `AppContext` derives "you" with a dev heuristic: the most recently added player (`players[length-1]`).
- `useReveal` is already keyed on `currentPlayerId`, so reveal is already scoped to your own teams.
- `RevealScreen` locks after completion (disabled "ALL YOUR TEAMS REVEALED ✓") — no re-reveal.
- The "others" feed shows only teams others have **already revealed**.
- `SquadScreen` allows unlimited `addPlayer` calls.
- A Firebase `claimPlayer` callable (binds `authUid` to one seat) is scaffolded but not wired into the running client. Out of scope here.

## Design

### 1. One seat per person (identity)

Persist a **my seat id** in `localStorage` under `sweep:me:v1:<sweepId>`.

- `AppContext` reads the key on load and sets `currentPlayerId` from it, replacing the `players[length-1]` heuristic.
- If the stored id no longer matches any player, treat as not joined (clear it).
- `addPlayer` writes the newly created player's id to the seat key; that becomes "you".
- New derived flag: `hasJoined = currentPlayerId != null && players.some(p => p.id === currentPlayerId)`.
- DEV `resetSweep` clears the seat key alongside the repository reset.

**SquadScreen:**
- When `hasJoined`, hide the "Add yourself" card and the join form.
- Mark your own player card with a "You" badge.
- When not joined, behave as today (show add card/form).

### 2. Reveal only your own teams

Already enforced via `useReveal({ playerId: currentPlayerId })`. No code change; covered by a confirming test.

### 3. Re-reveal (replay the animation)

Add `replay()` to `useReveal`:
- Resets `cursor → 0`, `settled → null`, clears in-flight timers.
- Reveal remains idempotent (`revealedAt ?? now`), so replaying never alters stored timestamps or `revealedAuto`.

**RevealScreen:**
- Once `complete`, replace the disabled "ALL YOUR TEAMS REVEALED ✓" button with an active **"REVEAL AGAIN ↻"** that calls `replay()`.

### 4. Full roster after your reveal

Gate on `reveal.complete` (all your own teams revealed):

- Before complete: keep the current live "others as they reveal" feed.
- After complete: render a **full roster** — each player grouped with their complete set of teams (revealed or not), including yourself. Derived from `assignments` joined to `players` and `teams`; no new data or persistence.

## Testing

- **Seat persistence:** add a player → reload → same `currentPlayerId`; a second add is not offered while joined.
- **Reveal scope:** `useReveal` steps contain only the current player's assignments.
- **Replay:** `replay()` resets cursor to 0 and does not change any `revealedAt`/`revealedAuto` already stored.
- **Roster grouping:** roster groups all assignments by player and includes unrevealed teams once gated open.

## Out of Scope

- Firebase Auth / `claimPlayer` wiring into the running client.
- Editing or removing a seat after joining.
- Server-side enforcement (the local rule is per-device).
