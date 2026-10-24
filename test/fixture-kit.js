/**
 * Shared page-side helpers for the e2e fixture pages (test/*.html).
 * Import from a page's module script:  import { ... } from './fixture-kit.js';
 *
 * Window hooks installed (consumed by e2e/helpers.ts):
 *   __addNamed(id, names, opts?)  add 64-byte text/plain files by name
 *   __pendingNames()              names parked in the synthetic upload pump
 *   __resolve(name, outcome?)     'ok' (default) resolves, 'fail' rejects,
 *                                 any other value resolves WITH that value
 *   __progress(name, pct)         ctx.setProgress for a parked upload
 *   __setMeta(name, patch)        ctx.setMetadata for a parked upload
 *   __calls                       one entry per handler invocation:
 *                                 { name, startPercent, metadata, uploadMetadata }
 *   (synthetic drags: e2e/helpers.ts dragFiles — no page hook needed)
 */

export function installAddNamed() {
    window.__addNamed = (id, names, opts) => {
        const el = document.getElementById(id);
        const files = names.map((n) => new File([new Uint8Array(64)], n, { type: 'text/plain' }));
        return el.addFiles(files, opts);
    };
}

/** Install the upload pump; returns the `uploadFileCallback` to assign. */
export function installPump() {
    const pending = new Map(); // name -> { resolve, reject, setProgress, setMetadata }
    window.__pending = pending;
    window.__calls = [];
    window.__pendingNames = () => Array.from(pending.keys());
    window.__resolve = (name, outcome = 'ok') => {
        const e = pending.get(name);
        if (!e) throw new Error(`No pending: ${name}`);
        pending.delete(name);
        if (outcome === 'fail') e.reject(new Error('simulated'));
        else e.resolve(outcome === 'ok' ? undefined : outcome);
    };
    window.__progress = (name, pct) => {
        const e = pending.get(name);
        if (!e) throw new Error(`No pending: ${name}`);
        e.setProgress(pct);
    };
    window.__setMeta = (name, patch) => pending.get(name).setMetadata(patch);

    return function handler({ file, signal, setProgress, setMetadata, startPercent, metadata, uploadMetadata }) {
        window.__calls.push({ name: file.name, startPercent, metadata: metadata ?? null, uploadMetadata: uploadMetadata ?? null });
        return new Promise((resolve, reject) => {
            pending.set(file.name, { resolve, reject, setProgress, setMetadata });
            signal?.addEventListener('abort', () => {
                pending.delete(file.name);
                reject(new DOMException('Aborted', 'AbortError'));
            });
        });
    };
}

/** One `type:detail` line per event into `pre` (file events log the name). */
export function logEvents(el, types, pre) {
    for (const type of types) {
        el.addEventListener(type, (e) => {
            const d = e.detail ?? {};
            let s = '';
            if (d.file) s = d.file.name;
            else if (d.rejectedFiles) s = d.rejectedFiles.map((r) => `${r.file.name}=${r.validation.code}`).join(',');
            else if (d.files) s = String(d.files.length);
            pre.textContent += `${type}:${s}\n`;
        });
    }
}
