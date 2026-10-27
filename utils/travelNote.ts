import type { TravelFormData, TravelPublicationFormat } from '@/types/types';
import { validateName, type ModerationIssue } from '@/utils/formValidation';
import { translate as i18nT, translatePlural } from '@/i18n';

// Короткая заметка о поездке (#2666) — тот же Travel с `publication_format: 'note'`.
// Серверная готовность к модерации (#2699, docs/TRAVEL_NOTE_PUBLICATION_API.md в
// бэкенд-репозитории): ровно одна точка с существующей страной, не меньше 50 видимых
// символов текста, 1–10 фото галереи; категории статьи и точки не нужны.
export const NOTE_MIN_TEXT_LENGTH = 50;
export const NOTE_MAX_PHOTOS = 10;
export const NOTE_PHOTOS_STEP = 1;
export const NOTE_STORY_STEP = 2;
export const NOTE_TOTAL_STEPS = 2;
export const FULL_TOTAL_STEPS = 6;
/** Фото, место, название, рассказ — пункты готовности заметки. */
export const NOTE_READINESS_CHECKS = 4;

/** Режим создания из `/travel/new?mode=…`: всё, кроме точного `note`, — полный мастер. */
export function parseTravelPublicationMode(params: Record<string, unknown> | null | undefined): TravelPublicationFormat {
  const raw = params?.mode;
  const value = Array.isArray(raw) ? (raw.length === 1 ? raw[0] : undefined) : raw;
  return value === 'note' ? 'note' : 'full';
}

/** Формат записи — серверное поле; всё, кроме `note`, читается как полная статья. */
export function resolveTravelPublicationFormat(
  data: Pick<TravelFormData, 'publication_format'> | null | undefined,
): TravelPublicationFormat {
  return data?.publication_format === 'note' ? 'note' : 'full';
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ',
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Абзацы простого текста заметки → HTML-описание статьи (каждая непустая строка — `<p>`). */
export function noteTextToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

/** HTML-описание → простой текст для поля заметки: блоки и `<br>` становятся переносами строк. */
export function noteHtmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return String(html)
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|section|details|summary)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity)
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// Невидимые символы, которые сервер выбрасывает из подсчёта: формат (Cf — ZWJ,
// zero-width space, BOM) и управляющие (Cc), кроме пробельных.
const INVISIBLE_CHARS = /\p{Cf}|(?![\t\n\v\f\r])\p{Cc}/gu;

/**
 * Видимая длина текста так же, как её считает сервер: невидимые символы выброшены,
 * пробелы и границы блоков схлопнуты в один, длина — в символах Unicode, а не в
 * UTF-16 (эмодзи — один символ, как `len()` на сервере).
 */
export function getNoteTextLength(html: string | null | undefined): number {
  // Невидимые выбрасываются до схлопывания пробелов: JS считает BOM пробелом, сервер — нет.
  const visible = noteHtmlToText(html ? String(html).replace(INVISIBLE_CHARS, '') : html)
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(visible).length;
}

const countGalleryPhotos = (gallery: unknown): number => (Array.isArray(gallery) ? gallery : [])
  .filter((item) => {
    if (typeof item === 'string') return item.trim().length > 0;
    const url = (item as { url?: unknown } | null)?.url;
    return typeof url === 'string' && url.trim().length > 0;
  }).length;

const hasValidCountry = (point: unknown): boolean => {
  const country = (point as { country?: unknown } | null)?.country;
  const id = Number(country);
  return country != null && country !== '' && Number.isInteger(id) && id > 0;
};

/** Куда вести автора за каждым пунктом: шаги экрана заметки или полного мастера (модератор). */
export type NoteIssueSteps = { photos: number; place: number; name: number; story: number };
export const NOTE_FLOW_ISSUE_STEPS: NoteIssueSteps = {
  photos: NOTE_PHOTOS_STEP, place: NOTE_STORY_STEP, name: NOTE_STORY_STEP, story: NOTE_STORY_STEP,
};
export const FULL_WIZARD_ISSUE_STEPS: NoteIssueSteps = { photos: 3, place: 2, name: 1, story: 1 };

/**
 * Чего не хватает заметке для явной отправки на модерацию — набор сервера плюс
 * название: без него сохранение подставило бы служебный плейсхолдер черновика.
 */
export function getNoteModerationIssues(
  formData: Pick<TravelFormData, 'name' | 'description' | 'coordsMeTravel' | 'gallery'>,
  steps: NoteIssueSteps = NOTE_FLOW_ISSUE_STEPS,
): ModerationIssue[] {
  const issues: ModerationIssue[] = [];
  const photos = countGalleryPhotos(formData.gallery);
  if (photos < 1 || photos > NOTE_MAX_PHOTOS) {
    issues.push({
      key: 'photos',
      label: i18nT('travel:components.travel.note.issues.photos', { value1: NOTE_MAX_PHOTOS }),
      targetStep: steps.photos,
    });
  }

  const points = Array.isArray(formData.coordsMeTravel) ? formData.coordsMeTravel : [];
  if (points.length !== 1) {
    issues.push({
      key: 'route',
      label: i18nT('travel:components.travel.note.issues.place'),
      targetStep: steps.place,
    });
  } else if (!hasValidCountry(points[0])) {
    issues.push({
      key: 'countries',
      label: i18nT('travel:components.travel.note.issues.country'),
      targetStep: steps.place,
    });
  }

  const nameError = validateName(formData.name);
  if (nameError) {
    issues.push({ key: 'name', label: nameError.message, targetStep: steps.name });
  }

  if (getNoteTextLength(formData.description) < NOTE_MIN_TEXT_LENGTH) {
    issues.push({
      key: 'description',
      label: translatePlural('travel:components.travel.note.issues.story', NOTE_MIN_TEXT_LENGTH, { value1: NOTE_MIN_TEXT_LENGTH }),
      targetStep: steps.story,
    });
  }

  return issues;
}
