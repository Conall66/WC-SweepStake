// Global reset switch.
//
// There's no server: each device keeps its own reveal progress and chosen name
// in localStorage. Bumping this number changes the storage namespace, so on
// their next visit EVERY device reads fresh (empty) state — i.e. it resets the
// draw for everyone. To reset, increment STORAGE_GENERATION and redeploy.
//
// History:
//   1 — initial
//   2 — clear test reveals before going live
export const STORAGE_GENERATION = '2';
