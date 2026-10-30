import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import {embeddedImage, type ReadyBookRenderInput} from './index';

/** CLEAN templates: the shared PDF text engine adds the chosen quote afterwards. */
export function renderCoverPage(input: ReadyBookRenderInput, number: number) {
  const {book, cover} = input;
  const text = (value: string, className = '') => `<p class="${className}">${e(value)}</p>`;
  const content = (value: string) => `<main class="content">${value}</main>`;
  const flow = (value: string) => content(`<div class="flow">${value}</div>`);
  if (number === 1) {
    const pocket = input.profile.id === 'pocket-150x100';
    const bounds = cover.artworkBounds ?? {left: 0, top: .04, width: 1, height: .65};
    const width = cover.widthPx ?? 1054, height = cover.heightPx ?? 1492;
    const boxWidth = pocket ? 120 : 148, boxHeight = pocket ? 41 : 106;
    const scale = Math.min(boxWidth / (width * bounds.width), boxHeight / (height * bounds.height));
    const css = `width:${width * scale}mm;height:${height * scale}mm;left:${(boxWidth - width * scale * bounds.width) / 2 - bounds.left * width * scale}mm;top:${(boxHeight - height * scale * bounds.height) / 2 - bounds.top * height * scale}mm`;
    const country = book.country === 'BY' ? 'Беларусь' : 'Польша';
    return content(`<div class="cover-illustration"><img class="cover-native-art" src="${embeddedImage(cover.dataUri)}" alt="Акварель места из книги" style="${css}"></div><div class="cover-country" data-check-overflow><h1>${e(country)}</h1>${text(`${book.stops.length} мест · фотодневник`)}</div><div class="cover-quote-space" aria-hidden="true"></div>`);
  }
  if (number === 2) return flow(`<h2>Эта книга принадлежит</h2><div class="owner-space"></div>${text('Если найдёте, пожалуйста, свяжитесь со мной:')}`);
  if (number === 3) return flow(`<h2>Сохраните воспоминание</h2>${text('Оставьте свой кадр, билет, небольшой рисунок или несколько слов о поездке.')} ${text('Не закрывайте полосу крепления. Печатайте книгу в масштабе 100%. Для домашней печати используйте готовую раскладку A4.')}`);
  return flow(`<h2>Путешествие продолжается</h2>${text('MeTravel · metravel.by')}${text(book.revision, 'small')}`);
}
