import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { flagEmoji } from '../domain/flags';

interface TeamResult {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function computeTeamResults(
  fixtures: ReturnType<typeof useApp>['fixtures'],
): Map<string, TeamResult> {
  const map = new Map<string, TeamResult>();
  const get = (id: string): TeamResult =>
    map.get(id) ?? { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

  for (const f of fixtures) {
    if (f.homeScore === null || f.awayScore === null) continue;
    const h = get(f.homeTeamId);
    const a = get(f.awayTeamId);
    h.played += 1; h.goalsFor += f.homeScore; h.goalsAgainst += f.awayScore;
    a.played += 1; a.goalsFor += f.awayScore; a.goalsAgainst += f.homeScore;
    if (f.homeScore > f.awayScore) { h.won += 1; h.points += 3; a.lost += 1; }
    else if (f.homeScore === f.awayScore) { h.drawn += 1; h.points += 1; a.drawn += 1; a.points += 1; }
    else { a.won += 1; a.points += 3; h.lost += 1; }
    map.set(f.homeTeamId, h);
    map.set(f.awayTeamId, a);
  }
  return map;
}

export function StatsScreen() {
  const { fixtures, teams, assignments, players, drawComplete } = useApp();

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const teamResults = useMemo(() => computeTeamResults(fixtures), [fixtures]);

  const leaderboard = useMemo(() => {
    if (!drawComplete) return [];
    return players
      .map((player) => {
        const myAssignments = assignments.filter((a) => a.playerId === player.id);
        const points = myAssignments.reduce((sum, a) => sum + (teamResults.get(a.teamId)?.points ?? 0), 0);
        const gf = myAssignments.reduce((sum, a) => sum + (teamResults.get(a.teamId)?.goalsFor ?? 0), 0);
        return { player, myAssignments, points, gf };
      })
      .sort((a, b) => b.points - a.points || b.gf - a.gf);
  }, [drawComplete, players, assignments, teamResults]);

  const playedCount = useMemo(
    () => fixtures.filter((f) => f.homeScore !== null).length,
    [fixtures],
  );

  if (!drawComplete) {
    return (
      <>
        <span className="eyebrow">Standings</span>
        <h2 className="title">THE TABLE</h2>
        <p className="placeholder">Leaderboard appears once the draw is complete.</p>
      </>
    );
  }

  return (
    <>
      <span className="eyebrow">Standings · Group Stage</span>
      <h2 className="title">THE TABLE</h2>

      {/* Leaderboard */}
      <div style={{ marginTop: 16 }}>
        {leaderboard.map(({ player, myAssignments, points, gf }, rank) => (
          <div
            key={player.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr auto',
              alignItems: 'start',
              gap: 10,
              padding: '12px 0',
              borderBottom: '1px solid var(--border, #222)',
            }}
          >
            <span className="mono" style={{ fontSize: 13, color: rank === 0 ? 'var(--gold)' : 'var(--muted)', paddingTop: 2 }}>
              {rank + 1}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{player.name}</div>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {myAssignments
                  .slice()
                  .sort((a, b) => a.bucket - b.bucket)
                  .map((a) => {
                    const team = teamById.get(a.teamId);
                    const res = teamResults.get(a.teamId);
                    if (!team) return null;
                    return (
                      <span
                        key={a.teamId}
                        className="mono"
                        style={{
                          fontSize: 10,
                          padding: '2px 5px',
                          borderRadius: 3,
                          background: (res?.points ?? 0) > 0 ? 'var(--gold, #c9a84c22)' : 'var(--surface-2, #1a1a1a)',
                          color: (res?.points ?? 0) > 0 ? 'var(--gold, #c9a84c)' : 'var(--muted)',
                          whiteSpace: 'nowrap',
                        }}
                        title={res ? `P${res.played} W${res.won} D${res.drawn} L${res.lost}` : 'No results yet'}
                      >
                        {flagEmoji(team.isoCode)} {res?.points ?? 0}pt
                      </span>
                    );
                  })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: rank === 0 ? 'var(--gold)' : 'inherit' }}>
                {points}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{gf} GF</div>
            </div>
          </div>
        ))}
      </div>

      {/* Dev data validation panel */}
      {import.meta.env.DEV && (
        <details style={{ marginTop: 28 }}>
          <summary className="mono" style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>
            DEV · data validation ({playedCount}/{fixtures.length} fixtures played)
          </summary>
          <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
            {[...teamResults.entries()]
              .sort((a, b) => b[1].points - a[1].points)
              .map(([teamId, res]) => {
                const team = teamById.get(teamId);
                if (!team) return null;
                return (
                  <div key={teamId} className="mono" style={{ fontSize: 10, display: 'flex', gap: 8, color: 'var(--muted)' }}>
                    <span>{flagEmoji(team.isoCode)} {team.id}</span>
                    <span>P{res.played} W{res.won} D{res.drawn} L{res.lost}</span>
                    <span>{res.goalsFor}:{res.goalsAgainst}</span>
                    <span style={{ color: res.points > 0 ? 'var(--gold)' : 'inherit' }}>{res.points}pt</span>
                  </div>
                );
              })}
          </div>
        </details>
      )}

      <p className="sub" style={{ textAlign: 'center', marginTop: 20, fontSize: 10.5, color: 'var(--muted)' }}>
        Points · tiebreak by goals scored · {playedCount} results in
      </p>
    </>
  );
}
