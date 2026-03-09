import { normalizeHtmlForQuill, sanitizeHtml, stripBase64Images } from '@/utils/htmlUtils';
import { sanitizeRichText } from '@/utils/sanitizeRichText';
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

export function normalizeArticleEditorHtmlForInput(html: string): string {
  return stripBase64Images(normalizeHtmlForQuill(String(html ?? '')));
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
