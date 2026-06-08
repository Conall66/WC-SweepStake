// Core data model for the sweepstake. Kept free of any framework or storage
// concerns so it can be reasoned about and unit-tested in isolation.

export interface Team {
  /** Stable identifier, e.g. the FIFA three-letter code 'ESP'. */
  id: string;
  /** Display name, e.g. 'Spain'. */
  name: string;
  /** ISO-3166-1 alpha-2 code, e.g. 'es' — used to derive the flag emoji. */
  isoCode: string;
  /**
   * Position in the FIFA World Ranking at the deadline. 1 = strongest.
   * Only the relative order matters; gaps are fine.
   */
  fifaRank: number;
  /**
   * Optional override for matching this team to its shape on the world map,
   * where the map's country name differs from the team name
   * (e.g. 'United States of America', 'South Korea').
   */
  mapName?: string;
}

export interface Player {
  id: string;
  name: string;
  descriptor: string;
  /** URL to the player's photo (object URL in dev, storage URL in production). */
  photoUrl?: string;
  joinedAt: number; // epoch milliseconds
}

export interface Assignment {
  teamId: string;
  playerId: string;
  /** 1 = strongest band, ascending to the weakest. */
  bucket: number;
  /** When this team was revealed to its owner, or null if still hidden. */
  revealedAt: number | null;
  /** True when the reveal was triggered automatically before kick-off. */
  revealedAuto: boolean;
}

export interface DrawCommitment {
  /** Hex SHA-256 of the seed, published to everyone before the draw. */
  seedHash: string;
  /** The seed itself, published only after the draw so anyone can verify it. */
  seed: string | null;
  rankingSource: 'FIFA';
  createdAt: number;
}

export interface Fixture {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: number; // epoch milliseconds
  stage: string; // e.g. 'Group A', 'Round of 32'
  homeScore: number | null;
  awayScore: number | null;
}

export interface SweepConfig {
  /** Each player's stake in pence (500 = £5). The pot is informational only —
   *  no payments are processed or stored. */
  contributionPence: number;
}
