/**
 * examples-shared-toast.js
 *
 * Minimal in-page toast service for the demo pages. Vanilla JS, no deps,
 * one file. Load it as a module so the examples build bundles it:
 * <script type="module" src="/examples-shared-toast.js"></script>. Colours read
 * the devkit kit's --kmwc-* tokens, so toasts follow the theme switch.
 *
 * API:
 *   toast.info(message, opts?)
 *   toast.success(message, opts?)
 *   toast.warn(message, opts?)
 *   toast.error(message, opts?)
 *
 *   opts.timeout — ms before auto-dismiss (default 4500; 0 = sticky)
 *   opts.title   — optional bold title above the body
 *
 * Toasts stack bottom-right and dismiss on click or after timeout.
 */
(function () {
    'use strict';

    const STYLE_ID = 'examples-shared-toast-style';
    const STACK_ID = 'examples-shared-toast-stack';
    const DEFAULT_TIMEOUT = 4500;

    const CSS = `
        #${STACK_ID} {
            position: fixed;
            right: 1.6rem;
            bottom: 1.6rem;
            display: flex;
            flex-direction: column-reverse;
            gap: 0.8rem;
            z-index: 10001;
            max-width: min(36rem, calc(100vw - 3.2rem));
            pointer-events: none;
        }
        .demo-toast {
            pointer-events: auto;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 0.8rem;
            align-items: start;
            padding: 1rem 1.2rem;
            background: var(--kmwc-main-bg);
            border-left: 4px solid var(--kmwc-neutral-color);
            border-radius: 0.6rem;
            box-shadow: 0 10px 30px -10px var(--kmwc-shadow-color), 0 4px 6px -2px var(--kmwc-shadow-color);
            font-family: var(--kmwc-font-family);
            font-size: 1.35rem;
            color: var(--kmwc-text-color-1);
            line-height: 1.4;
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 180ms ease-out, transform 180ms ease-out;
        }
        .demo-toast--visible { opacity: 1; transform: translateY(0); }
        .demo-toast--leaving { opacity: 0; transform: translateY(8px); }
        .demo-toast--info    { border-left-color: var(--kmwc-accent-color); }
        .demo-toast--success { border-left-color: var(--kmwc-success-color); }
        .demo-toast--warn    { border-left-color: var(--kmwc-warning-color); }
        .demo-toast--error   { border-left-color: var(--kmwc-danger-fill-color); }
        .demo-toast__icon { font-size: 1.8rem; line-height: 1; padding-top: 0.1rem; }
        .demo-toast__body { min-width: 0; word-wrap: break-word; }
        .demo-toast__title { font-weight: 600; margin-bottom: 0.2rem; }
        .demo-toast__close {
            background: transparent;
            border: none;
            cursor: pointer;
            color: var(--kmwc-text-color-3);
            font-size: 1.6rem;
            padding: 0 0.4rem;
            margin-top: -0.2rem;
            border-radius: 0.4rem;
        }
        .demo-toast__close:hover { background: var(--kmwc-hover-bg); color: var(--kmwc-text-color-1); }
    `;

    const ICONS = {
        info:    'ℹ️',
        success: '✅',
        warn:    '⚠️',
        error:   '⛔'
    };

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function ensureStack() {
        let stack = document.getElementById(STACK_ID);
        if (!stack) {
            stack = document.createElement('div');
            stack.id = STACK_ID;
            document.body.appendChild(stack);
        }
        return stack;
    }

    function show(kind, message, opts) {
        ensureStyles();
        const stack = ensureStack();
        const timeout = opts && typeof opts.timeout === 'number' ? opts.timeout : DEFAULT_TIMEOUT;
        const title = opts && opts.title;

        const el = document.createElement('div');
        el.className = `demo-toast demo-toast--${kind}`;
        el.innerHTML = `
            <span class="demo-toast__icon" aria-hidden="true">${ICONS[kind] || ''}</span>
            <div class="demo-toast__body">
                ${title ? `<div class="demo-toast__title"></div>` : ''}
                <div class="demo-toast__message"></div>
            </div>
            <button type="button" class="demo-toast__close" aria-label="Dismiss">×</button>
        `;

        if (title) el.querySelector('.demo-toast__title').textContent = title;
        el.querySelector('.demo-toast__message').textContent = String(message);

        const dismiss = () => {
            el.classList.remove('demo-toast--visible');
            el.classList.add('demo-toast--leaving');
            setTimeout(() => el.remove(), 220);
        };

        el.querySelector('.demo-toast__close').addEventListener('click', dismiss);

        stack.appendChild(el);
        // Reflow so the transition runs.
        requestAnimationFrame(() => el.classList.add('demo-toast--visible'));

        if (timeout > 0) setTimeout(dismiss, timeout);

        return { dismiss };
    }

    window.toast = {
        info:    (message, opts) => show('info', message, opts),
        success: (message, opts) => show('success', message, opts),
        warn:    (message, opts) => show('warn', message, opts),
        error:   (message, opts) => show('error', message, opts)
    };
})();
