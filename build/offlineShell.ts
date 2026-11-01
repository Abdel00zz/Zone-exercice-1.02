import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Precache exactly the local files shipped with this build, including lazy chunks. */
export function offlineShell(): Plugin {
  let projectRoot = '';
  let publicDir = '';
  return {
    name: 'worksheet-offline-shell',
    apply: 'build',
    configResolved(config) {
      projectRoot = config.root;
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files = new Map<string, string | Uint8Array>();
      for (const item of Object.values(bundle)) {
        if (item.fileName.endsWith('.map')) continue;
        files.set(`/${item.fileName}`, item.type === 'chunk' ? item.code : item.source);
      }
      const collectPublicFiles = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) collectPublicFiles(file);
          else if (entry.isFile() && file !== path.join(publicDir, 'sw.js')) {
            files.set(`/${path.relative(publicDir, file).split(path.sep).join('/')}`, readFileSync(file));
          }
        }
      };
      if (publicDir) collectPublicFiles(publicDir);
      const template = readFileSync(path.join(projectRoot, 'public/sw.js'), 'utf8');
      const fingerprint = createHash('sha256').update(template)
        .update(readFileSync(path.join(projectRoot, 'index.html')));
      for (const [name, content] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        fingerprint.update(name).update(content);
      }
      const assets = [...files.keys()].filter((file) => file !== '/index.html').sort();
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__BUILD_ID__', fingerprint.digest('hex').slice(0, 20))
          .replace('/* __PRECACHE_ASSETS__ */ []', JSON.stringify(assets)),
      });
    },
  };
}
