import { blissAnalyzerConfig, cssVariablesFromManifestPlugin } from '@keenmate/web-components-core/cem';
import { customElementVsCodePlugin } from 'custom-element-vs-code-integration';
import { customElementJetBrainsPlugin } from 'custom-element-jet-brains-integration';
import { DEFAULT_CONFIG } from '@keenmate/web-dropzone-core';

/**
 * The input rows read their defaults from the engine package (`default:
 * DEFAULT_CONFIG.<key>` — one source, rulebook C-CA-37); the analyzer only
 * sees that source text, so this resolves it to the value (`'uniform'`, `7`,
 * `true`) for the manifest and the editor data generated from it. Needs the
 * built `@keenmate/web-dropzone-core` (the root `build` builds it first).
 */
function engineDefaultsPlugin() {
  const format = (value) => (typeof value === 'string' ? `'${value}'` : String(value));
  const resolve = (item) => {
    const match = typeof item?.default === 'string' && /^DEFAULT_CONFIG\.(\w+)$/.exec(item.default);
    if (!match) return;
    if (!(match[1] in DEFAULT_CONFIG)) throw new Error(`[engine-defaults] DEFAULT_CONFIG has no "${match[1]}"`);
    item.default = format(DEFAULT_CONFIG[match[1]]);
  };
  return {
    name: 'dropzone-engine-defaults',
    packageLinkPhase({ customElementsManifest }) {
      for (const mod of customElementsManifest.modules ?? []) {
        for (const decl of mod.declarations ?? []) {
          for (const item of [...(decl.members ?? []), ...(decl.attributes ?? [])]) resolve(item);
        }
      }
    },
  };
}

/**
 * Custom Elements Manifest for <web-dropzone> and its four satellites
 * (<web-dropzone-picker>, -list, -indicator, -progress).
 *
 * Core's `blissAnalyzerConfig()` wires `blissInputsPlugin()` first — it reads the
 * `static inputs` / `static events` tables (invisible to the stock analyzer) and
 * recognises `registerComponent()` as a definition — plus `stableOutputPlugin()`
 * (LF strings, modules sorted by path), so two runs in a row write identical
 * files. `cssVariablesFromManifestPlugin()` injects the `--dz-*` surface from
 * `component-variables.manifest.json` as `cssProperties`; the editor-integration
 * generators run after both and see the injected attributes + variables.
 */
export default blissAnalyzerConfig({
  globs: ['src/**/*.ts'],
  // exclude: core's default (tests + declarations); src/index.ts is analyzed — registerComponent() runs there.
  outdir: '.',
  plugins: [
    engineDefaultsPlugin(),
    cssVariablesFromManifestPlugin(),
    customElementVsCodePlugin({ outdir: '.' }),
    customElementJetBrainsPlugin({ outdir: '.', packageJson: false }),
  ],
});
