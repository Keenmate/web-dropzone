/**
 * Tiny DOM utilities shared by the core store and every satellite renderer.
 *
 * Kept in its own module (no project imports) so any other module — including
 * `dropzone.ts`, the row templates, and the satellites — can import from here
 * without risking a cycle.
 */

/**
 * Escape user-provided text for inclusion in an HTML template string.
 *
 * Uses the browser's own HTML serializer (textContent → innerHTML round-trip)
 * rather than a hand-rolled regex so the escape rules track whatever the
 * platform does for `&`, `<`, `>`, `"`, `'`, and astral codepoints.
 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
