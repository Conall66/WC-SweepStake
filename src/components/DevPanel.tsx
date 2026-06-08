// Owner-only dev controls. Rendered only when the DEV-gated actions exist (i.e.
// under `npm run dev`) — never on the deployed site. Reshuffle/reset affect THIS
// device only; to make a draw live for everyone, copy the active seed shown here
// into DEFAULT_SEED in src/data/sweepData.ts and redeploy.

import { useState } from 'react';
import { useApp } from '../state/AppContext';

export function DevPanel() {
  const { activeSeed, devReshuffle, devResetReveals, devRestoreDefault } = useApp();
  const [open, setOpen] = useState(false);

  // Absent in production builds — the dev actions are undefined there.
  if (!devReshuffle || !devResetReveals || !devRestoreDefault) return null;

  const panel: React.CSSProperties = {
    position: 'fixed',
    top: 8,
    right: 8,
    zIndex: 9999,
    background: 'rgba(10,11,10,0.92)',
    border: '1px solid var(--grass, #2e7d32)',
    borderRadius: 10,
    padding: open ? 12 : '6px 10px',
    maxWidth: 260,
    backdropFilter: 'blur(4px)',
  };

  if (!open) {
    return (
      <div style={panel}>
        <button
          type="button"
          className="mono"
          style={{ background: 'none', border: 0, color: 'var(--grass)', cursor: 'pointer', fontSize: 11 }}
          onClick={() => setOpen(true)}
        >
          DEV ⚙
        </button>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow gold" style={{ fontSize: 10 }}>Dev mode</span>
        <button
          type="button"
          className="mono"
          style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>

      <p className="mono sub" style={{ fontSize: 10, margin: '8px 0 4px' }}>active seed</p>
      <code
        style={{
          display: 'block',
          fontSize: 11,
          wordBreak: 'break-all',
          color: 'var(--grass)',
          marginBottom: 10,
        }}
      >
        {activeSeed}
      </code>

      <div style={{ display: 'grid', gap: 6 }}>
        <button type="button" className="btn gold" style={{ fontSize: 12, padding: '8px' }} onClick={devReshuffle}>
          🎲 Reshuffle draw
        </button>
        <button type="button" className="btn ghost" style={{ fontSize: 12, padding: '8px' }} onClick={devResetReveals}>
          Reset reveals (this device)
        </button>
        <button type="button" className="btn ghost" style={{ fontSize: 12, padding: '8px' }} onClick={devRestoreDefault}>
          Restore default draw
        </button>
      </div>

      <p className="mono sub" style={{ fontSize: 9.5, marginTop: 10, opacity: 0.6 }}>
        Local only. To go live for everyone, set DEFAULT_SEED to the seed above and redeploy.
      </p>
    </div>
  );
}
