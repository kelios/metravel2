import sanitizeHtmlLib from 'sanitize-html';

import { normalizeQuillListMarkup } from '@/utils/richTextLists';
import { QUILL_BLOCK_CLASSES, QUILL_INLINE_CLASSES } from '@/utils/quillRichText';

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
  'pre',
  'code',
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
  'section',
  'details',
  'summary',
] as const;

// Запись обязана перечислять не только теги, которые отдаёт Quill, но и атрибуты,
// которыми он различает смысл внутри одного тега: `disallowedTagsMode: 'discard'`
// снимает с тега ВСЕ атрибуты, если записи для него здесь нет (#1768 — так терялись
// теги FAQ, #1866 — так терялся тип списка). Регресс ловит
// `__tests__/utils/articleEditorSanitize.quillFormats.test.ts`.
const ARTICLE_ALLOWED_ATTRIBUTES: sanitizeHtmlLib.IOptions['allowedAttributes'] = {
  a: ['href', 'name', 'target', 'rel', 'title'],
  p: ['class'],
  h1: ['class'],
  h2: ['class'],
  h3: ['class'],
  h4: ['class'],
  h5: ['class'],
  h6: ['class'],
  blockquote: ['class'],
  pre: ['class'],
  span: ['id', 'class'],
  ol: ['data-list', 'class'],
  ul: ['data-list', 'class'],
  li: ['data-list', 'class'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
  iframe: ['src', 'title', 'allow', 'allowfullscreen', 'frameborder', 'width', 'height', 'class'],
  section: ['class', 'data-faq', 'itemscope', 'itemtype'],
  details: ['open', 'itemscope', 'itemtype', 'itemprop'],
  summary: ['itemprop'],
};

const ARTICLE_ALLOWED_IFRAME_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'instagram.com',
  'www.instagram.com',
] as const;

const MEANINGFUL_EMBED_TAG_RE = /<(img|iframe)\b/i;
const EMPTY_RICH_TEXT_TOKEN_RE = /(?:&nbsp;|&#160;|&#xA0;|\u00a0|\u200b|\u200c|\u200d|\ufeff|\s)+/gi;

function collapseSemanticallyEmptyEditorHtml(html: string): string {
  const normalized = String(html ?? '').trim();
  if (!normalized) return '';
  if (MEANINGFUL_EMBED_TAG_RE.test(normalized)) return normalized;

  const plainText = normalized
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(EMPTY_RICH_TEXT_TOKEN_RE, '');

  return plainText.length === 0 ? '' : normalized;
}

/**
 * Sanitizes article-editor HTML with a strict allowlist so Quill output
 * cannot round-trip unsafe markup back into the app.
 *
 * После allowlist транспортная разметка списков Quill приводится к
 * семантической: функция стоит и на выходе редактора, и на загрузке тела
 * обратно в редактор, а `matchList` в Quill 2 читает ТЕГ контейнера, а не
 * `data-list` — `<ol data-list="bullet">` открылся бы нумерованным. Порядок
 * важен: sanitize-html сначала достраивает незакрытые `<li>`, и только после
 * этого блок разбирается на пробеги (`data-list` для того и оставлен в
 * `ARTICLE_ALLOWED_ATTRIBUTES`, что должен дожить до этого шага).
 */
export function sanitizeArticleEditorHtml(html: string): string {
  const raw = String(html ?? '');
  if (!raw.trim()) return '';

  return collapseSemanticallyEmptyEditorHtml(normalizeQuillListMarkup(sanitizeHtmlLib(raw, {
    allowedTags: [...ARTICLE_ALLOWED_TAGS],
    allowedAttributes: ARTICLE_ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data', 'blob'],
      iframe: ['http', 'https'],
    },
    allowedClasses: {
      iframe: ['ql-video'],
      span: QUILL_INLINE_CLASSES,
      ...Object.fromEntries(
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ol', 'ul', 'li']
          .map((tag) => [tag, QUILL_BLOCK_CLASSES]),
      ),
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
  }).trim()));
}
