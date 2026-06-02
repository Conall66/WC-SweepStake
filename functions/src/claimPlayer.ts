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
