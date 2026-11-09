import { describe, it, expect, beforeEach } from 'vitest';
import { DropzoneEngine, type DropzoneConfig, type DropzoneState } from '@keenmate/web-dropzone-core';

/**
 * Persisted UI state goes through core `createStateStore()` (SPEC §12.17):
 * a standalone engine makes its own store over its element; `<web-dropzone>`
 * injects one made on the host (`DropzoneEngineHost.stateStore`). Popover
 * resize / reload in a real browser: `e2e/persistence.spec.ts`.
 */
class ProbeEngine extends DropzoneEngine {
    get store() { return this.stateStore; }
}

const make = (config: DropzoneConfig, host?: any) =>
    new ProbeEngine(document.createElement('div'), config, host);

beforeEach(() => localStorage.clear());

describe('DropzoneEngine persisted UI state', () => {
    it('default store: localStorage km-state:<tag>:<storage-key>, merged whole state', async () => {
        const engine = make({ storageKey: 'k' });
        await engine.store.save({ popoverWidth: 300 });
        await engine.store.save({ popoverHeight: 200 });
        expect(JSON.parse(localStorage.getItem('km-state:div:k')!)).toEqual({ popoverWidth: 300, popoverHeight: 200 });
        expect(await make({ storageKey: 'k' }).store.load()).toEqual({ popoverWidth: 300, popoverHeight: 200 });
    });

    it('no storage-key: nothing is stored or loaded', async () => {
        const engine = make({});
        await engine.store.save({ popoverWidth: 300 });
        expect(localStorage.length).toBe(0);
        expect(await engine.store.load()).toBeNull();
    });

    it('callbacks replace localStorage; save gets { key, state } with the WHOLE state + context', async () => {
        const saves: any[] = [];
        const engine = make({
            storageKey: 'cb',
            loadStateCallback: ({ key }) => (key === 'cb' ? { popoverWidth: 10, popoverHeight: 20 } : null),
            saveStateCallback: (ctx) => { saves.push(ctx); },
        });
        expect(await engine.store.load()).toEqual({ popoverWidth: 10, popoverHeight: 20 });
        await engine.store.save({ popoverWidth: 99 });
        expect(saves).toHaveLength(1);
        expect(saves[0].key).toBe('cb');
        expect(saves[0].state).toEqual({ popoverWidth: 99, popoverHeight: 20 } satisfies DropzoneState);
        expect(saves[0].controller).toBeDefined();
        expect(localStorage.length).toBe(0);
    });

    it('a host store is used instead of the engine own one', async () => {
        const hostStore = { load: async () => ({ popoverWidth: 1 }), save: async () => {}, clear: async () => {} };
        const host = { element: document.createElement('div'), getController: () => ({}), notify: () => {}, stateStore: hostStore };
        const engine = make({ storageKey: 'k' }, host);
        expect(engine.store).toBe(hostStore);
    });
});
