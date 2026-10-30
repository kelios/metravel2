import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import type {EditorialStop} from '../../../../types/readyBook';
import {embeddedImage, type ReadyBookRenderInput} from './index';
import {formatNumber} from '../../../../i18n/format';

const text = (value: string, className = '') => `<p class="${className}">${e(value)}</p>`;
const lines = (height = 24) => `<div class="lines" style="height:${height}mm"></div>`;
const content = (value: string, className = '') => `<main class="content ${className}">${value}</main>`;
const flow = (value: string) => content(`<div class="flow">${value}</div>`);

/** A measured build may move additional whole words from story into the explicit continuation. */
export function splitStory(value: string, pocket: boolean) {
  const budget = pocket ? 385 : 730;
  if (value.length <= budget) return [value, ''];
  const offset = value.lastIndexOf(' ', budget);
  return [value.slice(0, offset), value.slice(offset + 1)];
}

function map(input: ReadyBookRenderInput) {
  const stops = input.book.stops;
  const lats = stops.map(stop => stop.lat), lngs = stops.map(stop => stop.lng);
  const bounds = {minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs)};
  const points = stops.map((stop, index) => {
    const x = 8 + (stop.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1) * 104;
    const y = 8 + (bounds.maxLat - stop.lat) / (bounds.maxLat - bounds.minLat || 1) * 64;
    return `<g><circle cx="${x}" cy="${y}" r="2.8" fill="white" stroke="currentColor"/><text x="${x}" y="${y + 1}" text-anchor="middle" font-size="3" font-family="BookSans">${index + 1}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="map" viewBox="0 0 120 80" role="img" aria-label="Схема расположения двенадцати мест"><rect x="1" y="1" width="118" height="78" fill="none" stroke="#bdc7be"/>${points}<text x="3" y="77" font-size="3" font-family="BookSans">Север ↑ · номера соответствуют содержанию</text></svg>`;
}

function credit(input: ReadyBookRenderInput, stop: EditorialStop) {
  const asset = input.assets[stop.id];
  const sourceAlreadyPrinted = stop.natureRoute && [stop.natureRoute.metricsSourceUrl, stop.natureRoute.officialAlertsUrl].includes(stop.source.url);
  const source = sourceAlreadyPrinted ? '' : `<p>История и посещение: <a href="${e(stop.source.url)}">${e(stop.source.url.replace('https://', ''))}</a></p>`;
  return `<div class="collage-credit" data-check-overflow><p>${asset.illustrated ? 'Иллюстрация' : 'Фото'}: ${e(asset.credit)} · ${e(asset.rights)}</p><p><a href="${e(asset.sourceUrl)}">${e(asset.sourceUrl.replace('https://', ''))}</a></p>${asset.licenseUrl ? `<p><a href="${e(asset.licenseUrl)}">${e(asset.licenseUrl.replace('https://', ''))}</a></p>` : ''}${text('Пропорциональное уменьшение; без обрезки.')}${source}</div>`;
}

function natureRoute(stop: EditorialStop) {
  const route = stop.natureRoute;
  if (!route) return '';
  const direction = {loop: 'круговой маршрут', 'round-trip': 'туда и обратно', 'one-way': 'в одну сторону; обратный путь добавляется'}[route.direction];
  const distance = formatNumber(route.distanceKm, {style: 'unit', unit: 'kilometer', unitDisplay: 'short', maximumFractionDigits: 2}, 'ru');
  const ascent = route.elevationGainM === null ? 'не подтверждён' : formatNumber(route.elevationGainM, {style: 'unit', unit: 'meter', unitDisplay: 'short'}, 'ru');
  const duration = formatNumber(route.durationMinutes, {style: 'unit', unit: 'minute', unitDisplay: 'short'}, 'ru');
  return `<div class="route-details" data-check-overflow>${text(route.name)}${text(`${distance} · набор ${ascent} · ${duration} · ${direction}.`)}${text(route.difficulty)}${text(route.seasonality)}<p class="small"><a href="${e(route.officialAlertsUrl)}">Предупреждения: ${e(route.officialAlertsUrl.replace('https://', ''))}</a><br><a href="${e(route.metricsSourceUrl)}">Источник маршрута: ${e(route.metricsSourceUrl.replace('https://', ''))}</a></p></div>`;
}

export function renderBodyPage(input: ReadyBookRenderInput, kind: string, stop?: EditorialStop): string {
  const {book, profile} = input;
  const pocket = profile.id === 'pocket-150x100';
  const country = book.country === 'BY' ? 'Беларусь' : 'Польша';
  if (stop) {
    const index = book.stops.indexOf(stop);
    const [story, continuation] = splitStory(pocket ? stop.text.compact : stop.text.album, pocket);
    const coords = `${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`;
    if (kind === 'destination') {
      return content(`<h2 class="place-title" data-check-overflow>${e(stop.title)}<small>${index + 1} / 12 · ${e(stop.localName)}</small></h2><img class="place-image" src="${embeddedImage(input.assets[stop.id].dataUri)}" alt="${e(stop.title)}"><div class="place-story" data-story="${e(stop.id)}" data-check-overflow>${e(story)}</div><p class="coords">${e(coords)} · ${e(stop.coordinateAccuracy === 'entrance' ? 'вход' : stop.coordinateAccuracy === 'approach' ? 'ориентир подхода' : 'центр объекта')} · продолжение и навигация на стр. ${8 + 4 * index}</p>`);
    }
    if (kind === 'photo-memory') {
      return content(`<div class="photo-frame">Мой кадр · ${pocket ? 'до 100×70' : 'до 102×152'} мм</div><p class="photo-caption">Подпись к фотографии __________________________________</p>`);
    }
    if (kind === 'notes') {
      return content(`<div class="notes-facts" data-check-overflow>${continuation ? `<p class="continuation" data-continuation="${e(stop.id)}">${e(continuation)}</p>` : `<p class="continuation" data-continuation="${e(stop.id)}"></p>`}<div class="qr-row"><img class="qr" src="${embeddedImage(input.qr[stop.id])}" alt="QR: официальный источник"><div>${text(coords)}${text(stop.entrance)}${text('QR: официальный источник', 'small')}</div></div>${text(`Факт. ${stop.fact}`)}${stop.legend ? text(`${stop.legend.label}. ${stop.legend.text}`) : ''}${text(`Заметьте. ${stop.observation}`)}</div>${text('Мои впечатления · что удивило / что посоветую', 'small')}${lines(pocket ? 8 : 70)}`);
    }
    return content(`<h3>${stop.natureRoute ? 'Маршрут и условия' : 'Билет, открытка, ещё один кадр'}</h3><div class="gap"></div>${stop.natureRoute ? natureRoute(stop) : `<div class="collage-space">${pocket ? 'Минифото и билет. Обычная открытка — отдельным вкладышем.' : 'Место для вклейки. Сохраняйте полосу крепления свободной.'}</div>`}${credit(input, stop)}`, stop.natureRoute ? 'nature-collage' : '');
  }
  if (kind === 'title') return flow(`<h1>${e(country)}</h1>${text(book.title, 'subtitle')}<h3>12 мест · книга воспоминаний</h3>${text('Для самостоятельных поездок, любимых кадров и историй, которые хочется сохранить.')}<p class="small">Русский язык · ${profile.widthMm}×${profile.heightMm} мм · ${e(book.revision)}</p>${text('Моя книга __________________________')}`);
  if (kind === 'preparation') return flow(`<h2>Перед поездкой</h2>${text('Выберите одну из самостоятельных поездок. Эта книга не предлагает проехать все места подряд.')}<ul>${book.miniTrips.map(trip => `<li><strong>${e(trip.title)}</strong> · ${trip.stopIds.map(id => book.stops.findIndex(stop => stop.id === id) + 1).join(', ')}</li>`).join('')}</ul>${text('Проверьте доступ и предупреждения на официальном сайте. Часы и цены могут измениться. Оставьте место для своих открытий.', 'small')}`);
  if (kind === 'usage') return flow(`<h2>Как сохранить поездку</h2>${text('Слева — место и его история. Справа — ваш кадр. Следующий разворот оставлен для заметок и небольших находок.')}<ul><li>Запишите дату и тех, кто был рядом.</li><li>Вклейте фотографию, сохраняя свободную полосу для колец.</li><li>Отметьте то, чего нет в путеводителях: запах, звук, разговор.</li></ul>${text(pocket ? 'Минифото до 100×70 мм; фотография 10×15 сюда целиком не помещается.' : 'Рамка 108×158 мм подходит для отпечатка до 102×152 мм. Горизонтальный кадр поверните.')}<p class="small">Печатайте в масштабе 100%. Для дома используйте отдельную готовую раскладку A4. Типография проверяет свой профиль файла.</p>`);
  if (kind === 'contents') return flow(`<h2>Двенадцать мест</h2><ol class="contents-list">${book.stops.map((item, index) => `<li>${index + 1}. ${e(item.title)} · ${6 + 4 * index}</li>`).join('')}</ol><p class="small">Номера — страницы истории места. Карта на следующей странице показывает расположение без непрерывного маршрута.</p>`);
  if (kind === 'map') return flow(`<h2>Места на карте</h2>${map(input)}<p class="small">Схема по координатам; не навигационная карта и не описание безопасного пути. Номера — из содержания. Ориентиры входа указаны у каждого места.</p>`);
  if (kind === 'checklist') return flow(`<h2>Мои двенадцать мест</h2><ol class="contents-list">${book.stops.map(item => `<li>□ ${e(item.title)} __________</li>`).join('')}</ol>${text('Куда хочу вернуться ______________________', 'small')}`);
  if (kind === 'credits') return flow(`<h2>Об этой книге</h2>${text(`MeTravel · ${book.title} · редакция ${book.revision}.`)}${text('Источники истории и атрибуция фотографий напечатаны в каждом блоке места. Изображения распространяются по указанным там лицензиям; они не меняют права на остальные материалы сборника.')}<p class="small">Noto Sans / Noto Serif — The Noto Project Authors, SIL Open Font License 1.1. Декоративная обложка — MeTravel / OpenAI, AI-иллюстрация серии, не изображение конкретного памятника.</p>${text('Условия посещения и состояние маршрутов меняются. Перед поездкой откройте официальный источник по QR. Схема в книге не заменяет навигацию.', 'small')}<p>metravel.by · русский язык · RGB</p>`);
  return flow(`<h2>Ещё одно воспоминание</h2>${text('Что было самым неожиданным? Какой момент хочется повторить?')}${lines(pocket ? 42 : 140)}`);
}

export function renderCoverPage(input: ReadyBookRenderInput, number: number) {
  const {book, cover, profile} = input;
  const country = book.country === 'BY' ? 'Беларусь' : 'Польша';
  if (number === 1) return flow(`<h1>${country}</h1><img class="cover-art" src="${embeddedImage(cover.dataUri)}" alt="Декоративная AI-иллюстрация серии"><h3>12 мест · книга воспоминаний</h3><p class="small">MeTravel · RU · ${profile.widthMm}×${profile.heightMm} мм</p>`);
  if (number === 2) return flow(`<h2>Эта книга принадлежит</h2>${lines(24)}${text('Если найдёте, пожалуйста, свяжитесь со мной:')}${lines(18)}<p class="small">Поля заполняются владельцем вручную.</p>`);
  if (number === 3) return flow(`<h2>Знаки в книге</h2>${text('QR — официальный источник. Координаты — ориентир, уточнение входа напечатано рядом. Квадрат — место, где я побывал. Линейки — мои слова.')}<h3>Сохраните свободное место</h3>${text('Изображения, вклейки и записи не должны заходить на полосу крепления. Не заполняйте книгу чужими личными данными без согласия.')}`);
  return flow(`<h2>Путешествие продолжается</h2>${text('Откройте знакомый город заново. Оставьте место для следующей поездки.')}<div class="small" data-check-overflow>${text(cover.credit)}${text(cover.rights)}${text('Декоративная AI-иллюстрация: не изображение конкретного памятника или маршрута.')}<p>${e(cover.sourceUrl)}</p></div><p class="small">MeTravel · metravel.by · ${e(book.revision)} · RGB; профиль типографии проверяется отдельно.</p>`);
}
