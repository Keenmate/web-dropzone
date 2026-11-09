import { definePlaywrightConfig, devices } from '@keenmate/web-components-devkit/playwright';

/**
 * Playwright config for end-to-end tests.
 *
 * Specs live in e2e/ and target dedicated fixture pages under test/*.html. The
 * fixture pages are intentionally separate from the examples-*.html pages so they
 * stay minimal and focused on the feature under test. baseURL and the
 * `npm run dev` web server come from package.json#kmwc.ports.dev (the devkit
 * preset), so the port can't drift from the Vite config or the Makefile.
 *
 * Every spec runs in chromium, firefox and webkit (the component's support
 * matrix); WebKit on Windows hangs a combined run after its last test, so run
 * it on its own there (`--project=webkit`).
 *
 * Commands:
 *   npm run test:e2e:install   # one-time: download chromium, firefox and webkit
 *   npm run test:e2e           # headless run
 *   npm run test:e2e:ui        # Playwright Test UI (debugging)
 *   npm run test:e2e:headed    # watch the browser do its thing
 */
const viewport = { width: 1440, height: 1024 };

export default definePlaywrightConfig({
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport } },
        { name: 'webkit', use: { ...devices['Desktop Safari'], viewport } },
    ],
});
