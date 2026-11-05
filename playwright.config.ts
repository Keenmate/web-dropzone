import { definePlaywrightConfig } from '@keenmate/web-components-devkit/playwright';

/**
 * Playwright config for end-to-end tests.
 *
 * Specs live in e2e/ and target dedicated fixture pages under test/*.html. The
 * fixture pages are intentionally separate from the examples-*.html pages so they
 * stay minimal and focused on the feature under test. baseURL and the
 * `npm run dev` web server come from package.json#kmwc.ports.dev (the devkit
 * preset), so the port can't drift from the Vite config or the Makefile.
 *
 * Commands:
 *   npm run test:e2e:install   # one-time: download chromium browser binary
 *   npm run test:e2e           # headless run
 *   npm run test:e2e:ui        # Playwright Test UI (debugging)
 *   npm run test:e2e:headed    # watch the browser do its thing
 */
export default definePlaywrightConfig();
