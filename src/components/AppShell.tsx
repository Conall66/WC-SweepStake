import { useState } from 'react';
import { TabBar, type TabKey } from './TabBar';
import { DevPanel } from './DevPanel';
import { HomeScreen } from '../screens/HomeScreen';
import { RevealScreen } from '../screens/RevealScreen';
import { RosterScreen } from '../screens/RosterScreen';
import { useApp } from '../state/AppContext';

export function AppShell() {
  const [tab, setTab] = useState<TabKey>('home');
  const { loading } = useApp();

  if (loading) {
    return (
      <div className="app">
        <div className="screen">
          <p className="placeholder">Loading the sweep…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="screen">
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'reveal' && <RevealScreen />}
        {tab === 'roster' && <RosterScreen />}
      </main>
      <TabBar active={tab} onChange={setTab} />
      <DevPanel />
    </div>
  );
}
