import type { ReactNode } from 'react';

export type TabKey = 'home' | 'reveal' | 'roster';

const ICONS: Record<TabKey, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  reveal: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  roster: (
    <svg viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
};

const LABELS: Record<TabKey, string> = {
  home: 'Home',
  reveal: 'Reveal',
  roster: 'Everyone',
};

const ORDER: TabKey[] = ['home', 'reveal', 'roster'];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="tabbar">
      {ORDER.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`tab${tab === active ? ' active' : ''}`}
          onClick={() => onChange(tab)}
          aria-current={tab === active}
        >
          {ICONS[tab]}
          <span className="lab">{LABELS[tab]}</span>
        </button>
      ))}
    </nav>
  );
}
