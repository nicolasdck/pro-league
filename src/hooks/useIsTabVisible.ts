import { useEffect, useState } from 'react';

// Shared by the live-score polling hooks — an idle background tab shouldn't
// keep hitting the API every 30s.
export function useIsTabVisible(): boolean {
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const onChange = () => setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return isVisible;
}
