import { planDraw } from '../domain/draw';
import { useApp } from '../state/AppContext';
import { Countdown } from '../components/Countdown';
import type { TabKey } from '../components/TabBar';

const FAIRNESS_STEPS = [
  'Teams are ranked by the FIFA World Ranking — top seeds at the top, long shots at the bottom.',
  'Ranked into buckets, then dealt one-per-bucket so everyone gets a fair spread.',
  'A random seed is locked in before the draw — its fingerprint is published up front.',
  'After the draw the seed is revealed, so anyone can re-run it and check. No organiser bias.',
];

export function HomeScreen({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { config, teams, players, potPence, commitment } = useApp();
  if (!config) return null;

  const plan = players.length > 0 ? planDraw(teams, players.length) : null;
  const remainder = plan ? plan.unownedTeamIds.length : 0;
  const pounds = (potPence / 100).toFixed(0);
  const seedHashShort = commitment ? `${commitment.seedHash.slice(0, 4)}…${commitment.seedHash.slice(-4)}` : 'published at the draw';

  return (
    <>
      <div className="card" style={{ marginTop: 8 }}>
        <span className="eyebrow">Season 2026 · USA · CAN · MEX</span>
        <h1 className="word" style={{ marginTop: 10 }}>
          THE
          <br />
          SWEEP
        </h1>
        <p className="sub" style={{ marginTop: 9 }}>
          48 nations. One draw. Bragging rights until July 19th.
        </p>
        <Countdown deadline={config.joinDeadline} />
        <p className="sub mono" style={{ fontSize: 10.5, marginTop: 9 }}>
          ⏳ Joining closes Sun 7 June, 23:59
        </p>
      </div>

      <div className="stat-row">
        <div className="s">
          <div className="n">{players.length}</div>
          <div className="l">Players in</div>
        </div>
        <div className="s">
          <div className="n">{plan ? plan.bucketCount : '—'}</div>
          <div className="l">Teams each</div>
        </div>
        <div className="s">
          <div className="n">£{pounds}</div>
          <div className="l">In the pot</div>
        </div>
      </div>
      <p className="sub" style={{ textAlign: 'center', marginTop: 10, fontSize: 11 }}>
        £5 a head · pot settled between players <strong>outside the app</strong>
        {remainder > 0 ? ` · ${remainder} teams sit out as the remainder` : ''}
      </p>

      <div className="card">
        <span className="eyebrow">🎲 How the draw stays fair</span>
        <ol style={{ listStyle: 'none', marginTop: 10, display: 'grid', gap: 11 }}>
          {FAIRNESS_STEPS.map((step, index) => (
            <li key={step} style={{ display: 'flex', gap: 11 }}>
              <span className="mono" style={{ color: 'var(--grass)' }}>
                {index + 1}
              </span>
              <span className="sub">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mono" style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 12 }}>
          seed commitment → <span style={{ color: 'var(--grass)' }}>sha256: {seedHashShort}</span>
        </p>
      </div>

      <button type="button" className="btn" onClick={() => onNavigate('squad')}>
        JOIN THE SWEEP →
      </button>
      <button type="button" className="btn ghost" onClick={() => onNavigate('reveal')}>
        REVEAL MY TEAMS
      </button>
    </>
  );
}
