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
export function sanitizeArticleEditorHtml(html: string): string {
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
