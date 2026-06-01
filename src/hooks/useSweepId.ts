import { useEffect, useState } from 'react';

export function useSweepId(): string | null {
  const [sweepId, setSweepId] = useState<string | null>(() => parseHash());

  useEffect(() => {
    const handler = () => setSweepId(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return sweepId;
}

function parseHash(): string | null {
  const raw = window.location.hash.slice(1).toLowerCase().trim();
  return /^[a-z0-9-]{2,24}$/.test(raw) ? raw : null;
}
