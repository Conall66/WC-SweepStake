import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { flagEmoji } from '../domain/flags';
import type { Fixture } from '../domain/types';

const DAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

export function FixturesScreen() {
  const { fixtures, teams, assignments, currentPlayerId } = useApp();

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Map teamId → playerId for head-to-head detection.
  const ownerByTeam = useMemo(
    () => new Map(assignments.map((a) => [a.teamId, a.playerId])),
    [assignments],
  );

  const myTeamIds = useMemo(
    () => new Set(assignments.filter((a) => a.playerId === currentPlayerId).map((a) => a.teamId)),
    [assignments, currentPlayerId],
  );

  // Group fixtures by calendar date string.
  const byDate = useMemo(() => {
    const sorted = [...fixtures].sort((a, b) => a.kickoff - b.kickoff);
    const map = new Map<string, Fixture[]>();
    for (const fixture of sorted) {
      const key = new Date(fixture.kickoff).toDateString();
      const list = map.get(key) ?? [];
      list.push(fixture);
      map.set(key, list);
    }
    return map;
  }, [fixtures]);

  if (fixtures.length === 0) {
    return (
      <>
        <span className="eyebrow">Schedule</span>
        <h2 className="title">FIXTURES</h2>
        <p className="placeholder">
          Tournament fixtures load here. Run{' '}
          <span className="mono">npm run fetch:tournament</span> with an API-Sports key to populate.
        </p>
      </>
    );
  }

  return (
    <>
      <span className="eyebrow">Schedule · Group Stage</span>
      <h2 className="title">FIXTURES</h2>

      {[...byDate.entries()].map(([dateKey, dayFixtures]) => (
        <div key={dateKey} style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ color: 'var(--muted)', marginBottom: 8 }}>
            {DAY_FMT.format(new Date(dateKey))}
          </div>

          {dayFixtures.map((fixture) => {
            const home = teamById.get(fixture.homeTeamId);
            const away = teamById.get(fixture.awayTeamId);
            if (!home || !away) return null;

            const isMine = myTeamIds.has(fixture.homeTeamId) || myTeamIds.has(fixture.awayTeamId);
            const homeOwner = ownerByTeam.get(fixture.homeTeamId);
            const awayOwner = ownerByTeam.get(fixture.awayTeamId);
            const isH2H = homeOwner !== undefined && awayOwner !== undefined && homeOwner !== awayOwner;
            const played = fixture.homeScore !== null && fixture.awayScore !== null;

            return (
              <div
                key={fixture.id}
                className="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border, #222)',
                  opacity: played ? 0.75 : 1,
                  ...(isMine ? { borderLeft: '2px solid var(--gold)', paddingLeft: 10 } : {}),
                }}
              >
                {/* Home */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 20 }}>{flagEmoji(home.isoCode)}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: isMine && myTeamIds.has(fixture.homeTeamId) ? 700 : 400 }}>
                    {home.name.toUpperCase()}
                  </span>
                </div>

                {/* Score / time */}
                <div style={{ textAlign: 'center', minWidth: 52 }}>
                  {played ? (
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: isH2H ? 'var(--gold)' : 'inherit' }}>
                      {fixture.homeScore}–{fixture.awayScore}
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {TIME_FMT.format(new Date(fixture.kickoff)).replace(':00', '')}
                    </span>
                  )}
                  {isH2H && (
                    <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 2, letterSpacing: 1 }}>
                      H2H
                    </div>
                  )}
                </div>

                {/* Away */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: isMine && myTeamIds.has(fixture.awayTeamId) ? 700 : 400 }}>
                    {away.name.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 20 }}>{flagEmoji(away.isoCode)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <p className="sub" style={{ textAlign: 'center', marginTop: 24, fontSize: 10.5, color: 'var(--muted)' }}>
        Gold border = your team · H2H = two sweep players face off
      </p>
    </>
  );
}
