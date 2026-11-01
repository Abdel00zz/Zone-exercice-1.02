import { useCallback, useEffect, useRef, useState } from 'react';
import type { Worksheet } from '../types';
import { mergeCloudWorksheets, SyncRequestScope } from '../domain/worksheetSync';

export { mergeCloudWorksheets } from '../domain/worksheetSync';

export type SyncRole = 'source' | 'receiver';
export type CloudSyncStatus = 'disconnected' | 'idle' | 'syncing' | 'synced' | 'error';

interface SyncConfig {
  code: string;
  role: SyncRole;
}

const CONFIG_KEY = 'cloud_sync_config';
const PUSH_DEBOUNCE_MS = 2500;
const POLL_INTERVAL_MS = 5000;

function readConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === 'string' && (parsed.role === 'source' || parsed.role === 'receiver')) {
      return parsed;
    }
  } catch {
    // localStorage indisponible (mode privé, quota) : on retombe sur "pas de config".
  }
  return null;
}

function writeConfig(config: SyncConfig | null) {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // idem, non bloquant.
  }
}

export interface CloudSyncState {
  code: string;
  role: SyncRole | null;
  status: CloudSyncStatus;
  lastSyncAt: number | null;
  error: string | null;
  setCode: (code: string) => void;
  setRole: (role: SyncRole | null) => void;
  syncNow: () => void;
}

export function useCloudSync(
  worksheets: Worksheet[],
  setWorksheets: React.Dispatch<React.SetStateAction<Worksheet[]>>
): CloudSyncState {
  const [config, setConfig] = useState<SyncConfig | null>(() => readConfig());
  const [status, setStatus] = useState<CloudSyncStatus>('disconnected');
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);
  const requestScopeRef = useRef(new SyncRequestScope());
  const pushQueuedRef = useRef(false);
  const worksheetsRef = useRef(worksheets);
  worksheetsRef.current = worksheets;

  const setCode = useCallback((code: string) => {
    requestScopeRef.current.invalidate();
    pushQueuedRef.current = false;
    versionRef.current = 0;
    setStatus('idle');
    setError(null);
    setLastSyncAt(null);
    setConfig((prev) => {
      const next: SyncConfig = { code: code.trim().toUpperCase(), role: prev?.role ?? 'receiver' };
      writeConfig(next);
      return next;
    });
  }, []);

  const setRole = useCallback((role: SyncRole | null) => {
    requestScopeRef.current.invalidate();
    pushQueuedRef.current = false;
    versionRef.current = 0;
    setStatus(role ? 'idle' : 'disconnected');
    setError(null);
    setLastSyncAt(null);
    setConfig((prev) => {
      if (!role) {
        writeConfig(null);
        return null;
      }
      const next: SyncConfig = { code: prev?.code ?? '', role };
      writeConfig(next);
      return next;
    });
  }, []);

  const push = useCallback(async function pushSnapshot(): Promise<void> {
    if (!config || config.role !== 'source' || !config.code) return;
    const request = requestScopeRef.current.begin();
    if (!request) {
      pushQueuedRef.current = true;
      return;
    }
    setStatus('syncing');
    try {
      const { parseCloudWorksheets } = await import('../domain/worksheetSchema');
      if (!request.isCurrent()) return;
      const snapshot = parseCloudWorksheets(worksheetsRef.current);
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: config.code, worksheets: snapshot }),
        signal: request.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de synchronisation.');
      if (!Number.isSafeInteger(data.version) || data.version < 0) throw new Error('Version distante invalide.');
      if (!request.isCurrent()) return;
      versionRef.current = data.version;
      setLastSyncAt(Date.now());
      setStatus('synced');
      setError(null);
    } catch (e) {
      if (!request.isCurrent()) return;
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      request.finish();
      if (request.isCurrent() && pushQueuedRef.current) {
        pushQueuedRef.current = false;
        void pushSnapshot();
      }
    }
  }, [config]);

  const pull = useCallback(async () => {
    if (!config || config.role !== 'receiver' || !config.code) return;
    const request = requestScopeRef.current.begin();
    if (!request) return;
    setStatus('syncing');
    try {
      const res = await fetch(`/api/sync/pull?code=${encodeURIComponent(config.code)}&since=${versionRef.current}`, { signal: request.signal, cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de synchronisation.');
      if (!request.isCurrent()) return;
      if (!data.unchanged) {
        if (!Number.isSafeInteger(data.version) || data.version < 0) throw new Error('Version distante invalide.');
        const { parseCloudWorksheets } = await import('../domain/worksheetSchema');
        if (!request.isCurrent()) return;
        const remote = parseCloudWorksheets(data.worksheets);
        versionRef.current = data.version;
        setWorksheets((prev) => request.isCurrent() ? mergeCloudWorksheets(prev, remote) : prev);
      }
      setLastSyncAt(Date.now());
      setStatus('synced');
      setError(null);
    } catch (e) {
      if (!request.isCurrent()) return;
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      request.finish();
    }
  }, [config, setWorksheets]);

  useEffect(() => () => requestScopeRef.current.invalidate(), []);

  const syncNow = useCallback(() => {
    if (config?.role === 'source') push();
    else if (config?.role === 'receiver') pull();
  }, [config, push, pull]);

  // Rôle source : push debouncé à chaque changement des fiches.
  useEffect(() => {
    if (!config || config.role !== 'source' || !config.code) return;
    const timer = setTimeout(() => { push(); }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [worksheets, config, push]);

  // Rôle receiver : polling régulier, en pause quand l'onglet est masqué (économie de quota Upstash).
  useEffect(() => {
    if (!config || config.role !== 'receiver' || !config.code) return;
    let cancelled = false;
    const tick = () => { if (!cancelled && !document.hidden) pull(); };
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    const onVisibility = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [config, pull]);

  return {
    code: config?.code ?? '',
    role: config?.role ?? null,
    status: config ? status : 'disconnected',
    lastSyncAt,
    error,
    setCode,
    setRole,
    syncNow,
  };
}

export default useCloudSync;
