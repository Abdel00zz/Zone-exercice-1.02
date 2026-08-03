/**
 * Coordination entre les instances de DrawingCanvas d'une même fiche.
 *
 * Une fiche affiche un canvas par question : sur une fiche de 2 exercices on en
 * compte déjà 10. Ce module tient deux rôles :
 *   - désigner le canvas ACTIF (dernier touché), seul destinataire des raccourcis
 *     clavier et des actions de la barre d'outils flottante (annuler, effacer…) ;
 *   - exposer un registre d'actions pour que la barre unique, montée une seule
 *     fois au niveau de la fiche, puisse piloter n'importe quelle zone.
 */

import { useSyncExternalStore } from 'react';

// ── Registre des canvas ─────────────────────────────────────────────────────

/** Ce qu'un canvas expose à la barre d'outils. */
export interface CanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  /** Ouvre le sélecteur de fichier de CE canvas : l'image atterrit dans sa zone. */
  importImage: () => void;
  setBackgroundStyle: (style: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank') => void;
  setBackgroundColor: (color: 'black' | 'green' | 'blue' | 'white' | 'cream' | '') => void;
  snapshot: CanvasSnapshot;
}

/** État d'un canvas dont dépend l'affichage de la barre (boutons grisés, fond actif). */
export interface CanvasSnapshot {
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  styleName?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  colorName?: 'black' | 'green' | 'blue' | 'white' | 'cream' | '';
  canChangeBackground: boolean;
}

const EMPTY_SNAPSHOT: CanvasSnapshot = {
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  canChangeBackground: false,
};

type HandleAccessor = () => CanvasHandle;

const canvases = new Map<string, HandleAccessor>();
const lastSnapshots = new Map<string, CanvasSnapshot>();

let activeCanvasId: string | null = null;
let version = 0;

const activeListeners = new Set<() => void>();

const notify = () => {
  version += 1;
  activeListeners.forEach(listener => listener());
};

const sameSnapshot = (a: CanvasSnapshot | undefined, b: CanvasSnapshot): boolean =>
  !!a
  && a.canUndo === b.canUndo
  && a.canRedo === b.canRedo
  && a.hasSelection === b.hasSelection
  && a.styleName === b.styleName
  && a.colorName === b.colorName
  && a.canChangeBackground === b.canChangeBackground;

/**
 * Inscrit un canvas. `accessor` est relu à chaque appel pour toujours viser les
 * fermetures courantes du composant, sans réinscription à chaque rendu.
 */
export const registerCanvas = (id: string, accessor: HandleAccessor): (() => void) => {
  canvases.set(id, accessor);
  // Sans ce repli, la barre resterait inerte tant que l'utilisateur n'a touché
  // aucune zone : les actions n'auraient aucune cible au premier affichage.
  if (activeCanvasId === null) activeCanvasId = id;
  notify();

  return () => {
    canvases.delete(id);
    lastSnapshots.delete(id);
    if (activeCanvasId === id) {
      activeCanvasId = canvases.keys().next().value ?? null;
    }
    notify();
  };
};

/**
 * Signale que l'état d'un canvas a peut-être changé. Appelée à chaque rendu du
 * canvas : la comparaison évite de réveiller la barre pour rien.
 */
export const notifyCanvasChanged = (id: string): void => {
  const accessor = canvases.get(id);
  if (!accessor) return;
  const snapshot = accessor().snapshot;
  if (sameSnapshot(lastSnapshots.get(id), snapshot)) return;
  lastSnapshots.set(id, snapshot);
  if (id === activeCanvasId) notify();
};

// ── Canvas actif ────────────────────────────────────────────────────────────
// Dernier canvas touché par l'utilisateur : seul celui-ci réagit aux raccourcis
// et aux actions de la barre.

export const setActiveCanvas = (id: string) => {
  if (activeCanvasId === id) return;
  activeCanvasId = id;
  notify();
};

export const isActiveCanvas = (id: string) => activeCanvasId === id;

export const getActiveCanvasId = () => activeCanvasId;

export const clearActiveCanvas = (id: string) => {
  if (activeCanvasId !== id) return;
  activeCanvasId = canvases.size > 0 ? (canvases.keys().next().value ?? null) : null;
  notify();
};

/** Exécute une action sur le canvas actif, s'il y en a un. */
export const withActiveCanvas = (action: (handle: CanvasHandle) => void): void => {
  if (!activeCanvasId) return;
  const accessor = canvases.get(activeCanvasId);
  if (accessor) action(accessor());
};

/** Exécute une action sur toutes les zones de la fiche. */
export const withEveryCanvas = (action: (handle: CanvasHandle) => void): void => {
  canvases.forEach(accessor => action(accessor()));
};

export const getActiveSnapshot = (): CanvasSnapshot => {
  if (!activeCanvasId) return EMPTY_SNAPSHOT;
  const accessor = canvases.get(activeCanvasId);
  return accessor ? accessor().snapshot : EMPTY_SNAPSHOT;
};

export const getCanvasCount = () => canvases.size;

const subscribeActive = (listener: () => void): (() => void) => {
  activeListeners.add(listener);
  return () => { activeListeners.delete(listener); };
};

const getVersion = () => version;

/**
 * Renvoie l'état du canvas actif et re-rend l'appelant à chaque changement.
 * Le compteur de version sert de valeur souscrite (stable), l'instantané est
 * relu au rendu : `useSyncExternalStore` n'accepte pas d'objet recréé à la volée.
 */
export const useActiveCanvasSnapshot = (): CanvasSnapshot => {
  useSyncExternalStore(subscribeActive, getVersion, getVersion);
  return getActiveSnapshot();
};

/** Réactualise une zone lorsqu'elle devient (ou cesse d'être) la cible des outils. */
export const useCanvasIsActive = (id: string): boolean => {
  useSyncExternalStore(subscribeActive, getVersion, getVersion);
  return isActiveCanvas(id);
};

/** Vrai si la frappe vise un champ de saisie : les raccourcis doivent alors être ignorés. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
};
