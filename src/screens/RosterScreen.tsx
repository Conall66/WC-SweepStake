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

  return (
    <>
      <span className="eyebrow gold">Everyone's draw</span>
      <h2 className="title">THE SQUADS</h2>

      {roster.map((entry) => {
        const isYou = entry.player.id === currentPlayerId;
        const allRevealed = entry.teams.every(({ assignment }) => assignment.revealedAt !== null);
        // Everyone else's teams are always visible. Your own stay hidden until
        // you've revealed them, so the Reveal tab keeps its surprise.
        const hideOwn = isYou && !allRevealed;
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
                {isYou ? ' · You' : ''}
              </span>
              <span style={{ opacity: 0.5 }}>{entry.player.descriptor}</span>
            </div>

            {hideOwn ? (
              <p
                className="placeholder"
                style={{ fontSize: 11, margin: '4px 0', opacity: 0.6 }}
              >
                Reveal your teams on the Reveal tab to see them here.
              </p>
            ) : (
              entry.teams.map(({ team, assignment }) => (
                <div className="row" key={`${entry.player.id}-${team.id}`}>
                  <span className="fl">{flagEmoji(team.isoCode)}</span>
                  <span className="nm">{team.name}</span>
                  <span className="bk">B{assignment.bucket}</span>
                </div>
              ))
            )}
          </div>
        );
      })}
    </>
  );
}
