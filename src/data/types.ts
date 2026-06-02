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
