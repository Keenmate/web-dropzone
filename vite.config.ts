import { defineComponentConfig } from '@keenmate/web-components-devkit/vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import type { Plugin } from 'vite';

// Root config — the examples site only (dev server + `vite build --mode examples`).
// Ports, the kit, fragment pages and the static multi-page build come from
// package.json#kmwc (`library: false`: plain `vite build` refuses to run here).
// The two published packages build themselves (`npm run build` → each
// packages/*/vite.config.ts), so nothing below reaches their dist/.

const rendererPackageJson = JSON.parse(readFileSync('./packages/web-dropzone/package.json', 'utf-8'));
const corePackageJson = JSON.parse(readFileSync('./packages/web-dropzone-core/package.json', 'utf-8'));

// The renderer's index.ts stamps `window.components['web-dropzone']` with these.
// The preset defines them from the ROOT package.json (the private monorepo), so
// they're overridden with the renderer's own values — the same ones its package
// build injects (packages/web-dropzone/vite.config.ts).
const rendererDefines = {
  __VERSION__: JSON.stringify(rendererPackageJson.version),
  __PACKAGE_NAME__: JSON.stringify(rendererPackageJson.name),
  __AUTHOR__: JSON.stringify(rendererPackageJson.author ?? 'Keenmate'),
  __LICENSE__: JSON.stringify(rendererPackageJson.license ?? 'MIT'),
  __REPOSITORY__: JSON.stringify(rendererPackageJson.repository?.url ?? ''),
  __HOMEPAGE__: JSON.stringify(rendererPackageJson.homepage ?? ''),
  __CORE_VERSION__: JSON.stringify(corePackageJson.version),
  __CORE_PACKAGE_NAME__: JSON.stringify(corePackageJson.name),
};

// The renderer registers its satellite custom elements (<web-dropzone-picker>,
// -list, -progress, -indicator) as a side effect of index.ts importing their
// modules. The package's `sideEffects` allowlist only names the built dist/
// files, so building the examples FROM SOURCE makes Vite's resolver annotate
// those src modules as side-effect-free — and Rollup then tree-shakes the
// customElements.define() registrations away (satellites render empty, height 0).
// This plugin re-marks the renderer's own source modules as side-effectful.
// Leaves the published package's sideEffects field untouched.
function createRendererSideEffectsPlugin(): Plugin {
  // Vite normalizes module ids to forward slashes; so does the marker (Windows).
  const rendererSourcePath = resolve(__dirname, 'packages/web-dropzone/src').replace(/\\/g, '/') + '/';
  return {
    name: 'keep-renderer-side-effects',
    enforce: 'pre',
    async resolveId(source, importer, resolveConfig) {
      const resolved = await this.resolve(source, importer, { ...resolveConfig, skipSelf: true });
      if (resolved && resolved.id.replace(/\\/g, '/').startsWith(rendererSourcePath)) {
        return { ...resolved, moduleSideEffects: true };
      }
      return resolved;
    },
  };
}

export default defineComponentConfig({
  plugins: [createRendererSideEffectsPlugin()],
  overrides: {
    define: rendererDefines,
    resolve: {
      alias: {
        // The e2e fixtures (test/*.html) import `/src/index.ts`, the pre-monorepo
        // path of the renderer barrel. Example pages get the entry from
        // kmwc.library.entry (packages/web-dropzone/src/index.ts) — same module.
        '/src/index.ts': resolve(__dirname, 'packages/web-dropzone/src/index.ts'),
        // Core from its TS source, so edits in core/ hot-reload the renderer
        // (core's exports map would otherwise serve its built dist/core.js).
        '@keenmate/web-dropzone-core': resolve(__dirname, 'packages/web-dropzone-core/src/index.ts'),
      },
    },
    // Dev dep-scan only the real pages and the e2e fixtures — not test-results/ etc.
    optimizeDeps: { entries: ['index.html', 'examples-*.html', 'test/*.html'] },
  },
});
