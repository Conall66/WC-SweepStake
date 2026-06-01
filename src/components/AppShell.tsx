import { useState } from 'react';
import { TabBar, type TabKey } from './TabBar';
import { HomeScreen } from '../screens/HomeScreen';
import { SquadScreen } from '../screens/SquadScreen';
import { RevealScreen } from '../screens/RevealScreen';
import { FixturesScreen } from '../screens/FixturesScreen';
import { StatsScreen } from '../screens/StatsScreen';
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
        {tab === 'squad' && <SquadScreen />}
        {tab === 'reveal' && <RevealScreen />}
        {tab === 'fixtures' && <FixturesScreen />}
        {tab === 'stats' && <StatsScreen />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
