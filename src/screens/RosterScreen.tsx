import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { buildRoster } from '../domain/roster';
import { flagEmoji } from '../domain/flags';

export function RosterScreen() {
  const { teams, players, assignments, currentPlayerId } = useApp();

  const roster = useMemo(
    () => buildRoster(assignments, players, teams),
    [assignments, players, teams],
  );

  const anyRevealed = roster.some((entry) =>
    entry.teams.some(({ assignment }) => assignment.revealedAt !== null),
  );

  return (
    <>
      <span className="eyebrow gold">Everyone's draw</span>
      <h2 className="title">THE SQUADS</h2>

      {!anyRevealed && (
        <p className="placeholder" style={{ marginTop: 16 }}>
          Teams appear here once a player has finished their reveal.
        </p>
      )}

      {roster.map((entry) => {
        const allRevealed = entry.teams.every(({ assignment }) => assignment.revealedAt !== null);
        return (
          <div key={entry.player.id} style={{ marginBottom: 20 }}>
            <div
              className="mono sub"
              style={{
                fontSize: 11,
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                {entry.player.name}
                {entry.player.id === currentPlayerId ? ' · You' : ''}
              </span>
              <span style={{ opacity: 0.5 }}>{entry.player.descriptor}</span>
            </div>

            {allRevealed ? (
              entry.teams.map(({ team, assignment }) => (
                <div className="row" key={`${entry.player.id}-${team.id}`}>
                  <span className="fl">{flagEmoji(team.isoCode)}</span>
                  <span className="nm">{team.name}</span>
                  <span className="bk">B{assignment.bucket}</span>
                </div>
              ))
            ) : (
              <p
                className="placeholder"
                style={{ fontSize: 11, margin: '4px 0', opacity: 0.5 }}
              >
                Not revealed yet
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
