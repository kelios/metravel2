import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import {embeddedImage, type ReadyBookRenderInput} from './index';
import type {CountryQuestBook} from '../../../../types/questBook';
import {bookStyleCopy} from './styleCopy';
import {bookFrameCopy} from './frameCopy';
import {countRu, editionMonth, PLACES, QUESTS} from './counts';
import edition from '../../../../data/travelBooks/edition.json';

/** CLEAN templates: the shared PDF text engine adds the chosen quote afterwards. */
export function renderCoverPage(input: Pick<ReadyBookRenderInput,'profile'> & {cover:Pick<ReadyBookRenderInput['cover'],'dataUri'|'widthPx'|'heightPx'|'artworkBounds'>;book:ReadyBookRenderInput['book']|CountryQuestBook}, number: number) {
  const {book, cover} = input;
  const questBook='quests'in book?book:null;
  const copy=questBook?{coverAlt:'Обложка опубликованного квеста из книги'}:'sourceContract' in book&&book.sourceContract==='thematic-v1'?{coverAlt:'Фотография из источников тематической книги'}:bookStyleCopy('visualStyle'in book?book.visualStyle:undefined);
  const countLabel=questBook?`${countRu(questBook.quests.length,QUESTS)} · часть ${questBook.volume}`:`${countRu('stops'in book?book.stops.length:0,PLACES)} · фотодневник`;
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
    const country = 'sourceContract' in book && book.sourceContract === 'thematic-v1' ? book.title : book.country === 'BY' ? 'Беларусь' : 'Польша';
    return content(`<div class="cover-illustration"><img class="cover-native-art" src="${embeddedImage(cover.dataUri)}" alt="${e(copy.coverAlt)}" style="${css}"></div><div class="cover-country" data-check-overflow><h1>${e(country)}</h1>${text(countLabel)}</div><div class="cover-quote-space" aria-hidden="true"></div>`);
  }
  if (number === 2) return flow(`<h2>Эта книга принадлежит</h2><div class="owner-space"></div>${text('Если найдёте, пожалуйста, свяжитесь со мной:')}`);
  const frame = bookFrameCopy(book.id);
  // Printing instructions live in the print guide, not inside the book (#2968). A quest volume has no
  // last-page imprint, so its endpaper carries the edition line.
  const imprint = questBook ? text(`${questBook.title}. MeTravel.by, ${editionMonth(edition.editionDate)}. Формат ${input.profile.widthMm}×${input.profile.heightMm} мм.`, 'small') : '';
  if (number === 3) return flow(`<h2>${e(frame.endpaper.heading)}</h2>${text(frame.endpaper.text)}${imprint}`);
  return flow(`<h2>${e(frame.backCover.heading)}</h2>${text(frame.backCover.line)}`);
}
