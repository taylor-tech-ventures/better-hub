import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { UsageStats } from '@/shared/types/github-agent-state';
import { orpcClient } from '@/web/lib/orpc';

type UsageContextValue = {
  usage: UsageStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const UsageContext = createContext<UsageContextValue>({
  usage: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

const STALE_TIME_MS = 60_000;

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(async () => {
    if (Date.now() - lastFetchedAt.current < STALE_TIME_MS && usage) return;
    setLoading(true);
    setError(null);
    try {
      const stats = await orpcClient.usage.get();
      setUsage(stats);
      lastFetchedAt.current = Date.now();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load usage stats',
      );
    } finally {
      setLoading(false);
    }
  }, [usage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <UsageContext.Provider value={{ usage, loading, error, refresh }}>
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage(): UsageContextValue {
  return useContext(UsageContext);
}
