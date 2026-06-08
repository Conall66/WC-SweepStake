// Server-side mirror of the persistence shapes. Kept in sync by hand with the
// client's src/domain/types.ts + src/data/types.ts (functions deploy in
// isolation and cannot import from the web app's src tree).

export interface Player {
  id: string;
  name: string;
  descriptor: string;
  photoUrl?: string;
  joinedAt: number;
}

export interface StoredPlayer extends Player {
  authUid: string | null;
  fcmTokens: string[];
}
