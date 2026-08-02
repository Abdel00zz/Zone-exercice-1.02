/**
 * État d'outils partagé par TOUS les canvas de la fiche.
 *
 * Auparavant chaque `DrawingCanvas` possédait son propre état (outil, couleur,
 * épaisseur…) et sa propre barre d'outils : sur une fiche de deux exercices,
 * l'utilisateur devait donc re-sélectionner son stylo dix fois. Le store ci-dessous
 * centralise ces réglages ; une seule barre flottante les pilote et toutes les
 * zones de réponse les appliquent.
 *
 * C'est un store externe (pas un contexte React) volontairement : les valeurs sont
 * lues au moment des événements pointeur via `getToolState()`, sans re-rendre les
 * dizaines de canvas montés. Les rares champs qui influencent le rendu d'un canvas
 * sont souscrits individuellement avec `useToolValue`.
 */

import { useRef, useSyncExternalStore } from 'react';
import type {
  ToolType, PenType, HighlighterType, EraserType, ShapeType,
  LineStyle, SelectionMode, PressureCurve,
} from './types';

export type ToolMenu = 'pen' | 'highlighter' | 'eraser' | 'shape' | 'lasso' | 'more' | null;
export type RailSide = 'left' | 'right';

export interface CanvasToolState {
  // Outil courant
  tool: ToolType;
  penType: PenType;
  highlighterType: HighlighterType;
  eraserType: EraserType;
  shapeType: ShapeType;
  lineStyle: LineStyle;
  selectionMode: SelectionMode;

  // Couleurs et épaisseurs
  color: string;
  highlighterColor: string;
  lineWidth: number;
  highlighterWidth: number;
  eraserWidth: number;
  highlighterOpacity: number;

  // Options de tracé
  straightenLines: boolean;
  highlighterStraightLines: boolean;
  includePartialSelection: boolean;
  alignWithShapes: boolean;
  palmRejection: boolean;
  pressureCurve: PressureCurve;
  penStabilization: number;
  shapeRecognition: boolean;
  snapGrid: boolean;
  angleSnap: boolean;
  angleStep: 15 | 30 | 45;
  regularShapes: boolean;
  showMeasurements: boolean;
  eraserHighlighterOnly: boolean;
  eraserAutoSize: boolean;

  // Barre flottante
  openMenu: ToolMenu;
  railCollapsed: boolean;
  railSide: RailSide;
  railTop: number | null;
  applyBackgroundToAll: boolean;
}

const STORAGE_KEY = 'exercise-canvas-tools-v2';
/** Ancienne clé de préférences par canvas : lue une dernière fois pour ne rien perdre. */
const LEGACY_KEY = 'exercise-canvas-prefs-v1';

const DEFAULTS: CanvasToolState = {
  tool: 'pen',
  penType: 'ballpoint',
  highlighterType: 'chisel',
  eraserType: 'stroke',
  shapeType: 'line',
  lineStyle: 'solid',
  selectionMode: 'lasso',

  color: '#0f172a',
  highlighterColor: '#fde047',
  lineWidth: 4,
  highlighterWidth: 18,
  eraserWidth: 30,
  highlighterOpacity: 0.45,

  straightenLines: false,
  highlighterStraightLines: false,
  includePartialSelection: true,
  alignWithShapes: true,
  palmRejection: true,
  pressureCurve: 'balanced',
  penStabilization: 0.35,
  shapeRecognition: true,
  snapGrid: false,
  angleSnap: false,
  angleStep: 15,
  regularShapes: false,
  showMeasurements: true,
  eraserHighlighterOnly: false,
  eraserAutoSize: false,

  openMenu: null,
  railCollapsed: false,
  railSide: 'left',
  railTop: null,
  applyBackgroundToAll: false,
};

/** Champs volatils : les réafficher au rechargement n'aurait pas de sens. */
const TRANSIENT_KEYS: Array<keyof CanvasToolState> = ['openMenu'];

const readJson = (key: string): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const loadInitialState = (): CanvasToolState => {
  const saved = { ...readJson(LEGACY_KEY), ...readJson(STORAGE_KEY) };
  const next = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as Array<keyof CanvasToolState>).forEach((key) => {
    if (TRANSIENT_KEYS.includes(key)) return;
    const value = saved[key as string];
    if (value === undefined || value === null) return;
    if (typeof value === typeof DEFAULTS[key] || DEFAULTS[key] === null) {
      (next as Record<string, unknown>)[key] = value;
    }
  });
  return next;
};

let state: CanvasToolState = loadInitialState();
const listeners = new Set<() => void>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Écriture différée : un glissement de curseur d'épaisseur émet des dizaines de
 * mises à jour par seconde, et `localStorage.setItem` est synchrone.
 */
const schedulePersist = () => {
  if (typeof window === 'undefined') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const persisted: Record<string, unknown> = {};
      (Object.keys(state) as Array<keyof CanvasToolState>).forEach((key) => {
        if (!TRANSIENT_KEYS.includes(key)) persisted[key] = state[key];
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      /* Les réglages restent valables pour la session courante. */
    }
  }, 400);
};

export const getToolState = (): CanvasToolState => state;

export const subscribeTools = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Applique un patch ; ne notifie que si au moins une valeur change réellement. */
export const setToolState = (patch: Partial<CanvasToolState>): void => {
  let changed = false;
  for (const key of Object.keys(patch) as Array<keyof CanvasToolState>) {
    if (state[key] !== patch[key]) { changed = true; break; }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
  schedulePersist();
};

/** Ferme le panneau ouvert (appelé dès qu'on repose le stylet sur une zone). */
export const closeToolMenu = () => setToolState({ openMenu: null });

/** Souscription à l'état complet : réservée à la barre d'outils elle-même. */
export const useToolState = (): CanvasToolState =>
  useSyncExternalStore(subscribeTools, getToolState, getToolState);

/**
 * Souscription à une valeur unique. À réserver aux valeurs primitives : la
 * comparaison faite par React est une égalité de référence.
 */
export const useToolValue = <T,>(selector: (snapshot: CanvasToolState) => T): T => {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const read = () => selectorRef.current(state);
  return useSyncExternalStore(subscribeTools, read, read);
};
