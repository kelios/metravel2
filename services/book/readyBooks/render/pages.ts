import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import type {PlaceBookStop} from '../../../../types/readyBook';
import type {ReadyBookPage} from '../composition';
import {buildReadyBookPagePlan} from '../composition';
import {embeddedImage, type ReadyBookRenderInput} from './index';
import {renderReadyBookEndMap} from './endMap';
import {bookStyleCopy} from './styleCopy';
import {bookFrameCopy} from './frameCopy';
import {renderThematicFacts, thematicPhotoPlacement} from './thematic';
import {countRu, editionLabel, editionMonth, PLACES} from './counts';
import edition from '../../../../data/travelBooks/edition.json';
export {renderCoverPage} from './cover';

const text = (value: string, className = '') => `<p class="${className}">${e(value)}</p>`;
const content = (value: string, className = '') => `<main class="content ${className}">${value}</main>`;
// Every style uses this vector box (#2949); its 3 mm size is inline because `.checklist-box` CSS exists only in the graphic style sheet.
const graphicCheckbox = '<svg class="checklist-box" viewBox="0 0 12 12" width="3mm" height="3mm" style="vertical-align:-.35mm" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const flow = (value: string) => content(`<div class="flow">${value}</div>`);

function qrLinks(input: ReadyBookRenderInput, stop: PlaceBookStop) {
  const codes = input.qr[stop.id];
  const targets = stop.navigation;
  if (!targets) throw new Error(`Missing verified navigation: ${stop.id}`);
  const links = [{image: codes.map, url: targets.mapUrl, label: 'Место на карте'}, {image: codes.article, url: targets.articleUrl, label: 'Статья на сайте'}];
  if (targets.quest && codes.quest) links.push({image: codes.quest, url: targets.quest.url, label: 'Квест'});
  return `<nav class="qr-row" aria-label="Проверенные ссылки места">${links.map(link => `<a class="qr-link" href="${e(link.url)}"><img class="qr" src="${embeddedImage(link.image)}" alt="QR: ${e(link.label)}" style="width:${codes.sizeMm}mm;height:${codes.sizeMm}mm"><span>${e(link.label)}</span></a>`).join('')}</nav>`;
}

