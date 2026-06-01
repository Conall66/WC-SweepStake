import { useRef, useState, type ChangeEvent } from 'react';
import { planDraw } from '../domain/draw';
import { useApp } from '../state/AppContext';

export function SquadScreen() {
  const { teams, players, potPence, joinClosed, drawComplete, addPlayer, runDrawIfDue, resetSweep } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [descriptor, setDescriptor] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = players.length > 0 ? planDraw(teams, players.length) : null;
  const remainder = plan ? plan.unownedTeamIds.length : 0;
  const pounds = (potPence / 100).toFixed(0);

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setPhotoUrl(URL.createObjectURL(file)); // production: upload to storage
  };

  const submit = async () => {
    await addPlayer({
      name: name.trim() || 'New Player',
      descriptor: descriptor.trim() || 'The Newcomer',
      photoUrl,
    });
    setName('');
    setDescriptor('');
    setPhotoUrl(undefined);
    setShowForm(false);
  };

  return (
    <>
      <span className="eyebrow">The lobby</span>
      <h2 className="title">WHO&apos;S PLAYING</h2>
      <p className="sub" style={{ marginTop: 6 }}>
        {players.length} players in · {plan ? `${plan.bucketCount} teams each` : 'awaiting players'} · £{pounds} pot
        {remainder > 0 ? ` · ${remainder} teams unowned` : ''} · join before 7 June.
      </p>

      <div className="grid">
        {players.map((player) => (
          <div className="pcard" key={player.id}>
            <div
              className="av"
              style={player.photoUrl ? { backgroundImage: `url(${player.photoUrl})` } : undefined}
            >
              {player.photoUrl ? '' : player.name.charAt(0).toUpperCase()}
            </div>
            <div className="pn">{player.name}</div>
            <div className="pd">{player.descriptor}</div>
          </div>
        ))}
        {!joinClosed && (
          <button type="button" className="pcard add" onClick={() => setShowForm(true)}>
            <div style={{ fontSize: 22 }}>＋</div>
            <div>Add yourself</div>
          </button>
        )}
      </div>

      {showForm && !joinClosed && (
        <div className="card">
          <span className="eyebrow">Claim your spot</span>
          <label className="field">
            Your photo
            <div className="photo-pick" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="preview"
                style={photoUrl ? { backgroundImage: `url(${photoUrl})`, border: 'none' } : undefined}
                onClick={() => fileRef.current?.click()}
              >
                {photoUrl ? '' : '📷'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
              <span className="sub" style={{ fontSize: 11 }}>
                Add a photo from your camera roll (or snap one).
              </span>
            </div>
          </label>
          <label className="field">
            Your name
            <input type="text" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="e.g. Conall" />
          </label>
          <label className="field">
            Descriptor
            <input
              type="text"
              value={descriptor}
              maxLength={22}
              onChange={(e) => setDescriptor(e.target.value)}
              placeholder="e.g. The Statistician"
            />
          </label>
          <button type="button" className="btn" onClick={submit}>
            ADD ME · £5 →
          </button>
        </div>
      )}

      {joinClosed && !drawComplete && (
        <button type="button" className="btn gold" onClick={runDrawIfDue}>
          RUN THE DRAW
        </button>
      )}
      {import.meta.env.DEV && !joinClosed && !drawComplete && players.length > 0 && (
        <button type="button" className="btn ghost" onClick={runDrawIfDue}>
          DEV: Force draw preview →
        </button>
      )}
      {resetSweep && (
        <button
          type="button"
          className="btn ghost"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={resetSweep}
        >
          DEV: Reset sweep ✕
        </button>
      )}
      {joinClosed && (
        <p className="placeholder">Joining is closed. {drawComplete ? 'The draw is done — head to Reveal.' : ''}</p>
      )}
    </>
  );
}
