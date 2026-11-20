import { describe, it, expect, afterEach } from 'vitest';
import { DropzoneEngine, createLabelFn } from '@keenmate/web-dropzone-core';

/**
 * `translateCallback` — the instance twin of the page-wide
 * `window.components.locale.translateCallback` (core `/locale`, rulebook C-CA-33).
 * A standalone engine (no `<web-dropzone>`) asks its config's hook too; the
 * element + satellites in a real browser: `e2e/labels.spec.ts`.
 */
afterEach(() => { (window as any).components.locale = null; });

describe('translateCallback (instance)', () => {
    it('a standalone engine asks config.translateCallback before the page-wide one; null passes on', () => {
        (window as any).components.locale = { translateCallback: ({ key }: any) => (key.endsWith('buttons.selectFiles') ? 'PAGE select' : null) };
        const engine = new DropzoneEngine(document.createElement('div'), {
            translateCallback: ({ key }) => (key === 'web-dropzone.labels.prompt' ? 'OWN prompt' : null),
            labels: { 'labels.hint': 'Instance hint' },
        });
        expect(engine.label('labels.prompt')).toBe('OWN prompt');
        expect(engine.label('buttons.selectFiles')).toBe('PAGE select');
        expect(engine.label('labels.hint')).toBe('Instance hint');
    });

    it('createLabelFn: instance labels beat the own hook; the own hook beats the page one', () => {
        (window as any).components.locale = { translateCallback: () => 'PAGE' };
        const label = createLabelFn(() => ({ 'labels.hint': 'Mine' }), () => null, () => () => 'OWN');
        expect(label('labels.hint')).toBe('Mine');
        expect(label('labels.prompt')).toBe('OWN');
    });
});
