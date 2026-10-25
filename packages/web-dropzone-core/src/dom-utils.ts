/**
 * Tiny DOM utilities shared by the core store and every satellite renderer.
 *
 * Kept in its own module (no project imports) so any other module — including
 * `dropzone.ts`, the row templates, and the satellites — can import from here
 * without risking a cycle.
 */

/**
 * Escape user-provided text for inclusion in an HTML template string — both
 * text content and quoted attribute values (`attr="${escapeHtml(v)}"`).
 *
 * Escapes `&`, `<`, `>`, `"` and `'`. (The previous textContent → innerHTML
 * round-trip left quotes alone — the HTML serializer only escapes them in
 * attribute values — so a `"` in a value broke out of an attribute.)
 */
export function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
