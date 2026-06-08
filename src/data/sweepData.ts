// Static, self-contained sweep: a fixed 16-player roster and a deterministic
// draw computed once at module load from a constant seed. No backend, no join
// flow — these assignments are the same for every device that opens the app.

import type { Player, Assignment } from '../domain/types';
import { SAMPLE_TEAMS } from './seedTeams';
import { runDraw } from '../domain/draw';

const SEED = 'worldcup2026';

export const PLAYERS: Player[] = [
  { id: 'conall-t',    name: 'Conall T',    descriptor: 'The Manager',           joinedAt: 1749340800000 },
  { id: 'charlotte-k', name: 'Charlotte K', descriptor: 'The Hottie',            joinedAt: 1749340800000 },
  { id: 'sam-b',       name: 'Sam B',       descriptor: 'The Stepover Merchant', joinedAt: 1749340800000 },
  { id: 'liam-d',      name: 'Liam D',      descriptor: 'The Pace Abuser',       joinedAt: 1749340800000 },
  { id: 'katie-a',     name: 'Katie A',     descriptor: 'The Brains',            joinedAt: 1749340800000 },
  { id: 'amelia-b',    name: 'Amelia B',    descriptor: 'The Two Left Feet',     joinedAt: 1749340800000 },
  { id: 'archie-w',    name: 'Archie W',    descriptor: 'The Double Agent',      joinedAt: 1749340800000 },
  { id: 'finn-m',      name: 'Finn M',      descriptor: 'The Own Goal',          joinedAt: 1749340800000 },
  { id: 'abi-w',       name: 'Abi W',       descriptor: 'The Bolognese',         joinedAt: 1749340800000 },
  { id: 'caitlin-b',   name: 'Caitlin B',   descriptor: 'The Bulldog',           joinedAt: 1749340800000 },
  { id: 'daisy-h',     name: 'Daisy H',     descriptor: 'The Southampton Fan',   joinedAt: 1749340800000 },
  { id: 'charlotte-b', name: 'Charlotte B', descriptor: 'The Fall-Off Artist',   joinedAt: 1749340800000 },
  { id: 'oscar-h',     name: 'Oscar H',     descriptor: 'The Scout',             joinedAt: 1749340800000 },
  { id: 'gracie-f',    name: 'Gracie F',    descriptor: 'The 90+5',              joinedAt: 1749340800000 },
  { id: 'caelan-e',    name: 'Caelan E',    descriptor: 'The Swollen CR7',       joinedAt: 1749340800000 },
  { id: 'tom-b',       name: 'Tom B',       descriptor: 'Big Daddy',             joinedAt: 1749340800000 },
];

export const BASE_ASSIGNMENTS: Assignment[] = runDraw(SAMPLE_TEAMS, PLAYERS, SEED);
