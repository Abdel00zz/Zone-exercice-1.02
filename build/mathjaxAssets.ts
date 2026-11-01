import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

/** Serve the pinned browser components from the app's own origin in dev,
 * production and Capacitor. No source trees, source maps or CHTML fonts ship. */
export function mathjaxAssets(): Plugin {
  const assets = new Map<string, Buffer>();
  const collect = (directory: string, url: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file, `${url}/${entry.name}`);
      else if (/\.(js|json)$/.test(entry.name)) assets.set(`${url}/${entry.name}`, readFileSync(file));
    }
  };
  return {
    name: 'worksheet-local-mathjax',
    configResolved() {
      const root = path.dirname(require.resolve('@mathjax/src/package.json'));
      const bundle = path.join(root, 'bundle');
      assets.set('/mathjax/tex-svg.js', readFileSync(path.join(bundle, 'tex-svg.js')));
      for (const directory of ['input', 'output', 'a11y', 'ui', 'sre']) {
        collect(path.join(bundle, directory), `/mathjax/${directory}`);
      }
      const font = path.dirname(require.resolve('@mathjax/mathjax-newcm-font/package.json'));
      assets.set('/mathjax/fonts/mathjax-newcm/svg.js', readFileSync(path.join(font, 'svg.js')));
      collect(path.join(font, 'svg'), '/mathjax/fonts/mathjax-newcm/svg');
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname;
        const content = assets.get(pathname);
        if (!content) return next();
        response.setHeader('Content-Type', pathname.endsWith('.json') ? 'application/json' : 'text/javascript');
        response.end(content);
      });
    },
    generateBundle: {
      order: 'pre',
      handler() {
        for (const [url, content] of assets) this.emitFile({ type: 'asset', fileName: url.slice(1), source: content });
      },
    },
  };
}
