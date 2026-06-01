import type { Team } from '../domain/types';

// Full 48-team 2026 World Cup field for local development.
// `fifaRank` here is an illustrative ordering, not the authoritative ranking —
// replace with the official snapshot via `npm run fetch:tournament`.
export const SAMPLE_TEAMS: Team[] = [
  // Pot 1 — top 12
  { id: 'ARG', name: 'Argentina',      isoCode: 'ar', fifaRank:  1 },
  { id: 'FRA', name: 'France',         isoCode: 'fr', fifaRank:  2 },
  { id: 'ESP', name: 'Spain',          isoCode: 'es', fifaRank:  3 },
  { id: 'ENG', name: 'England',        isoCode: 'gb', fifaRank:  4, mapName: 'United Kingdom' },
  { id: 'BRA', name: 'Brazil',         isoCode: 'br', fifaRank:  5 },
  { id: 'POR', name: 'Portugal',       isoCode: 'pt', fifaRank:  6 },
  { id: 'NED', name: 'Netherlands',    isoCode: 'nl', fifaRank:  7 },
  { id: 'BEL', name: 'Belgium',        isoCode: 'be', fifaRank:  8 },
  { id: 'GER', name: 'Germany',        isoCode: 'de', fifaRank:  9 },
  { id: 'ITA', name: 'Italy',          isoCode: 'it', fifaRank: 10 },
  { id: 'CRO', name: 'Croatia',        isoCode: 'hr', fifaRank: 11 },
  { id: 'URU', name: 'Uruguay',        isoCode: 'uy', fifaRank: 12 },

  // Pot 2 — ranks 13-24
  { id: 'COL', name: 'Colombia',       isoCode: 'co', fifaRank: 13 },
  { id: 'MAR', name: 'Morocco',        isoCode: 'ma', fifaRank: 14 },
  { id: 'USA', name: 'United States',  isoCode: 'us', fifaRank: 15, mapName: 'United States of America' },
  { id: 'MEX', name: 'Mexico',         isoCode: 'mx', fifaRank: 16 },
  { id: 'SUI', name: 'Switzerland',    isoCode: 'ch', fifaRank: 17 },
  { id: 'JPN', name: 'Japan',          isoCode: 'jp', fifaRank: 18 },
  { id: 'SEN', name: 'Senegal',        isoCode: 'sn', fifaRank: 19 },
  { id: 'KOR', name: 'South Korea',    isoCode: 'kr', fifaRank: 20, mapName: 'South Korea' },
  { id: 'ECU', name: 'Ecuador',        isoCode: 'ec', fifaRank: 21 },
  { id: 'DEN', name: 'Denmark',        isoCode: 'dk', fifaRank: 22 },
  { id: 'AUT', name: 'Austria',        isoCode: 'at', fifaRank: 23 },
  { id: 'TUR', name: 'Turkey',         isoCode: 'tr', fifaRank: 24 },

  // Pot 3 — ranks 25-36
  { id: 'NOR', name: 'Norway',         isoCode: 'no', fifaRank: 25 },
  { id: 'CAN', name: 'Canada',         isoCode: 'ca', fifaRank: 26 },
  { id: 'GHA', name: 'Ghana',          isoCode: 'gh', fifaRank: 27 },
  { id: 'IRN', name: 'Iran',           isoCode: 'ir', fifaRank: 28 },
  { id: 'SRB', name: 'Serbia',         isoCode: 'rs', fifaRank: 29 },
  { id: 'PAR', name: 'Paraguay',       isoCode: 'py', fifaRank: 30 },
  { id: 'CIV', name: 'Ivory Coast',    isoCode: 'ci', fifaRank: 31 },
  { id: 'EGY', name: 'Egypt',          isoCode: 'eg', fifaRank: 32 },
  { id: 'ALG', name: 'Algeria',        isoCode: 'dz', fifaRank: 33 },
  { id: 'NGA', name: 'Nigeria',        isoCode: 'ng', fifaRank: 34 },
  { id: 'POL', name: 'Poland',         isoCode: 'pl', fifaRank: 35 },
  { id: 'AUS', name: 'Australia',      isoCode: 'au', fifaRank: 36 },

  // Pot 4 — ranks 37-48
  { id: 'CZE', name: 'Czech Republic', isoCode: 'cz', fifaRank: 37, mapName: 'Czechia' },
  { id: 'CMR', name: 'Cameroon',       isoCode: 'cm', fifaRank: 38 },
  { id: 'SAU', name: 'Saudi Arabia',   isoCode: 'sa', fifaRank: 39 },
  { id: 'IRQ', name: 'Iraq',           isoCode: 'iq', fifaRank: 40 },
  { id: 'JOR', name: 'Jordan',         isoCode: 'jo', fifaRank: 41 },
  { id: 'HND', name: 'Honduras',       isoCode: 'hn', fifaRank: 42 },
  { id: 'CRC', name: 'Costa Rica',     isoCode: 'cr', fifaRank: 43 },
  { id: 'PAN', name: 'Panama',         isoCode: 'pa', fifaRank: 44 },
  { id: 'NZL', name: 'New Zealand',    isoCode: 'nz', fifaRank: 45 },
  { id: 'UZB', name: 'Uzbekistan',     isoCode: 'uz', fifaRank: 46 },
  { id: 'ZAF', name: 'South Africa',   isoCode: 'za', fifaRank: 47 },
  { id: 'VEN', name: 'Venezuela',      isoCode: 've', fifaRank: 48 },
];