export function renderBodyPage(input: ReadyBookRenderInput, entry: ReadyBookPage, stop?: PlaceBookStop): string {
  const {book, profile} = input;
  const pocket = profile.id === 'pocket-150x100';
  const country = 'sourceContract' in book && book.sourceContract === 'thematic-v1' ? book.title : book.country === 'BY' ? 'Беларусь' : 'Польша';
  const styleCopy = bookStyleCopy(book.visualStyle);
  const thematic = 'sourceContract' in book && book.sourceContract === 'thematic-v1';
  const copy = thematic ? {...styleCopy,
    creditsSource: 'Использованы фотографии из опубликованных путешествий автора MeTravel и предоставленных владельцем архивов. Контекстные виды подписаны отдельно.',
  } : styleCopy;
  // Edition voice lives in data (#2947); only service lines and imprint stay in code.
  const frame = bookFrameCopy(book.id);
  const {kind} = entry;
  if (stop) {
    if (kind === 'destination') {
      // A Cyrillic label may carry the native name in parentheses; a fully Latin local name is printed whole (#2947).
      const localName = stop.localName.trim();
      const nativeName = (/\p{Script=Cyrillic}/u.test(localName) ? localName.match(/\(([^()]+)\)$/)?.[1] ?? localName : localName).trim();
      const subtitle = /\p{Script=Latin}/u.test(nativeName) && !/\p{Script=Cyrillic}/u.test(nativeName) && !stop.title.toLocaleLowerCase('pl').includes(nativeName.toLocaleLowerCase('pl')) ? nativeName : '';
      const asset = input.assets[stop.id];
      const image = asset.dataUri;
      const bounds = asset.artworkBounds ?? {left: 0, top: .04, width: 1, height: .65};
      const nativeWidth = asset.widthPx ?? 1024, nativeHeight = asset.heightPx ?? 1536;
      if ('thematic' in stop) {
        const placement = thematicPhotoPlacement(nativeWidth, nativeHeight, profile.id);
        const photoStyle = `left:${placement.left}mm;top:${placement.top}mm;width:${placement.width}mm;height:${placement.height}mm`;
        const caption = stop.thematic.media.caption;
        return content(`<div class="thematic-photo-wrap" style="${photoStyle}"><img class="thematic-photo" data-thematic-photo="${e(stop.id)}" src="${embeddedImage(image)}" alt="${e(caption)}"></div><div class="place-heading" data-check-overflow><h2>${e(stop.title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div><p class="thematic-caption" data-check-overflow>${e(caption)}</p><div class="thematic-story" data-check-overflow><p>${e(pocket ? stop.text.compact : stop.text.album)}</p> ${renderThematicFacts(stop.thematic)}</div>${qrLinks(input, stop)}`, 'destination-content');
      }
      const scale = Math.min(62 / (nativeWidth * bounds.width), 42 / (nativeHeight * bounds.height));
      const renderedWidth = nativeWidth * scale, renderedHeight = nativeHeight * scale;
      const cropStyle = `width:${renderedWidth}mm;height:${renderedHeight}mm;left:${(62 - renderedWidth * bounds.width) / 2 - bounds.left * renderedWidth}mm;top:${(42 - renderedHeight * bounds.height) / 2 - bounds.top * renderedHeight}mm`;
      const art = pocket ? `<div class="art-crop"><img class="cropped-art" src="${embeddedImage(image)}" alt="${copy.artAlt}: ${e(stop.title)}" style="${cropStyle}"></div>` : `<img class="place-art" src="${embeddedImage(image)}" alt="${copy.artAlt}: ${e(stop.title)}">`;
      return content(`${art}<div class="place-heading" data-check-overflow><h2>${e(stop.title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div><div class="place-story" data-check-overflow>${e(pocket ? stop.text.compact : stop.text.album)}</div>${qrLinks(input, stop)}`, 'destination-content');
    }
    // Intentional blank paper: no printed frame, prompt, rule, header or watermark.
    return content('', kind === 'photo-memory' ? 'personal-photo-space' : 'blank-diary-space');
  }
  if (kind === 'padding' || kind === 'extra-memory') return content('', 'blank-diary-space');
  if (kind === 'title') return flow(`<h1>${e(country)}</h1>${thematic ? '' : text(book.title, 'subtitle')}${text(`${countRu(book.stops.length, PLACES)} · фотодневник`)}${text(frame.subtitle)}${text(frame.epigraph, 'epigraph')}<p class="small">Русский язык · ${profile.widthMm}×${profile.heightMm} мм · ${editionLabel(edition.editionDate)}</p>`);
  if (kind === 'preparation') return flow(`<h2>${e(frame.intro.heading)}</h2>${text(frame.intro.text)} ${text(thematic ? 'Проверьте официальные сообщения и погоду перед выходом. На карте отмечена физическая цель; фотография и исходная точка статьи могут показывать её окрестности. Подпись объясняет различие.' : 'Проверьте актуальные условия посещения. Координаты показывают место из авторского маршрута; отдельный вход может находиться в стороне.')} ${text('Сохраните свободную полосу у переплёта для колец или пружины.', 'small')}`);
  if (kind === 'usage') return flow(`<h2>${e(frame.usage.heading)}</h2>${text(frame.usage.text)} ${text(pocket ? 'Сюда помещается фотография до 100×70 мм.' : 'Свободная область вмещает вертикальную фотографию до 102×152 мм. Горизонтальный кадр можно повернуть.')} ${text('«Место на карте» открывает выбранную точку, «Статья на сайте» — опубликованное путешествие автора. «Квест» появляется только при проверенной связи с этим местом.', 'small')}`);
  const selected = new Set(entry.stopIds);
  if (kind === 'contents') {
    const plan = buildReadyBookPagePlan(book);
    return flow(`<h2>Выбранные места</h2><ol class="contents-list">${book.stops.filter(item => selected.has(item.id)).map(item => `<li><span>${book.stops.findIndex(stop => stop.id === item.id) + 1}. ${e(item.title)}</span><span>${plan.find(page => page.kind === 'destination' && page.stopId === item.id)!.number}</span></li>`).join('')}</ol>`);
  }
  if (kind === 'map') return flow(`<h2>Места этой книги на карте</h2>${renderReadyBookEndMap(book, profile)}${text('Номера соответствуют списку мест на предыдущих страницах. Для точной навигации откройте QR выбранного места.', 'small')}`);
  if (kind === 'checklist') {
    const destinations = new Map(buildReadyBookPagePlan(book).filter(page => page.kind === 'destination').map(page => [page.stopId, page.number]));
    return flow(`<h2>Места на карте</h2>${text('Номер · место · страница', 'small')}<ol class="contents-list">${book.stops.filter(item => selected.has(item.id)).map(item => `<li><span>${graphicCheckbox} ${book.stops.findIndex(stop => stop.id === item.id) + 1}. ${e(item.title)}</span><span>${destinations.get(item.id)}</span></li>`).join('')}</ol>`);
  }
  return flow(`<h2>${e(frame.outro.heading)}</h2>${text(frame.outro.text)}${text(`MeTravel · ${book.title} · издание: ${editionMonth(edition.editionDate)}.`)}${text(copy.creditsSource)} ${text(copy.creditsFont)}`);
}

