/**
 * Sanitizes HTML content by removing inline styles and unsafe attributes
 */
export function sanitizeHtml(html: string): string {
    if (!html) return '';
    let result = String(html);
    // Remove inline styles and presentation attributes from Word/Google Docs
    result = result.replace(/ style="[^"]*"/gi, '');
    result = result.replace(/ (color|face|size)="[^"]*"/gi, '');
    result = result.replace(/ class="[^"]*"/gi, '');
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
 * Safe JSON stringify that avoids breaking HTML script tags
 */
export function safeJsonString(value: string): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
