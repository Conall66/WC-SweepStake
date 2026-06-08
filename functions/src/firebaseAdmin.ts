import { getApps, initializeApp } from 'firebase-admin/app';

/** Initialise the admin app exactly once (safe to call from every handler). */
export function ensureApp(): void {
  if (getApps().length === 0) initializeApp();
}
