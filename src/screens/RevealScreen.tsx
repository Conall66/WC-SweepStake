import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { useReveal } from '../state/useReveal';
import { WorldMap } from '../components/WorldMap';
import { flagEmoji } from '../domain/flags';
import type { Team } from '../domain/types';

export function RevealScreen() {
  const { teams, players, assignments, currentPlayerId, revealTeams, drawComplete } = useApp();

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const reveal = useReveal({
    assignments,
    teams,
    playerId: currentPlayerId,
    onReveal: revealTeams,
  });

  // Everyone else's revealed picks, most recent first.
  const othersRevealed = useMemo(
    () =>
      assignments
        .filter((a) => a.revealedAt !== null && a.playerId !== currentPlayerId)
        .sort((a, b) => (b.revealedAt ?? 0) - (a.revealedAt ?? 0)),
    [assignments, currentPlayerId],
  );

  if (!drawComplete) {
    return (
      <>
        <span className="eyebrow gold">Your reveal</span>
        <h2 className="title">YOUR TEAMS</h2>
        <p className="placeholder">
          The draw hasn&apos;t run yet. Once joining closes on 7 June and the draw is made, your teams
          appear here to reveal — weakest bucket first.
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

      <div className="notice">
        <span>⏱</span>
        <p>
          Haven&apos;t opened your teams before your first match? No problem — we&apos;ll{' '}
          <strong>reveal them automatically</strong> so you&apos;re never behind on results.
        </p>
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
        <button type="button" className="btn gold" disabled>
          ALL YOUR TEAMS REVEALED ✓
        </button>
      )}

      <div className="feed">
        <span className="eyebrow" style={{ color: 'var(--muted)' }}>
          Others&apos; teams · as they reveal
        </span>
        {othersRevealed.length === 0 && <p className="placeholder">No one else has revealed yet.</p>}
        {othersRevealed.map((assignment) => {
          const team = teamById.get(assignment.teamId);
          const player = playerById.get(assignment.playerId);
          if (!team) return null;
          return (
            <div className="row" key={`${assignment.playerId}-${assignment.teamId}`}>
              <span className="fl">{flagEmoji(team.isoCode)}</span>
              <span className="nm">
                {team.name} <em>· {player?.name ?? 'Player'}</em>
              </span>
              <span className={`bk${assignment.revealedAuto ? ' auto' : ''}`}>
                {assignment.revealedAuto ? 'auto' : `B${assignment.bucket}`}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function settledTeamName(team: Team | undefined, fallback: string | null): string | null {
  if (team) return team.mapName ?? team.name;
  return fallback;
}
