import { useApp } from '../state/AppContext';
import type { TabKey } from '../components/TabBar';

export function HomeScreen({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { players, currentPlayerId, setCurrentPlayer, potPence } = useApp();
  const pounds = (potPence / 100).toFixed(0);

  function handlePickPlayer(id: string) {
    setCurrentPlayer(id);
    onNavigate('reveal');
  }

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
          48 nations. 16 players. 3 teams each. Bragging rights until July 19th.
        </p>
      </div>

      <div className="card">
        <span className="eyebrow">How it works</span>
        <ol style={{ listStyle: 'none', marginTop: 10, display: 'grid', gap: 11 }}>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--grass)' }}>1</span>
            <span className="sub">
              Teams are ranked by FIFA and split into 3 equal bands — top seeds, contenders,
              and long shots. Everyone gets one from each band.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--grass)' }}>2</span>
            <span className="sub">
              Your 3 teams were assigned by a random draw. Tap your name below to reveal them —
              weakest first, best saved for last.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--grass)' }}>3</span>
            <span className="sub">
              Each player has put in £5. Pot: <strong>£{pounds}</strong>. Settled between
              players outside the app.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 11 }}>
            <span className="mono" style={{ color: 'var(--gold, #d4a017)' }}>★</span>
            <span className="sub">
              <strong>Bonus prize:</strong> 20% of the pot goes to whoever has all their teams
              knocked out first. Get eliminated early, get rewarded.
            </span>
          </li>
        </ol>
      </div>

      <div className="card">
        <span className="eyebrow">Tap your name to reveal your teams</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 12,
          }}
        >
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              className={`btn${player.id === currentPlayerId ? ' gold' : ' ghost'}`}
              style={{ fontSize: 13, padding: '10px 8px', textAlign: 'left' }}
              onClick={() => handlePickPlayer(player.id)}
            >
              <div style={{ fontWeight: 700 }}>{player.name}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{player.descriptor}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
