export const MATHJAX_FONTS = [
  { value: 'mathjax-newcm', label: 'New Computer Modern (LaTeX v4)' },
  { value: 'mathjax-euler', label: 'Neo Euler / AMS Euler (Académique)' },
  { value: 'mathjax-stix2', label: 'STIX Two Math (Publication scientifique)' },
  { value: 'mathjax-modern', label: 'Latin Modern (Computer Modern)' },
  { value: 'mathjax-tex', label: 'MathJax TeX classique' },
  { value: 'mathjax-fira', label: 'Fira Math (Sans Serif Modern)' },
  { value: 'mathjax-asana', label: 'Asana Math' },
  { value: 'mathjax-bonum', label: 'TeX Gyre Bonum' },
  { value: 'mathjax-dejavu', label: 'TeX Gyre DejaVu' },
  { value: 'mathjax-pagella', label: 'TeX Gyre Pagella' },
  { value: 'mathjax-schola', label: 'TeX Gyre Schola' },
  { value: 'mathjax-termes', label: 'TeX Gyre Termes' },
] as const;

export const DEFAULT_MATHJAX_FONT = 'mathjax-newcm';

export const resolveMathJaxFont = (value: string | undefined): string => (
  MATHJAX_FONTS.some((font) => font.value === value) ? value! : DEFAULT_MATHJAX_FONT
);
