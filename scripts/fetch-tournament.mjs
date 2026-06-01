// One-off / scheduled admin script: pull the World Cup teams and fixtures from
// API-Sports and write them to JSON for the app to consume. Run with:
//   API_SPORTS_KEY=xxxx npm run fetch:tournament
//
// The free tier allows 100 requests/day (resets 00:00 UTC). This script makes
// only a few calls — confirm the World Cup is covered on your plan first.

import { writeFile } from 'node:fs/promises';

const KEY = process.env.API_SPORTS_KEY;
const BASE = 'https://v3.football.api-sports.io';
const LEAGUE = 1; // FIFA World Cup
const SEASON = 2026;

if (!KEY) {
  console.error('Set API_SPORTS_KEY in your environment first.');
  process.exit(1);
}

async function call(path) {
  const response = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': KEY } });
  const limit = response.headers.get('x-ratelimit-requests-limit');
  const remaining = response.headers.get('x-ratelimit-requests-remaining');
  console.log(`${path}  (quota ${remaining}/${limit} remaining today)`);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

async function main() {
  // 1. Confirm plan and remaining quota.
  await call('/status');

  // 2. Confirm coverage for the World Cup season.
  const league = await call(`/leagues?id=${LEAGUE}`);
  console.log('Coverage:', JSON.stringify(league.response?.[0]?.seasons?.at(-1)?.coverage ?? {}, null, 2));

  // 3. Teams — map into the app's Team shape (you must add fifaRank afterwards).
  const teamsResponse = await call(`/teams?league=${LEAGUE}&season=${SEASON}`);
  const teams = (teamsResponse.response ?? []).map((entry, index) => ({
    id: entry.team.code ?? String(entry.team.id),
    name: entry.team.name,
    isoCode: (entry.team.code ?? '').slice(0, 2).toLowerCase(),
    fifaRank: index + 1, // TODO: replace with the official FIFA ranking snapshot
  }));
  await writeFile('src/data/teams.json', JSON.stringify(teams, null, 2));
  console.log(`Wrote ${teams.length} teams to src/data/teams.json`);

  // 4. Fixtures — the whole tournament in one pull.
  const fixturesResponse = await call(`/fixtures?league=${LEAGUE}&season=${SEASON}`);
  await writeFile('src/data/fixtures.json', JSON.stringify(fixturesResponse.response ?? [], null, 2));
  console.log(`Wrote ${(fixturesResponse.response ?? []).length} fixtures to src/data/fixtures.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
