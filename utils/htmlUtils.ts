import sanitizeHtmlLib from 'sanitize-html';

const ARTICLE_ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'blockquote',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'a',
    'span',
    'img',
    'figure',
    'figcaption',
    'iframe',
] as const;

const ARTICLE_ALLOWED_ATTRIBUTES: sanitizeHtmlLib.IOptions['allowedAttributes'] = {
    a: ['href', 'name', 'target', 'rel', 'title'],
    span: ['id'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    iframe: ['src', 'title', 'allow', 'allowfullscreen', 'frameborder', 'width', 'height', 'class'],
};

const ARTICLE_ALLOWED_IFRAME_HOSTS = [
    'youtube.com',
    'www.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'instagram.com',
    'www.instagram.com',
] as const;

/**
 * Sanitizes article-editor HTML with a strict allowlist so Quill output
 * cannot round-trip unsafe markup back into the app.
 */
export function sanitizeHtml(html: string): string {
    const raw = String(html ?? '');
    if (!raw.trim()) return '';

    return sanitizeHtmlLib(raw, {
        allowedTags: [...ARTICLE_ALLOWED_TAGS],
        allowedAttributes: ARTICLE_ALLOWED_ATTRIBUTES,
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesByTag: {
            img: ['http', 'https', 'data', 'blob'],
            iframe: ['http', 'https'],
        },
        allowedClasses: {
            iframe: ['ql-video'],
        },
        allowedIframeHostnames: [...ARTICLE_ALLOWED_IFRAME_HOSTS],
        disallowedTagsMode: 'discard',
        parser: { lowerCaseAttributeNames: false },
        transformTags: {
            iframe: (tagName, attribs) => {
                const nextAttribs = { ...attribs };
                const classes = String(nextAttribs.class ?? '')
                    .split(/\s+/)
                    .map((token) => token.trim())
                    .filter(Boolean);
                if (classes.includes('ql-video')) {
                    nextAttribs.class = 'ql-video';
                } else {
                    delete nextAttribs.class;
                }
                return { tagName, attribs: nextAttribs };
            },
        },
        exclusiveFilter: (frame) => {
            if (frame.tag === 'a' && !frame.attribs?.href) return true;
            if (frame.tag === 'iframe' && !frame.attribs?.src) return true;
            return false;
        },
    }).trim();
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
