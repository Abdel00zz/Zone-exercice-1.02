import { useEffect } from 'react';

export function useScreenWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    let requesting = false;
    const request = async () => {
      if (requesting || cancelled || sentinel || document.visibilityState !== 'visible') return;
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) { await lock.release(); return; }
        sentinel = lock;
        lock.addEventListener('release', () => { if (sentinel === lock) sentinel = null; });
      } catch { /* The operating system can decline to keep the screen awake. */ }
      finally { requesting = false; }
    };
    void request();
    const onVisibilityChange = () => { void request(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
