
import React, { useCallback, useEffect, useRef, useState } from 'react';

const SAVE_DELAY_MS = 220;
const MAX_BACKUP_CHARS = 750_000;
const QUOTA_WARNING_CHARS = 4_000_000; // ~4 Mo, avant d'approcher la limite typique (5-10 Mo) des navigateurs
const warnedKeys = new Set<string>(); // évite de ré-afficher l'alerte à chaque sauvegarde débouncée

function readStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') return initialValue;
  const candidates = [key, `${key}:backup`];
  for (const candidate of candidates) {
    try {
      const item = window.localStorage.getItem(candidate);
      if (item) return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Données locales invalides dans ${candidate}`, error);
    }
  }
  return initialValue;
}

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => readStoredValue(key, initialValue));
  const saveTimerRef = useRef<number | null>(null);
  const pendingSerializedRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    if (typeof window === 'undefined' || pendingSerializedRef.current === null) return;
    const serialized = pendingSerializedRef.current;
    pendingSerializedRef.current = null;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;

    try {
      const previous = window.localStorage.getItem(key);
      if (previous && previous !== serialized && previous.length <= MAX_BACKUP_CHARS) {
        window.localStorage.setItem(`${key}:backup`, previous);
      }
      window.localStorage.setItem(key, serialized);
      window.localStorage.setItem(`${key}:meta`, JSON.stringify({ version: 2, savedAt: Date.now(), size: serialized.length }));
      if (serialized.length > QUOTA_WARNING_CHARS && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        window.dispatchEvent(new CustomEvent('storage-quota-warning', { detail: { key, size: serialized.length } }));
      }
    } catch (error) {
      // En cas de quota faible, le brouillon principal reste prioritaire.
      try {
        window.localStorage.removeItem(`${key}:backup`);
        window.localStorage.setItem(key, serialized);
      } catch (retryError) {
        console.error('Sauvegarde locale impossible', retryError || error);
      }
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      pendingSerializedRef.current = JSON.stringify(
        storedValue,
        (propKey, value) => (propKey === 'imgElement' ? undefined : value),
      );
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
    } catch (error) {
      console.error('Sérialisation locale impossible', error);
    }
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [flush, storedValue]);

  // Synchronisation multi-onglets et sauvegarde immédiate si Android suspend la page.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      try {
        setStoredValue(JSON.parse(event.newValue) as T);
      } catch {
        /* L'onglet courant conserve sa dernière version valide. */
      }
    };
    const handlePageHide = () => flush();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      flush();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [flush, key]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
