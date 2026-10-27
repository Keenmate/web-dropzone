import { describe, it, expect, afterEach } from 'vitest';
import '../../src/web-component'; // registers <web-dropzone>

/**
 * Guards the `BlissElement` input-table wiring that replaced the hand-rolled
 * ATTRIBUTE_TABLE in the core migration: attribute → typed config (via the
 * converters), the configKey-named properties behind the short boolean
 * attributes (v2 naming), property→attribute reflection, and the
 * coalesced-write settle signal.
 *
 * All detached (no connect) — `#stage` updates the merged config synchronously,
 * so the public getters read the new value immediately; this avoids building the
 * store in happy-dom (that path is covered by the Playwright e2e suite).
 */

let el: any;

afterEach(() => {
    el?.remove();
    el = undefined;
});

describe('<web-dropzone> input table (BlissElement)', () => {
    it('seeds converter defaults', () => {
        el = document.createElement('web-dropzone');
        expect(el.maxVisibleFileCount).toBe(7);   // toInt({ default: 7 })
        expect(el.maxFileCount).toBe(0);       // toInt({ default: 0 })
        expect(el.displayMode).toBe('list');   // toEnum default 'list'
        expect(el.valueFormat).toBe('json');   // toEnum default 'json'
        expect(el.isMultiple).toBe(true);      // toBool('default-true')
        expect(el.isDisabled).toBe(false);     // toBool('presence')
        expect(el.isThumbnailsShown).toBeNull(); // toBool('tristate') → unset
    });

    it('parses attributes through their converters', () => {
        el = document.createElement('web-dropzone');
        el.setAttribute('max-file-count', '5');
        expect(el.maxFileCount).toBe(5);       // toInt
        el.setAttribute('max-file-size', '5MB');
        expect(el.maxFileSize).toBe(5 * 1024 * 1024); // toCustom(parseBytes) — binary units + aliases
        el.setAttribute('display-mode', 'grid');
        expect(el.displayMode).toBe('grid');   // toEnum
        el.setAttribute('display-mode', 'bogus');
        expect(el.displayMode).toBe('grid');   // invalid enum → warned, previous value kept (core)
    });

    it('maps the short boolean attributes to their prefixed configKey properties', () => {
        el = document.createElement('web-dropzone');
        el.setAttribute('multiple', 'false');
        expect(el.isMultiple).toBe(false);         // default-true
        el.setAttribute('disabled', '');
        expect(el.isDisabled).toBe(true);          // presence
        el.setAttribute('show-thumbnails', 'false');
        expect(el.isThumbnailsShown).toBe(false);  // tristate
        el.setAttribute('show-thumbnails', '');
        expect(el.isThumbnailsShown).toBe(true);
        el.setAttribute('sink-completed', '');
        expect(el.shouldSinkCompleted).toBe(true);
        el.setAttribute('keep-alive-when-removed', '');
        expect(el.shouldKeepAliveWhenRemoved).toBe(true);
        el.setAttribute('auto-upload', 'false');
        expect(el.shouldAutoUpload).toBe(false);
        el.setAttribute('allow-uploaded-file-removal', 'false');
        expect(el.isUploadedFileRemovalAllowed).toBe(false);
        el.setAttribute('files-inside', '');
        expect(el.isFilesInside).toBe(true);
        el.setAttribute('render-mode', 'structural');
        expect(el.renderMode).toBe('structural');
    });

    it('reflects a property write back to its attribute', () => {
        el = document.createElement('web-dropzone');
        el.maxFileCount = 3;
        expect(el.getAttribute('max-file-count')).toBe('3'); // shouldReflect: true
        expect(el.maxFileCount).toBe(3);
        el.isDisabled = true;
        expect(el.hasAttribute('disabled')).toBe(true);      // reflected, native-like
        el.isDisabled = false;
        expect(el.hasAttribute('disabled')).toBe(false);
    });

    it('has no hand-written alias properties (v2: configKey names only)', () => {
        el = document.createElement('web-dropzone');
        for (const old of ['multiple', 'disabled', 'showThumbnails', 'filesInside', 'autoUpload', 'uploadedDeletable', 'mode', 'maxVisibleFiles']) {
            expect(old in el, old).toBe(false);
        }
    });

    it('coalesces a property write and settles (connected)', async () => {
        // whenSettled() only resolves once a flush runs, and flushes are HELD
        // while detached — so connect first (this builds the store), then the
        // coalesced update flush resolves the settle promise.
        el = document.createElement('web-dropzone');
        document.body.appendChild(el);
        el.labels = { prompt: 'Drop here' };
        expect(el.labels).toEqual({ prompt: 'Drop here' }); // merged config updates synchronously
        await expect(el.whenSettled()).resolves.toBeUndefined();
    });
});
