export const MATHJAX_FONTS = [
  { value: 'mathjax-newcm', label: 'KaTeX / New Computer Modern (LaTeX Standard — Ultra-Net)' },
  { value: 'mathjax-modern', label: 'Latin Modern (Computer Modern Classique)' },
  { value: 'mathjax-tex', label: 'TeX Classique (KaTeX Vectoriel)' },
  { value: 'mathjax-stix2', label: 'STIX Two Math (Publication scientifique)' },
  { value: 'mathjax-euler', label: 'Neo Euler / AMS Euler (Académique)' },
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

/**
 * Indique si la police mathématique sélectionnée correspond à la famille
 * Computer Modern / TeX standard prise en charge nativement par le moteur
 * vectoriel synchrone KaTeX (qui produit un rendu PDF/impression ultra-net).
 */
export const isKatexPrimaryFont = (value: string | undefined): boolean => {
  const resolved = resolveMathJaxFont(value);
  return resolved === 'mathjax-newcm' || resolved === 'mathjax-modern' || resolved === 'mathjax-tex';
};
