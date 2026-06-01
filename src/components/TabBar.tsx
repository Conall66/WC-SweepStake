import type { ReactNode } from 'react';

export type TabKey = 'home' | 'squad' | 'reveal' | 'fixtures' | 'stats';

const ICONS: Record<TabKey, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  squad: (
    <svg viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0112 0" />
      <path d="M16 6a3 3 0 010 6" />
      <path d="M21 20a5 5 0 00-4-5" />
    </svg>
  ),
  reveal: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  fixtures: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
};

const LABELS: Record<TabKey, string> = {
  home: 'Home',
  squad: 'Squad',
  reveal: 'Reveal',
  fixtures: 'Fixtures',
  stats: 'Stats',
};

const ORDER: TabKey[] = ['home', 'squad', 'reveal', 'fixtures', 'stats'];

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
