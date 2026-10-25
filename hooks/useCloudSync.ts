import { useCallback, useEffect, useRef, useState } from 'react';
import type { Worksheet, WorksheetContent, Exercise, QuestionPart } from '../types';

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

// Ne conserve que les traits déjà dessinés localement (travail élève) ; tout le reste vient du contenu distant (auteur).
function mergeQuestion(localQ: QuestionPart | undefined, remoteQ: QuestionPart): QuestionPart {
  return {
    ...remoteQ,
    strokes: localQ?.strokes ?? remoteQ.strokes,
    subquestions: remoteQ.subquestions?.map((rq, i) => mergeQuestion(localQ?.subquestions?.[i], rq)),
  };
}

function mergeExercise(localEx: Exercise | undefined, remoteEx: Exercise): Exercise {
  return {
    ...remoteEx,
    statementStrokes: localEx?.statementStrokes ?? remoteEx.statementStrokes,
    questions: remoteEx.questions.map((rq, i) => mergeQuestion(localEx?.questions?.[i], rq)),
  };
}

function mergeContent(localContent: WorksheetContent | undefined, remoteContent: WorksheetContent): WorksheetContent {
  return {
    ...remoteContent,
    exercises: remoteContent.exercises.map((rEx) => mergeExercise(localContent?.exercises.find((e) => e.id === rEx.id), rEx)),
  };
}

/** Fusionne une liste de fiches reçue du cloud avec la liste locale, en préservant les traits déjà dessinés sur cet appareil. */
export function mergeCloudWorksheets(local: Worksheet[], remote: Worksheet[]): Worksheet[] {
  const localById = new Map(local.map((ws) => [ws.id, ws]));
  return remote.map((rws) => {
    const lws = localById.get(rws.id);
    return lws ? { ...rws, content: mergeContent(lws.content, rws.content) } : rws;
  });
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
  const worksheetsRef = useRef(worksheets);
  worksheetsRef.current = worksheets;

  const setCode = useCallback((code: string) => {
    setConfig((prev) => {
      const next: SyncConfig = { code: code.toUpperCase(), role: prev?.role ?? 'receiver' };
      writeConfig(next);
      return next;
    });
  }, []);

  const setRole = useCallback((role: SyncRole | null) => {
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

  const push = useCallback(async () => {
    if (!config || config.role !== 'source' || !config.code) return;
    setStatus('syncing');
    try {
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: config.code, worksheets: worksheetsRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de synchronisation.');
      versionRef.current = data.version;
      setLastSyncAt(Date.now());
      setStatus('synced');
      setError(null);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    }
  }, [config]);

  const pull = useCallback(async () => {
    if (!config || config.role !== 'receiver' || !config.code) return;
    setStatus('syncing');
    try {
      const res = await fetch(`/api/sync/pull?code=${config.code}&since=${versionRef.current}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de synchronisation.');
      if (!data.unchanged) {
        versionRef.current = data.version;
        setWorksheets((prev) => mergeCloudWorksheets(prev, data.worksheets));
      }
      setLastSyncAt(Date.now());
      setStatus('synced');
      setError(null);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    }
  }, [config, setWorksheets]);

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
