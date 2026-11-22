import { describe, it, expect, afterEach } from 'vitest';
import { DEFAULT_CONFIG, DropzoneEngine, formatFileSize, formatPercent } from '@keenmate/web-dropzone-core';
import { progressLabel } from '../../src/row-templates';
import '../../src/index'; // registers <web-dropzone>

/**
 * `locale` (rulebook C-CA-38) — the element input and the public engine option
 * share one default (`DEFAULT_CONFIG.locale`, unset). The rendered element +
 * satellites in a real browser: `e2e/labels.spec.ts` ("locale input").
 */
afterEach(() => { (window as any).components.locale = null; });

describe('locale', () => {
    it('formatFileSize: the given locale, else the page-wide one', () => {
        expect(formatFileSize(1536, 'de')).toBe('1,5 KB');
        expect(formatFileSize(1536, 'en')).toBe('1.5 KB');
        (window as any).components.locale = { locale: 'cs' };
        expect(formatFileSize(1536)).toBe('1,5 KB');
        expect(formatFileSize(1536, null)).toBe('1,5 KB');
        expect(formatFileSize(1536, 'en')).toBe('1.5 KB');
    });

    it('one default: the engine option and the element input are both unset', () => {
        expect(DEFAULT_CONFIG.locale).toBeNull();
        expect(new DropzoneEngine(document.createElement('div')).getOptions().locale).toBeNull();
        const el: any = document.createElement('web-dropzone');
        expect(el.locale).toBe(DEFAULT_CONFIG.locale);
        el.setAttribute('locale', 'de');
        expect(el.locale).toBe('de');
    });

    it('a standalone engine: {ctx.count} in labels follows the locale option; unset follows the page; setOptions is live', () => {
        const engine = new DropzoneEngine(document.createElement('div'), { locale: 'de', labels: { 'labels.hint': '{ctx.count} files' } });
        expect(engine.label('labels.hint', { ctx: { count: 1234 } })).toBe('1.234 files');
        engine.setOptions({ locale: 'en' });
        expect(engine.label('labels.hint', { ctx: { count: 1234 } })).toBe('1,234 files');
        engine.setOptions({ locale: undefined });
        (window as any).components.locale = { locale: 'de' };
        expect(engine.label('labels.hint', { ctx: { count: 1234 } })).toBe('1.234 files');
    });

    it('labels read the spot context ({ctx.*}); translateCallback gets it as params.ctx (raw numbers)', async () => {
        const element = document.createElement('div');
        const seen: Array<{ key: string; ctx: any }> = [];
        const engine = new DropzoneEngine(element, {
            locale: 'en',
            maxFileCount: 1,
            translateCallback: ({ key, params }: any) => {
                seen.push({ key, ctx: params?.ctx });
                return key === 'web-dropzone.errors.maxFileCount' ? `max=${params.ctx.count}` : null;
            }
        });
        expect(engine.label('labels.fileCount', { ctx: { count: 1234 } })).toBe('Files: 1,234');
        expect(engine.label('ariaLabels.removeFile', { ctx: { name: 'a.txt', size: 1, type: '' } })).toBe('Remove a.txt');
        const errors: string[] = [];
        element.addEventListener('file-reject', (e: any) => { for (const r of e.detail.rejectedFiles) errors.push(r.validation.error); });
        await engine.addFiles([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]);
        expect(errors).toEqual(['max=1']);
        expect(seen.find(s => s.key === 'web-dropzone.errors.maxFileCount')?.ctx).toEqual({ count: 1 });
    });

    it('a standalone engine: size validation messages use the locale option', async () => {
        const element = document.createElement('div');
        const engine = new DropzoneEngine(element, { locale: 'de', maxFileSize: 1536 });
        const errors: string[] = [];
        element.addEventListener('file-reject', (e: any) => { for (const r of e.detail.rejectedFiles) errors.push(r.validation.error); });
        await engine.addFiles([new File([new Uint8Array(4000)], 'big.bin')]);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('1,5 KB');
    });

    it('progress percents: the number follows the locale, the % sign stays (per-file 1 digit, overall 0)', () => {
        const file = { status: 'uploading', progress: 12.5 } as any;
        expect(progressLabel(file, undefined, 'de')).toBe('12,5%');
        expect(progressLabel(file, undefined, 'en')).toBe('12.5%');
        expect(formatPercent(40, 0, 'de')).toBe('40%');
        (window as any).components.locale = { locale: 'cs' };
        expect(progressLabel(file)).toBe('12,5%');
    });
});
