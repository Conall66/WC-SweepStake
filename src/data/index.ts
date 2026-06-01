// Single place to choose the backend. Swap to a FirebaseRepository here once it
// exists; the rest of the app is unaffected.

import type { SweepRepository } from './repository';
import { LocalRepository } from './localRepository';

export function createRepository(sweepId: string): SweepRepository {
  return new LocalRepository(sweepId);
}
