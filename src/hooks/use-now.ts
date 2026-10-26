import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time that re-renders every `intervalMs` (and when the app returns to the foreground). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}
