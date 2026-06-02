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
