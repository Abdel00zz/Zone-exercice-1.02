const LIGHT_INKS = new Set(['#ffffff', '#fff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1']);
const DARK_INKS = new Set(['#000000', '#000', '#0f172a', '#111827', '#1e293b']);

export const isLightInk = (color: string) => LIGHT_INKS.has(color.toLowerCase());

/** Keep saved ink unchanged while ensuring legibility on the chosen paper. */
export function screenInkColor(color: string, darkPaper: boolean): string {
  if (darkPaper && DARK_INKS.has(color.toLowerCase())) return '#f8fafc';
  if (!darkPaper && isLightInk(color)) return '#0f172a';
  return color;
}

export const printInkColor = (color: string) => isLightInk(color) ? '#0f172a' : color;
