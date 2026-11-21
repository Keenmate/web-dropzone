import { test, expect } from './fixtures';

/**
 * Example-page smoke tests — the one exception to "specs hit test/ fixtures":
 * they open a real examples-*.html page and only check that it works.
 */

test.describe('Localization page (examples-localization.html)', () => {
    /** The shared LO01–LO06 page: no console errors, every toggle changes the text its readout shows. */
    test('every toggle changes the shown text', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
        await page.goto('/examples-localization.html');
        const out = (id: string) => page.locator(`#${id}`);

        // LO01 — instance labels (on by default, short + full keys), off → English.
        await expect(out('lo01-out')).toContainText('#lo01        prompt: Přetáhněte soubory sem   button: Vybrat soubory');
        await expect(out('lo01-out')).toContainText('#lo01-plain  prompt: Drop files here or click to browse');
        await page.locator('#lo01-labels').uncheck();
        await expect(out('lo01-out')).toContainText('#lo01        prompt: Drop files here or click to browse   button: Select files');

        // LO02 — the page dictionary translates every dropzone, validation messages included.
        await expect(out('lo02-out')).toContainText('#lo02a  reject: File is too large. Maximum size is 1.5 KB');
        await page.locator('#lo02-dict').check();
        await expect(out('lo02-out')).toContainText('#lo02a  prompt: Přetáhněte soubory sem nebo klikněte   button: Vybrat soubory');
        await expect(out('lo02-out')).toContainText('#lo02a  reject: Soubor je příliš velký. Maximum je 1.5 KB');
        await expect(out('lo02-out')).toContainText('#lo02b  reject: Tento typ souboru není povolen');
        await page.locator('#lo02-dict').uncheck();
        await expect(out('lo02-out')).toContainText('#lo02b  reject: File type not accepted');

        // LO03 — page callback, then the element's own one first; instance labels still win.
        await page.locator('#lo03-page').check();
        await expect(out('lo03-out')).toContainText('#lo03a  prompt: Presuňte súbory sem   button: Vybrať súbory');
        await expect(out('lo03-out')).toContainText('#lo03a  reject: Súbor je príliš veľký (max. 1.5 KB)');
        await expect(out('lo03-out')).toContainText('#lo03b  prompt: Instance wins   button: Vybrať súbory');
        await page.locator('#lo03-own').check();
        await expect(out('lo03-out')).toContainText('#lo03a  prompt: Dateien hier ablegen   button: Vybrať súbory');
        await expect(out('lo03-out')).toContainText('#lo03a  reject: Datei zu groß (max. 1.5 KB)');
        await page.locator('#lo03-page').uncheck();
        await page.locator('#lo03-own').uncheck();
        await expect(out('lo03-out')).toContainText('#lo03a  prompt: Drop files here or click to browse');

        // LO04 — labels.prompt only → the minimal button's aria-label (ariaLabels.prompt) follows.
        await expect(out('lo04-out')).toContainText('minimal aria-label:  Drop files here or click to browse');
        await page.locator('#lo04-prompt').check();
        await expect(out('lo04-out')).toContainText('card prompt:         Přetáhněte soubory sem');
        await expect(out('lo04-out')).toContainText('minimal aria-label:  Přetáhněte soubory sem');

        // LO05 — the page locale reaches the file sizes.
        await page.locator('input[name="lo05-locale"][value="en-US"]').check();
        await expect(out('lo05-out')).toContainText('summary: 1 file(s), 1.3 KB');
        await page.locator('input[name="lo05-locale"][value="cs-CZ"]').check();
        await expect(out('lo05-out')).toContainText('summary: 1 file(s), 1,3 KB');
        await expect(out('lo05-out')).toContainText('Maximum size is 1,5 KB');
        // LO05 — the element's own locale wins over the page one; unset follows the page again.
        await page.locator('input[name="lo05-el-locale"][value="en"]').check();
        await expect(out('lo05-out')).toContainText('locale:  en');
        await expect(out('lo05-out')).toContainText('summary: 1 file(s), 1.3 KB');
        await expect(out('lo05-out')).toContainText('Maximum size is 1.5 KB');
        await page.locator('input[name="lo05-el-locale"][value=""]').check();
        await expect(out('lo05-out')).toContainText('summary: 1 file(s), 1,3 KB');

        expect(consoleErrors).toEqual([]);
    });
});
