import { AppProvider } from './state/AppContext';
import { AppShell } from './components/AppShell';
import { useSweepId } from './hooks/useSweepId';
import { SweepPickerScreen } from './screens/SweepPickerScreen';

export function App() {
  const sweepId = useSweepId();

  if (!sweepId) return <SweepPickerScreen />;

  return (
    <AppProvider sweepId={sweepId}>
      <AppShell />
    </AppProvider>
  );
}
