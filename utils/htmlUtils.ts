/**
 * Sanitizes HTML content by removing inline styles and unsafe attributes
 */
export function sanitizeHtml(html: string): string {
    if (!html) return '';
    let result = String(html);
    const IFRAME_QL_VIDEO_SENTINEL_ATTR = 'data-metravel-keep-class="ql-video"';
    // Keep editor-critical embed classes that Quill relies on for iframe video blocks.
    result = result.replace(
        /<iframe\b([^>]*)\sclass="([^"]*)"([^>]*)>/gi,
        (full, beforeAttrs, classValue, afterAttrs) => {
            const safeClasses = String(classValue)
                .split(/\s+/)
                .map((token) => token.trim())
                .filter((token) => token === 'ql-video');

            const normalizedAttrs = `${beforeAttrs ?? ''}${afterAttrs ?? ''}`;
            const classAttr = safeClasses.length > 0 ? ` ${IFRAME_QL_VIDEO_SENTINEL_ATTR}` : '';
            return `<iframe${normalizedAttrs}${classAttr}>`;
        },
    );
    // Remove inline styles and presentation attributes from Word/Google Docs
    result = result.replace(/ style="[^"]*"/gi, '');
    result = result.replace(/ (color|face|size)="[^"]*"/gi, '');
    result = result.replace(/ class="[^"]*"/gi, '');
    result = result.replace(/<iframe\b([^>]*)\s+>/gi, '<iframe$1>');
    result = result.replace(/\sdata-metravel-keep-class="ql-video"/gi, ' class="ql-video"');
    // Remove HTML comments
    result = result.replace(/<!--[\s\S]*?-->/g, '');
    return result;
}

/**
 * Normalizes HTML for Quill editor, extracting body content if full document is pasted
 */
export function normalizeHtmlForQuill(input: string): string {
    const raw = String(input ?? '');
    const looksLikeFullDocument = /<!doctype\s+html/i.test(raw) || /<html[\s>]/i.test(raw) || /<head[\s>]/i.test(raw) || /<body[\s>]/i.test(raw);
    if (!looksLikeFullDocument) return raw;

    if (typeof window === 'undefined') return raw;
    try {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(raw, 'text/html');
        const body = doc?.body;
        const extracted = body?.innerHTML;
        return typeof extracted === 'string' && extracted.trim().length > 0 ? extracted : raw;
    } catch {
        return raw;
    }
}

/**
 * Normalizes a string to be used as an anchor ID
 */
export function normalizeAnchorId(value: string): string {
    const raw = String(value ?? '').trim().toLowerCase();
    return raw
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-_]+/gu, '-') // Unicode aware
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Escapes HTML special characters
 */
export function escapeHtml(value: string): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Converts plain text into a minimal HTML representation suitable for rich-text editors.
 * - Blank lines become paragraph breaks.
 * - Single newlines become <br/>.
 */
export function plainTextToHtml(text: string): string {
    const raw = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!raw) return '';

    const paragraphs = raw.split(/\n{2,}/g);
    return paragraphs
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
        .join('');
}

/**
 * Appends plain text to an existing HTML string (adds a blank paragraph separator when needed).
 */
export function appendPlainTextToHtml(existingHtml: string, text: string): string {
    const base = String(existingHtml ?? '');
    const addition = plainTextToHtml(text);
    if (!addition) return base;
    if (!base.trim()) return addition;
    return `${base}<p><br/></p>${addition}`;
}

/**
 * Removes <img> tags with base64 data-URI src from HTML.
 * This prevents massive inline images from inflating the description
 * beyond backend character limits (e.g. 10 000 000 chars).
 */
export function stripBase64Images(html: string): string {
    if (!html || typeof html !== 'string') return html ?? '';
    return html.replace(/<img\s[^>]*src\s*=\s*["']data:[^"']+["'][^>]*\/?>/gi, '');
}

/**
 * Safe JSON stringify that avoids breaking HTML script tags
 */
export function safeJsonString(value: string): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
