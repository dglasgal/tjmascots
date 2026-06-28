/**
 * Safely serialize a JSON-LD object for embedding inside an inline
 * <script type="application/ld+json"> via dangerouslySetInnerHTML.
 *
 * Plain JSON.stringify() does NOT escape the HTML-significant characters
 * `<`, `>`, `&`, so a user-controlled value containing the literal
 * "</script>" (e.g. inside a mascot name or bio) would close the script
 * tag early and allow arbitrary markup/script injection (stored XSS).
 *
 * We escape those characters - plus the U+2028 / U+2029 line separators,
 * which are valid in JSON strings but illegal in JavaScript string
 * literals - to their \uXXXX unicode escapes. The result is still valid
 * JSON (search engines parse it identically) but can never break out of
 * the surrounding <script> element.
 */
const LS = new RegExp('\\u2028', 'g');
const PS = new RegExp('\\u2029', 'g');

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LS, '\\u2028')
    .replace(PS, '\\u2029');
}
