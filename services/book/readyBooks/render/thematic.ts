import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import type {ThematicEvidence} from '../../../../data/travelBooks/schema/thematic';
import {formatNumber} from '../../../../i18n/format';

type Metric = number | {min: number; max: number};
const metric = (value: Metric): string => typeof value === 'number'
  ? formatNumber(value, {maximumFractionDigits: 2}, 'ru')
  : `${metric(value.min)}–${metric(value.max)}`;

/** Native photo bounds are shared with the source adapter's resolution evidence. */
export function thematicPhotoPlacement(widthPx: number, heightPx: number, profileId: string) {
  const box = profileId === 'pocket-150x100'
    ? {left: 15, top: 21, width: 58, height: 22}
    : {left: 15, top: 34, width: 118, height: 53};
  const scale = Math.min(box.width / widthPx, box.height / heightPx);
  const width = widthPx * scale, height = heightPx * scale;
  return {left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height,
    effectivePpi: Math.min(widthPx / width, heightPx / height) * 25.4};
}

/** Full source URLs/provenance stay in the verified source record. */
export function renderThematicFacts(evidence: ThematicEvidence): string {
  const route = evidence.route;
  if (!route) return '';
  const reference = route.routeUse === 'itinerary-reference' ? 'Маршрут-справка' : 'Маршрут';
  // Lora has no «→»/«↑»: Chromium fell back to system LucidaGrande Type 3 (#2949).
  const path = [route.start, ...route.via, route.finish].join(' — ');
  const parts = [
    `${reference}${route.routeDate ? ` (${route.routeDate})` : ''}: ${path}. ${route.scope}.`,
    `${metric(route.distanceKm)} км · набор высоты ${metric(route.elevationGainM)} м · ${metric(route.durationMinutes)} мин.`,
    route.metricNote,
    `Сложность: ${route.difficulty}. Сезон: ${route.seasonality}.`,
    `Доступ (${route.availability.checkedOn}): ${route.availability.note}`,
  ];
  const link = (url: string, label: string) => `<a href="${e(url)}">${e(label)}</a>`;
  const sources = route.sourceUrls.map((url,index) => link(url, new URL(url).hostname.replace(/^www\./,'') + (route.sourceUrls.length>1 ? ` ${index+1}` : ''))).join(', ');
  const authority = route.availability.authorityUrl;
  const role = {"author-estimate":"Оценка автора","official":"Официальные данные","provider-estimate":"Оценка провайдера","gpx-measurement":"Расчёт по GPX","historical-provider":"Исторический источник","mixed":"Смешанные источники"}[route.sourceType];
  const links = `<p class="thematic-sources">${role}: ${sources}.${authority ? ` Доступ: ${link(authority,new URL(authority).hostname.replace(/^www\./,''))}.` : ''}</p>`;
  return parts.map((value,index) => `<p${index===1 ? ' class="thematic-metrics"' : ''}>${e(value)}</p>`).join(' ') + ' ' + links;
}

export const thematicPrintStyles = `
.thematic .place-heading{top:5mm;height:15mm}
.thematic .place-heading h2{font-size:18pt}
.thematic-photo-wrap{position:absolute}
.thematic-photo{display:block;width:100%;height:100%;max-width:none}
.thematic-photo-wrap::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,#fffefa,transparent 5%,transparent 95%,#fffefa),linear-gradient(#fffefa,transparent 5%,transparent 95%,#fffefa)}
.thematic-caption{position:absolute;left:15mm;top:44mm;width:58mm;height:12mm;font-size:9pt;line-height:1.1;text-align:left}
.thematic-story{position:absolute;left:15mm;right:15mm;top:57mm;height:38mm;font-size:9pt;line-height:1.1;text-align:left}
.thematic-story p+p{margin-top:.5mm}
.thematic-story p{display:inline;margin:0}
.thematic-metrics{font-family:BookHeading,BookHand,serif}
.thematic-sources a{text-decoration:underline}
.thematic .qr-row{left:auto;right:15mm;width:60mm;top:21mm;bottom:auto;gap:2mm;justify-content:space-between}
.thematic .qr-link{font-size:8.5pt}
.album-layout.thematic .place-heading{top:10mm;height:21mm}
.album-layout.thematic .place-heading h2{font-size:24pt}
.album-layout.thematic .thematic-caption{left:15mm;top:89mm;width:118mm;height:12mm;font-size:10pt;line-height:1.15;text-align:center}
.album-layout.thematic .thematic-story{left:15mm;right:15mm;top:105mm;height:59mm;font-size:10.5pt;line-height:1.15}
.album-layout.thematic .qr-row{left:15mm;right:15mm;width:auto;top:auto;bottom:9mm;justify-content:space-around}
.album-layout.thematic .qr-link{font-size:10pt}
`;
