import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import type {EditorialStop} from '../../../../types/readyBook';
import type {ReadyBookPage} from '../composition';
import {buildReadyBookPagePlan} from '../composition';
import {embeddedImage, type ReadyBookRenderInput} from './index';
import {renderReadyBookEndMap} from './endMap';
export {renderCoverPage} from './cover';

const text = (value: string, className = '') => `<p class="${className}">${e(value)}</p>`;
const content = (value: string, className = '') => `<main class="content ${className}">${value}</main>`;
const flow = (value: string) => content(`<div class="flow">${value}</div>`);

function qrLinks(input: ReadyBookRenderInput, stop: EditorialStop) {
  const codes = input.qr[stop.id];
  const targets = stop.navigation;
  if (!targets) throw new Error(`Missing verified navigation: ${stop.id}`);
  const links = [{image: codes.map, url: targets.mapUrl, label: 'Место на карте'}, {image: codes.article, url: targets.articleUrl, label: 'Статья на сайте'}];
  if (targets.quest && codes.quest) links.push({image: codes.quest, url: targets.quest.url, label: 'Квест'});
  return `<nav class="qr-row" aria-label="Проверенные ссылки места">${links.map(link => `<a class="qr-link" href="${e(link.url)}"><img class="qr" src="${embeddedImage(link.image)}" alt="QR: ${e(link.label)}" style="width:${codes.sizeMm}mm;height:${codes.sizeMm}mm"><span>${e(link.label)}</span></a>`).join('')}</nav>`;
}

export function renderBodyPage(input: ReadyBookRenderInput, entry: ReadyBookPage, stop?: EditorialStop): string {
  const {book, profile} = input;
  const pocket = profile.id === 'pocket-150x100';
  const country = book.country === 'BY' ? 'Беларусь' : 'Польша';
  const {kind} = entry;
  if (stop) {
    if (kind === 'destination') {
      const nativeName = (stop.localName.trim().match(/\(([^()]+)\)$/)?.[1] ?? stop.localName).trim();
      const subtitle = /\p{Script=Latin}/u.test(nativeName) && !/\p{Script=Cyrillic}/u.test(nativeName) && !stop.title.toLocaleLowerCase('pl').includes(nativeName.toLocaleLowerCase('pl')) ? nativeName : '';
      const asset = input.assets[stop.id];
      const image = asset.dataUri;
      const bounds = asset.artworkBounds ?? {left: 0, top: .04, width: 1, height: .65};
      const nativeWidth = asset.widthPx ?? 1024, nativeHeight = asset.heightPx ?? 1536;
      const scale = Math.min(62 / (nativeWidth * bounds.width), 42 / (nativeHeight * bounds.height));
      const renderedWidth = nativeWidth * scale, renderedHeight = nativeHeight * scale;
      const cropStyle = `width:${renderedWidth}mm;height:${renderedHeight}mm;left:${(62 - renderedWidth * bounds.width) / 2 - bounds.left * renderedWidth}mm;top:${(42 - renderedHeight * bounds.height) / 2 - bounds.top * renderedHeight}mm`;
      const art = pocket ? `<div class="art-crop"><img class="cropped-art" src="${embeddedImage(image)}" alt="Акварель: ${e(stop.title)}" style="${cropStyle}"></div>` : `<img class="place-art" src="${embeddedImage(image)}" alt="Акварель: ${e(stop.title)}">`;
      return content(`${art}<div class="place-heading" data-check-overflow><h2>${e(stop.title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div><div class="place-story" data-check-overflow>${e(pocket ? stop.text.compact : stop.text.album)}</div>${qrLinks(input, stop)}`, 'destination-content');
    }
    // Intentional blank paper: no printed frame, prompt, rule, header or watermark.
    return content('', kind === 'photo-memory' ? 'personal-photo-space' : 'blank-diary-space');
  }
  if (kind === 'padding' || kind === 'extra-memory') return content('', 'blank-diary-space');
  if (kind === 'title') return flow(`<h1>${e(country)}</h1>${text(book.title, 'subtitle')}${text(`${book.stops.length} мест · фотодневник`)}${text('Для самостоятельных поездок, любимых кадров и своих историй.')}<p class="small">Русский язык · ${profile.widthMm}×${profile.heightMm} мм · ${e(book.revision)}</p>${text(`${input.estimatedMinIllustrationPpi ? `Иллюстрации: около ${input.estimatedMinIllustrationPpi} ppi. ` : ''}Цифровое чтение и пробная печать; бумажный образец и профиль типографии не проверены.`, 'small')}`);
  if (kind === 'preparation') return flow(`<h2>Перед поездкой</h2>${text('Выберите место и откройте статью автора по QR. Точки в книге описывают разные самостоятельные поездки.')} ${text('Проверьте актуальные условия посещения. Координаты показывают место из авторского маршрута; отдельный вход может находиться в стороне.')} ${text('Сохраните свободную полосу у переплёта для колец или пружины.', 'small')}`);
  if (kind === 'usage') return flow(`<h2>Место для вашей истории</h2>${text('У каждого места три страницы: акварель и короткий рассказ, свободное место для собственного снимка и чистая страница для записей.')} ${text(pocket ? 'Сюда помещается фотография до 100×70 мм.' : 'Свободная область вмещает вертикальную фотографию до 102×152 мм. Горизонтальный кадр можно повернуть.')} ${text('«Место на карте» открывает выбранную точку, «Статья на сайте» — опубликованное путешествие автора. «Квест» появляется только при проверенной связи с этим местом.', 'small')}`);
  const selected = new Set(entry.stopIds);
  if (kind === 'contents') {
    const plan = buildReadyBookPagePlan(book);
    return flow(`<h2>Выбранные места</h2><ol class="contents-list">${book.stops.filter(item => selected.has(item.id)).map(item => `<li><span>${book.stops.indexOf(item) + 1}. ${e(item.title)}</span><span>${plan.find(page => page.kind === 'destination' && page.stopId === item.id)!.number}</span></li>`).join('')}</ol>`);
  }
  if (kind === 'map') return flow(`<h2>Места этой книги на карте</h2>${renderReadyBookEndMap(book, profile)}${text('Номера соответствуют списку мест на предыдущих страницах. Для точной навигации откройте QR выбранного места.', 'small')}`);
  if (kind === 'checklist') {
    const destinations = new Map(buildReadyBookPagePlan(book).filter(page => page.kind === 'destination').map(page => [page.stopId, page.number]));
    return flow(`<h2>Места на карте</h2>${text('Номер · место · страница', 'small')}<ol class="contents-list">${book.stops.filter(item => selected.has(item.id)).map(item => `<li><span>□ ${book.stops.indexOf(item) + 1}. ${e(item.title)}</span><span>${destinations.get(item.id)}</span></li>`).join('')}</ol>`);
  }
  return flow(`<h2>Об этой книге</h2>${text(`MeTravel · ${book.title} · редакция ${book.revision}.`)}${text('Основой акварелей стали фотографии автора опубликованных путешествий MeTravel. Источники и происхождение производных изображений сохранены в реестре издания.')} ${text('Marck Script — Denis Masharov, SIL Open Font License 1.1. Русский язык.')} ${text('Файлы подготовлены для цифрового чтения и пробной печати. Профиль типографии и бумажный образец проверяются отдельно.', 'small')}`);
}

