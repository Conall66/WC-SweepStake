import type { Fixture } from '../domain/types';

function kick(dateStr: string, hour: number): number {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00Z`).getTime();
}

// 48 teams split into 12 groups of 4 (pot-balanced, one from each pot).
const GROUPS: Record<string, [string, string, string, string]> = {
  A: ['ARG', 'COL', 'NOR', 'CZE'],
  B: ['FRA', 'MAR', 'CAN', 'CMR'],
  C: ['ESP', 'USA', 'GHA', 'SAU'],
  D: ['ENG', 'MEX', 'IRN', 'IRQ'],
  E: ['BRA', 'SUI', 'SRB', 'JOR'],
  F: ['POR', 'JPN', 'PAR', 'HND'],
  G: ['NED', 'SEN', 'CIV', 'CRC'],
  H: ['BEL', 'KOR', 'EGY', 'PAN'],
  I: ['GER', 'ECU', 'ALG', 'NZL'],
  J: ['ITA', 'DEN', 'NGA', 'UZB'],
  K: ['CRO', 'AUT', 'POL', 'ZAF'],
  L: ['URU', 'TUR', 'AUS', 'VEN'],
};

// Two groups share each pair of dates so matches spread naturally across days.
const ROUND_DATES: Record<string, [string, string, string]> = {
  A: ['2026-06-12', '2026-06-17', '2026-06-22'],
  B: ['2026-06-12', '2026-06-17', '2026-06-22'],
  C: ['2026-06-13', '2026-06-18', '2026-06-23'],
  D: ['2026-06-13', '2026-06-18', '2026-06-23'],
  E: ['2026-06-14', '2026-06-19', '2026-06-24'],
  F: ['2026-06-14', '2026-06-19', '2026-06-24'],
  G: ['2026-06-15', '2026-06-20', '2026-06-25'],
  H: ['2026-06-15', '2026-06-20', '2026-06-25'],
  I: ['2026-06-16', '2026-06-21', '2026-06-26'],
  J: ['2026-06-16', '2026-06-21', '2026-06-26'],
  K: ['2026-06-17', '2026-06-22', '2026-06-27'],
  L: ['2026-06-17', '2026-06-22', '2026-06-27'],
};

// Round 1 results only — Rounds 2 & 3 are upcoming (scores stay null).
const PLAYED: Record<string, [number, number]> = {
  'ARG-COL': [2, 0], 'NOR-CZE': [1, 1],
  'FRA-MAR': [1, 0], 'CAN-CMR': [1, 2],
  'ESP-USA': [3, 0], 'GHA-SAU': [0, 1],
  'ENG-MEX': [2, 1], 'IRN-IRQ': [0, 0],
  'BRA-SUI': [3, 0], 'SRB-JOR': [2, 0],
  'POR-JPN': [2, 1], 'PAR-HND': [1, 0],
  'NED-SEN': [2, 0], 'CIV-CRC': [1, 0],
  'BEL-KOR': [0, 0], 'EGY-PAN': [2, 1],
  'GER-ECU': [1, 1], 'ALG-NZL': [3, 0],
  'ITA-DEN': [2, 1], 'NGA-UZB': [2, 0],
  'CRO-AUT': [1, 0], 'POL-ZAF': [1, 0],
  'URU-TUR': [2, 0], 'AUS-VEN': [0, 0],
};

// Round-robin pairs by team index within the group.
const ROUND_PAIRS: [[number, number], [number, number]][] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

export const SEED_FIXTURES: Fixture[] = Object.entries(GROUPS).flatMap(([group, teams]) =>
  ROUND_PAIRS.flatMap(([[h1, a1], [h2, a2]], roundIdx) => {
    const date = ROUND_DATES[group]![roundIdx]!;
    const homeA = teams[h1]!, awayA = teams[a1]!;
    const homeB = teams[h2]!, awayB = teams[a2]!;
    const scA = PLAYED[`${homeA}-${awayA}`] ?? null;
    const scB = PLAYED[`${homeB}-${awayB}`] ?? null;
    return [
      {
        id: `G${group}R${roundIdx + 1}a`,
        homeTeamId: homeA, awayTeamId: awayA,
        kickoff: kick(date, 17), stage: `Group ${group}`,
        homeScore: scA?.[0] ?? null, awayScore: scA?.[1] ?? null,
      },
      {
        id: `G${group}R${roundIdx + 1}b`,
        homeTeamId: homeB, awayTeamId: awayB,
        kickoff: kick(date, 20), stage: `Group ${group}`,
        homeScore: scB?.[0] ?? null, awayScore: scB?.[1] ?? null,
      },
    ];
  }),
);
