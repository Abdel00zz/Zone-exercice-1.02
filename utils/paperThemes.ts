import type { PaperTheme } from '../types';

export const PAPER_THEME_OPTIONS: ReadonlyArray<{ value: PaperTheme; label: string }> = [
  { value: 'classic', label: 'Classique (Beige clair)' },
  { value: 'white', label: 'Blanc pur (Impression)' },
  { value: 'dark', label: 'Sombre (Contraste élevé)' },
  { value: 'amber', label: 'Jaune (Page de livre ancienne)' },
  { value: 'rose', label: 'Rose doux (Aide dyslexie/visuelle)' },
  { value: 'slate', label: 'Gris ardoise clair' },
];

const PAPER_THEME_IDS = new Set<PaperTheme>(PAPER_THEME_OPTIONS.map(({ value }) => value));

export const isPaperTheme = (value: unknown): value is PaperTheme => (
  typeof value === 'string' && PAPER_THEME_IDS.has(value as PaperTheme)
);

/** Protège le rendu contre les anciennes fiches contenant `paperTheme: ""`. */
export const resolvePaperTheme = (value: unknown, fallback: PaperTheme = 'classic'): PaperTheme => (
  isPaperTheme(value) ? value : fallback
);
