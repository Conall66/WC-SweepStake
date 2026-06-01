import { useState } from 'react';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

export function SweepPickerScreen() {
  const [name, setName] = useState('');

  const slug = slugify(name);
  const valid = slug.length >= 2;

  const enter = () => {
    if (valid) window.location.hash = slug;
  };

  return (
    <div className="app">
      <div className="screen">
        <span className="eyebrow">World Cup 2026</span>
        <h1 className="title">SWEEPSTAKE</h1>
        <p className="sub" style={{ marginTop: 8 }}>
          Enter a group name to create or rejoin your sweep.
        </p>

        <div className="card">
          <label className="field">
            Group name
            <input
              type="text"
              value={name}
              maxLength={30}
              autoFocus
              placeholder="e.g. Work, Family, The Lads…"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enter()}
            />
          </label>
          {slug && (
            <p className="sub" style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              #{slug}
            </p>
          )}
          <button type="button" className="btn" disabled={!valid} onClick={enter}>
            ENTER SWEEP →
          </button>
        </div>
      </div>
    </div>
  );
}
