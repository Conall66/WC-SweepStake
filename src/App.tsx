import { AppProvider } from './state/AppContext';
import { AppShell } from './components/AppShell';

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
