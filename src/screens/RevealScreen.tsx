import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { useReveal } from '../state/useReveal';
import { WorldMap } from '../components/WorldMap';
import { flagEmoji } from '../domain/flags';
import { buildRoster } from '../domain/roster';
import type { Team } from '../domain/types';

export function RevealScreen() {
  const { teams, players, assignments, currentPlayerId, revealTeams } = useApp();

  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const reveal = useReveal({
    assignments,
    teams,
    playerId: currentPlayerId,
    onReveal: revealTeams,
  });

  // Full roster (every player's complete squad, revealed or not). Built once
  // you've revealed all your own teams.
  const roster = useMemo(
    () => buildRoster(assignments, players, teams),
    [assignments, players, teams],
  );

  if (!currentPlayerId) {
    return (
      <>
        <span className="eyebrow gold">Your reveal</span>
        <h2 className="title">YOUR TEAMS</h2>
        <p className="placeholder">
          Tap your name on the Home tab to get started.
        </p>
      </>
    );
  }

  const litTeam = settledTeamName(reveal.settled?.team, reveal.litCountry);
  const wonTeam = reveal.settled ? reveal.settled.team.mapName ?? reveal.settled.team.name : null;
  const scoreboardName = reveal.spinning ? reveal.litCountry : reveal.settled?.team.name ?? 'Ready';

  const doneCount = reveal.cursor;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="eyebrow gold">Your reveal · self-paced</span>
          <h2 className="title">YOUR TEAMS</h2>
        </div>
        <span className="mono sub" style={{ fontSize: 11, textAlign: 'right' }}>
          {reveal.bucketLabel}
        </span>
      </div>

      <div className="progress">
        {reveal.steps.map((step, index) => {
          const state = index < doneCount ? 'done' : index === doneCount && !reveal.complete ? 'cur' : '';
          return <div key={step.assignment.teamId} className={`seg ${state}`} />;
        })}
      </div>

      <div className="map">
        <WorldMap litCountry={reveal.spinning ? reveal.litCountry : litTeam} wonCountry={wonTeam} />
      </div>

      <div className="scoreboard">
        <div>
          <div className="lab">Now revealing</div>
          <div className="val">{(scoreboardName ?? 'Ready').toUpperCase()}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="lab">For</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
            {currentPlayerId ? playerById.get(currentPlayerId)?.name ?? 'You' : 'You'}
          </div>
        </div>
      </div>

      {reveal.settled && (
        <div className="reveal-card">
          <span className="fl">{flagEmoji(reveal.settled.team.isoCode)}</span>
          <div>
            <div className="t">{reveal.settled.team.name.toUpperCase()}</div>
            <div className="d">yours · Bucket {reveal.settled.assignment.bucket}</div>
          </div>
        </div>
      )}

      {!reveal.complete ? (
        <button type="button" className="btn gold" disabled={reveal.spinning} onClick={reveal.spin}>
          {reveal.spinning ? 'REVEALING…' : `REVEAL NEXT TEAM (${doneCount + 1} OF ${reveal.steps.length})`}
        </button>
      ) : (
        <button type="button" className="btn gold" onClick={reveal.replay}>
          REVEAL AGAIN ↻
        </button>
      )}

      {reveal.complete && (
        <div className="feed">
          <span className="eyebrow" style={{ color: 'var(--muted)' }}>
            Full roster · everyone&apos;s teams
          </span>
          {roster.map((entry) => (
            <div key={entry.player.id} style={{ marginTop: 10 }}>
              <div className="mono sub" style={{ fontSize: 11, marginBottom: 4 }}>
                {entry.player.name}
                {entry.player.id === currentPlayerId ? ' · You' : ''}
              </div>
              {entry.teams.map(({ team, assignment }) => (
                <div className="row" key={`${entry.player.id}-${team.id}`}>
                  <span className="fl">{flagEmoji(team.isoCode)}</span>
                  <span className="nm">{team.name}</span>
                  <span className={`bk${assignment.revealedAuto ? ' auto' : ''}`}>
                    {assignment.revealedAuto ? 'auto' : `B${assignment.bucket}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function settledTeamName(team: Team | undefined, fallback: string | null): string | null {
  if (team) return team.mapName ?? team.name;
  return fallback;
}
