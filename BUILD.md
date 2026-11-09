# Build Instructions

How to build, test and develop the `web-dropzone` monorepo: two published packages
(`@keenmate/web-dropzone-core` — the headless store; `@keenmate/web-dropzone` — the five custom
elements + CSS) and the examples site, which runs on the shared devkit
(`@keenmate/web-components-devkit`).

## Quick start

```bash
make setup            # npm install (root + workspaces)
make dev              # examples dev server on http://localhost:12500
make build            # build both packages (core first, then the renderer)
make test             # npm test — unit tests, then e2e
make doctor           # check the repo against the devkit + rulebook
make help             # every target
```

Or with npm directly:

```bash
npm install
npm run dev                 # root Vite (port from package.json#kmwc)
npm run build               # build:core + build:renderer
npm run build:core          # only @keenmate/web-dropzone-core
npm run build:renderer      # only @keenmate/web-dropzone (bundles core's dist/)
npm run build:examples      # static examples site → dist-examples/
npm run preview:examples    # serve it (http://localhost:12501)
npm run test:unit           # vitest (packages/web-dropzone/test/unit)
npm run test:e2e            # Playwright — chromium + firefox + webkit
npm run test:e2e:install    # install the three browsers
npm run doctor              # kmwc doctor
npm run check:pages         # load every example page at desktop / phone widths
```

There is no Windows `make.bat`; on Windows use Git Bash (`make`) or the npm scripts.

## What the builds produce

Each package builds into its own `dist/` with its own Vite (pinned to Vite 5 in the package's
`devDependencies`); the root runs Vite 7 for the examples site only — plain `vite build` at the root
is refused (`kmwc.library.shouldBuild: false`).

**`packages/web-dropzone-core/dist/`** — `core.js` (ES module), `core.umd.js`, `*.d.ts`.

**`packages/web-dropzone/dist/`** — `dropzone.js` (ES module), `dropzone.umd.js`, `style.css`,
`*.d.ts`. Everything is bundled in (`external: []`): `@keenmate/web-dropzone-core`,
`@keenmate/web-components-core` and, through core's `/positioning` subpath, `@floating-ui/dom`.
The renderer build also runs `check:contract` (the `--base-*` contract) and `analyze` (the Custom
Elements Manifest → `custom-elements.json`, `vscode.*-custom-data.json`, `web-types.json`).

## Project structure

```
packages/
├── web-dropzone-core/src/   ← DropzoneEngine, DropzoneController, types, labels, logger, …
└── web-dropzone/src/        ← <web-dropzone> + four satellites (core BlissElement), css/
index.html, examples-*.html  ← devkit fragment pages (the examples site)
test/*.html, e2e/*.spec.ts   ← Playwright fixtures + specs (fixtures import /src/index.ts)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the store + satellite topology and
[CLAUDE.md](./CLAUDE.md) for the per-file map.

## Testing a local build in another project

```bash
make package          # a .tgz in each package directory
make install-dev      # pack both and print the install snippets
```

Install the core tarball first, then the renderer.

## Debug logging

Every element logs through the `DROPZONE` bundle (categories `INIT`, `FILE`, `UI`, `INTERACTION`).
Warnings and errors print by default; turn on more from the console:

```js
window.components['web-dropzone'].logging.enableLogging();          // debug, every category
window.components['web-dropzone'].logging.setCategoryLevel('UI', 'debug');
window.components['web-dropzone'].logging.resetLogging();           // follow the page level again
window.components.logging.enableLogging('debug');                  // every KeenMate component
```

## Publishing

```bash
make publish-dry      # dry run of both packages (clean build first)
make publish          # both packages as 'latest' (core first; release versions only)
make publish-rc       # both packages under the 'rc' dist-tag
```

## Dependencies

### Runtime
- `@keenmate/web-components-core` — `BlissElement`, input converters, `registerComponent`, logging,
  `createCustomStyles`, `/positioning` (`createPopover`; it owns `@floating-ui/dom`, which dropzone
  never imports directly).
- `@keenmate/web-dropzone-core` (renderer only) — the headless store.

### Development
- `typescript`, `vite`, `vitest` (jsdom), `@playwright/test`, `rimraf`
- `@keenmate/web-components-devkit` — the examples-site kit, `kmwc` CLI (doctor, check-pages, sync)
