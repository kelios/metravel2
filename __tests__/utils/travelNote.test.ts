import type { TravelFormData } from '@/types/types';
import { getEmptyFormData, transformTravelToFormData } from '@/utils/travelFormUtils';
import {
  FULL_WIZARD_ISSUE_STEPS,
  getNoteModerationIssues,
  getNoteTextLength,
  noteHtmlToText,
  noteTextToHtml,
  parseTravelPublicationMode,
  resolveTravelPublicationFormat,
} from '@/utils/travelNote';
import { validateReadyForModeration } from '@/utils/travelWizardValidation';

const STORY = 'Заехали сюда по дороге домой и остались до заката у старой мельницы.';

const makeNote = (overrides: Partial<TravelFormData> = {}): TravelFormData => ({
  ...getEmptyFormData('101'),
  publication_format: 'note',
  name: 'Мельница',
  description: noteTextToHtml(STORY),
  coordsMeTravel: [{ id: 7, lat: 53.45, lng: 26.47, address: 'Мельница', country: 3, categories: [], image: null }],
  gallery: [{ id: 1, url: 'https://metravel.by/gallery/1.jpg' }] as TravelFormData['gallery'],
  countries: [],
  categories: [],
  ...overrides,
});

describe('travel note (#2666)', () => {
  it('opens the note only for the exact mode=note parameter', () => {
    expect(parseTravelPublicationMode({ mode: 'note' })).toBe('note');
    expect(parseTravelPublicationMode({ mode: ['note'] })).toBe('note');
    expect(parseTravelPublicationMode({ mode: 'NOTE' })).toBe('full');
    expect(parseTravelPublicationMode({ mode: ['note', 'full'] })).toBe('full');
    expect(parseTravelPublicationMode({ mode: 'full' })).toBe('full');
    expect(parseTravelPublicationMode({})).toBe('full');
    expect(parseTravelPublicationMode(null)).toBe('full');
  });

  it('keeps the server format on load and treats anything unknown as a full article', () => {
    expect(getEmptyFormData(null).publication_format).toBe('full');
    expect(transformTravelToFormData({ id: 5, publication_format: 'note' } as never).publication_format).toBe('note');
    expect(transformTravelToFormData({ id: 5 } as never).publication_format).toBe('full');
    expect(resolveTravelPublicationFormat({ publication_format: 'bogus' as never })).toBe('full');
  });

  it('round-trips plain story paragraphs through escaped HTML', () => {
    const html = noteTextToHtml('  Первый абзац <b>&\n\nВторой  абзац ');
    expect(html).toBe('<p>Первый абзац &lt;b&gt;&amp;</p><p>Второй  абзац</p>');
    expect(noteHtmlToText(html)).toBe('Первый абзац <b>&\nВторой абзац');
    expect(noteHtmlToText('<p>Строка<br>вторая</p><div>третья</div>')).toBe('Строка\nвторая\nтретья');
    expect(noteHtmlToText(null)).toBe('');
  });

  it('counts visible text like the server: collapsed whitespace and one separator between blocks', () => {
    const html = `<p>${'a'.repeat(25)}</p><p>${'b'.repeat(24)}</p>`;
    expect(getNoteTextLength(html)).toBe(50);
    expect(getNoteTextLength(`<p>${'a'.repeat(49)}</p>`)).toBe(49);
    expect(getNoteTextLength('<p>  </p>')).toBe(0);
  });

  it('counts Unicode characters and drops invisible format/control characters like the server', () => {
    // Эмодзи — один символ (в UTF-16 их два), ZWJ/zero-width space/BOM не считаются.
    expect(getNoteTextLength(`<p>${'😀'.repeat(25)}</p>`)).toBe(25);
    expect(getNoteTextLength('<p>a\u200Bb\uFEFFc\u200D\u0001d</p>')).toBe(4);
    expect(getNoteTextLength('<p>a \u200B b</p>')).toBe(3);
  });

  it('accepts a note without article or point categories', () => {
    expect(getNoteModerationIssues(makeNote())).toEqual([]);
    expect(validateReadyForModeration(makeNote())).toEqual({ isValid: true, missingFields: [] });
  });

  it('requires one point with a country, 50 characters and 1–10 photos', () => {
    const keys = (data: TravelFormData) => getNoteModerationIssues(data).map((issue) => issue.key);
    expect(keys(makeNote({ coordsMeTravel: [] }))).toEqual(['route']);
    const point = makeNote().coordsMeTravel[0];
    expect(keys(makeNote({ coordsMeTravel: [point, { ...point, id: 8 }] }))).toEqual(['route']);
    expect(keys(makeNote({ coordsMeTravel: [{ ...point, country: null }] }))).toEqual(['countries']);
    expect(keys(makeNote({ description: `<p>${'a'.repeat(49)}</p>` }))).toEqual(['description']);
    expect(keys(makeNote({ gallery: [] }))).toEqual(['photos']);
    // Без названия сохранение подставило бы служебный плейсхолдер черновика.
    expect(keys(makeNote({ name: '' }))).toEqual(['name']);
    expect(keys(makeNote({ name: 'Ab' }))).toEqual(['name']);
    const eleven = Array.from({ length: 11 }, (_, index) => ({ id: index, url: `https://x/${index}.jpg` }));
    expect(keys(makeNote({ gallery: eleven as TravelFormData['gallery'] }))).toEqual(['photos']);
    // Обложка без фото галереи заметку не делает готовой: сервер считает только галерею.
    expect(keys(makeNote({ gallery: [], travel_image_thumb_small_url: 'https://x/cover.jpg' }))).toEqual(['photos']);
  });

  it('points the issues to note screens or, for a moderator, to full wizard steps', () => {
    const empty = makeNote({ gallery: [], coordsMeTravel: [], name: '', description: '' });
    expect(getNoteModerationIssues(empty).map((issue) => issue.targetStep)).toEqual([1, 2, 2, 2]);
    expect(getNoteModerationIssues(empty, FULL_WIZARD_ISSUE_STEPS).map((issue) => issue.targetStep)).toEqual([3, 2, 1, 1]);
  });

  it('keeps the full article readiness unchanged', () => {
    const asFull = makeNote({ publication_format: 'full' });
    const result = validateReadyForModeration(asFull);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toEqual(expect.arrayContaining(['countries', 'categories']));
  });
});
