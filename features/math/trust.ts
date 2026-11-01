import type { TrustContext } from 'katex';

/** Imported educational content can link to documents, but cannot inject CSS
 * or executable URL schemes through KaTeX's extended commands. */
export function allowMathCommand(context: TrustContext): boolean {
  return (context.command === '\\url' || context.command === '\\href')
    && ['https', 'http', 'mailto', '_relative'].includes(context.protocol?.toLowerCase() || '');
}
