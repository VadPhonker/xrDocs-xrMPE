import path from 'node:path';
import fs from 'node:fs/promises';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { generateContentData } from './scripts/content/generate-content-data.mjs';
import { defaultBasePath } from './src/shared/shared-utils.mjs';
import { debounce } from './src/shared/utils/debounce.ts';

const markdownWatchPattern = /[/\\]docs[/\\](?:ru|en)[/\\].+\.md$/i;

const docsAssetMimeTypes = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/**
 * Serves article assets colocated under docs/<lang>/…/assets/ during dev, so
 * relative `./assets/…` references resolve exactly like in production.
 */
function docsAssetsServePlugin(): Plugin {
  return {
    name: 'xr-docs-docs-assets-serve',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || '').split('?')[0];
        const match = urlPath.match(/^\/docs\/(ru|en)\/(.+)$/i);

        if (!match) {
          next();
          return;
        }

        // Only serve known image assets. Anything else (e.g. *.md raw-module
        // requests ending in ?import&raw) must reach Vite's transform pipeline.
        if (!docsAssetMimeTypes[path.extname(urlPath).toLowerCase()]) {
          next();
          return;
        }

        const segments = decodeURIComponent(match[2])
          .split('/')
          .filter((segment) => segment && segment !== '.' && segment !== '..');
        const docsRoot = path.resolve(server.config.root, 'docs');
        const filePath = segments.length
          ? path.resolve(docsRoot, match[1], ...segments)
          : '';

        if (!filePath.startsWith(docsRoot + path.sep)) {
          next();
          return;
        }

        fs.readFile(filePath)
          .then((data) => {
            res.statusCode = 200;
            res.setHeader(
              'Content-Type',
              docsAssetMimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            );
            res.setHeader('Cache-Control', 'no-cache');
            res.end(data);
          })
          .catch(() => next());
      });
    },
  };
}

function docsContentReloadPlugin(): Plugin {
  let server: ViteDevServer;
  let pendingFile = '';
  // Cache of known markdown module files — avoids scanning the entire module graph on every .md change
  const rawMarkdownModuleFiles = new Set<string>();

  const runGeneration = async (reason: string, shouldReload: boolean) => {
    try {
      const result = await generateContentData({ rootDir: server.config.root });
      invalidateGeneratedModules(server);
      invalidateRawMarkdownModules(server, pendingFile, rawMarkdownModuleFiles);

      if (shouldReload) {
        server.ws.send({ type: 'full-reload' });
      }

      server.config.logger.info(`[docs] Generated metadata for ${result.docs} documentation pages (${reason}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      server.config.logger.error(`[docs] Content generation failed (${reason}): ${message}`);
      server.ws.send({
        type: 'error',
        err: {
          message,
          stack,
        },
      });
    }
  };

  const debouncedGeneration = debounce((reason: string) => {
    void runGeneration(reason, true);
  }, 120);

  const scheduleGeneration = (reason: string, file: string) => {
    pendingFile = file;
    debouncedGeneration(reason);
  };

  return {
    name: 'xr-docs-content-reload',
    apply: 'serve',
    configureServer(nextServer) {
      server = nextServer;
      server.watcher.add([
        path.resolve(server.config.root, 'docs/ru'),
        path.resolve(server.config.root, 'docs/en'),
      ]);

      void runGeneration('dev server start', false);

      server.watcher.on('all', (event, file) => {
        if (!['add', 'change', 'unlink'].includes(event) || !markdownWatchPattern.test(file)) {
          return;
        }

        if (event === 'unlink') {
          rawMarkdownModuleFiles.delete(file);
        } else {
          rawMarkdownModuleFiles.add(file);
        }

        scheduleGeneration(event, file);
      });
    },
  };
}

function omitPublicCachePlugin(): Plugin {
  let outDir = '';

  return {
    name: 'xr-docs-omit-public-cache',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await fs.rm(path.join(outDir, '.asset-cache.json'), { force: true });
    },
  };
}

function invalidateGeneratedModules(server: ViteDevServer) {
  const generatedFiles = [
    path.resolve(server.config.root, 'src/generated/docs-manifest.json'),
    path.resolve(server.config.root, 'src/generated/theme-assets.json'),
    path.resolve(server.config.root, 'src/generated/heading-aliases.json'),
    path.resolve(server.config.root, 'public/search-index.json'),
    path.resolve(server.config.root, 'public/doc-content'),
  ];

  for (const file of generatedFiles) {
    invalidateFileModules(server, file);
  }
}

function invalidateRawMarkdownModules(server: ViteDevServer, changedFile: string, knownFiles: Set<string>) {
  if (changedFile) {
    invalidateFileModules(server, changedFile);
  }

  for (const file of knownFiles) {
    const modules = server.moduleGraph.getModulesByFile(file);
    if (!modules) continue;

    for (const module of modules) {
      if (module.id?.includes('?raw')) {
        server.moduleGraph.invalidateModule(module);
      }
    }
  }
}

function invalidateFileModules(server: ViteDevServer, file: string) {
  const modules = server.moduleGraph.getModulesByFile(path.resolve(file));

  if (!modules) {
    return;
  }

  for (const module of modules) {
    server.moduleGraph.invalidateModule(module);
  }
}

export default defineConfig(({ command, isPreview }) => ({
  // `vite preview` must serve dist under the same base the build stamped into
  // every HTML/asset URL. Without this the preview server answered at the root
  // while the pages requested /xrDocs-xrMPE/assets/* — the JS bundle 404'd and
  // the prerendered site rendered as a dead, non-interactive page.
  base: process.env.VITE_BASE_PATH || (command === 'build' || isPreview ? defaultBasePath : './'),
  plugins: [docsContentReloadPlugin(), docsAssetsServePlugin(), omitPublicCachePlugin()],
}));
