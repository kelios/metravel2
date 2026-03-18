import { normalizeHtmlForQuill, sanitizeHtml, stripBase64Images } from '@/utils/htmlUtils';
import { sanitizeRichText } from '@/utils/sanitizeRichText';
import { safeGetYoutubeId } from '@/utils/travelMedia';
import type { ArticleEditorVariant } from './articleEditor.types';

export const ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS = 250;
export const ARTICLE_EDITOR_NATIVE_MESSAGE_DEBOUNCE_MS = 300;
export const ARTICLE_EDITOR_DEFAULT_AUTOSAVE_DELAY = 5000;

const QUILL_SHARED_MODULES = {
  history: { delay: 2000, maxStack: 100, userOnly: true },
  clipboard: { matchVisual: false },
  uploader: false,
} as const;

export const QUILL_TOOLBAR_BY_VARIANT: Record<ArticleEditorVariant, readonly unknown[]> = {
  default: [
    [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ header: [1, 2, 3, false] }],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ],
  compact: [
    ['bold', 'italic', 'underline'],
    [{ list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
} as const;

export function getQuillModulesForVariant(variant: ArticleEditorVariant) {
  return {
    ...QUILL_SHARED_MODULES,
    toolbar: QUILL_TOOLBAR_BY_VARIANT[variant],
  };
}

const INSTAGRAM_POST_URL_RE =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:(?:p|reel|tv)\/[A-Za-z0-9_-]+)(?:\/)?(?:\?[^\s"'<>]*)?/i;
const YOUTUBE_URL_RE =
  /https?:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/)[^\s"'<>]+|youtu\.be\/[^\s"'<>]+)/i;

function normalizeInstagramPostUrl(url: string): string | null {
  const raw = String(url ?? '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'instagram.com' && host !== 'www.instagram.com') return null;

    const match = parsed.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/i);
    if (!match) return null;

    return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
  } catch {
    return null;
  }
}

export function buildInstagramEmbedHtmlFromUrl(url: string): string | null {
  const normalizedUrl = normalizeInstagramPostUrl(url);
  if (!normalizedUrl) return null;

  return [
    '<iframe',
    ' class="ql-video"',
    ' frameborder="0"',
    ' allowfullscreen="true"',
    ` src="${normalizedUrl}embed/captioned/"`,
    ' width="540"',
    ' height="680"',
    ' title="Instagram post"',
    '></iframe>',
  ].join('');
}

export function buildYoutubeEmbedHtmlFromUrl(url: string): string | null {
  const youtubeId = safeGetYoutubeId(url);
  if (!youtubeId) return null;

  return [
    '<iframe',
    ' class="ql-video"',
    ' frameborder="0"',
    ' allowfullscreen="true"',
    ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
    ` src="https://www.youtube.com/embed/${youtubeId}"`,
    ' width="560"',
    ' height="315"',
    ' title="YouTube video"',
    '></iframe>',
  ].join('');
}

function replaceStandaloneLinksWithEmbeds(
  html: string,
  buildEmbed: (url: string) => string | null,
  urlRe: RegExp,
): string {
  let next = String(html ?? '');
  if (!next.trim()) return next;

  next = next.replace(
    /<(p|div)>\s*(?:<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>|(https?:\/\/[^\s<]+))\s*<\/\1>/gi,
    (full, _tagName, href, rawUrl) => {
      const embed = buildEmbed(String(href || rawUrl || '').trim());
      return embed ?? full;
    },
  );

  next = next.replace(
    /<a\b[^>]*href="([^"]+)"[^>]*>\s*\1\s*<\/a>/gi,
    (full, href) => buildEmbed(String(href || '')) ?? full,
  );

  if (!/<iframe\b/i.test(next) && urlRe.test(next.trim())) {
    return buildEmbed(next.trim()) ?? next;
  }

  return next;
}

function replaceStandaloneInstagramLinksWithEmbeds(html: string): string {
  return replaceStandaloneLinksWithEmbeds(html, buildInstagramEmbedHtmlFromUrl, INSTAGRAM_POST_URL_RE);
}

function replaceStandaloneYoutubeLinksWithEmbeds(html: string): string {
  return replaceStandaloneLinksWithEmbeds(html, buildYoutubeEmbedHtmlFromUrl, YOUTUBE_URL_RE);
}

function normalizeSupportedVideoIframes(html: string): string {
  return String(html ?? '').replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi, (full, rawAttrs) => {
    const attrs = String(rawAttrs ?? '');
    const srcMatch = attrs.match(/\ssrc=(["'])(.*?)\1/i);
    const src = srcMatch?.[2] ?? '';

    const youtubeEmbed = buildYoutubeEmbedHtmlFromUrl(src);
    if (youtubeEmbed) {
      return youtubeEmbed;
    }

    const instagramEmbed = buildInstagramEmbedHtmlFromUrl(src.replace(/embed\/captioned\/?$/i, ''));
    if (instagramEmbed) {
      return instagramEmbed;
    }

    return full;
  });
}

export function normalizeArticleEditorHtmlForInput(html: string): string {
  return replaceStandaloneYoutubeLinksWithEmbeds(
    replaceStandaloneInstagramLinksWithEmbeds(
      normalizeSupportedVideoIframes(stripBase64Images(normalizeHtmlForQuill(String(html ?? '')))),
    ),
  );
}

export function normalizeArticleEditorHtmlForOutput(html: string): string {
  return sanitizeHtml(normalizeArticleEditorHtmlForInput(html));
}

export function sanitizeArticleEditorNativeContent(html: string): string {
  return sanitizeRichText(normalizeArticleEditorHtmlForInput(html));
}

export function extractArticleEditorUploadUrl(response: unknown): string | null {
  const payload = response as Record<string, any> | null | undefined;
  const value =
    typeof payload?.url === 'string'
      ? payload.url
      : typeof payload?.data?.url === 'string'
        ? payload.data.url
        : typeof payload?.path === 'string'
          ? payload.path
          : typeof payload?.file_url === 'string'
            ? payload.file_url
            : null;

  return value ? String(value) : null;
}

export function getNativeToolbarMarkup(variant: ArticleEditorVariant): string {
  if (variant === 'compact') {
    return `
        <button class="ql-bold"></button>
        <button class="ql-italic"></button>
        <button class="ql-underline"></button>
        <button class="ql-list" value="bullet"></button>
        <button class="ql-link"></button>
      `;
  }

  return `
        <button class="ql-bold"></button>
        <button class="ql-italic"></button>
        <button class="ql-underline"></button>
        <button class="ql-strike"></button>
        <select class="ql-header">
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option selected>Normal</option>
        </select>
        <button class="ql-list" value="ordered"></button>
        <button class="ql-list" value="bullet"></button>
        <button class="ql-link"></button>
        <button class="ql-image"></button>
      `;
}
