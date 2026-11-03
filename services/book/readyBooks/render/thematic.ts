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

const duration = (minutes: number): string => {
  // Whole minutes first: 59.6 must read «1 ч», not «60 мин»; the schema keeps durations above zero.
  const total = Math.max(1, Math.round(minutes)), hours = Math.floor(total / 60), rest = total % 60;
  return [hours ? `${hours} ч` : '', rest ? `${rest} мин` : ''].filter(Boolean).join(' ');
};
const time = (value: Metric): string => typeof value === 'number' ? duration(value) : `${duration(value.min)} – ${duration(value.max)}`;

/**
 * One guidebook line per route (#2968). Sources, metric caveats, unverified difficulty and dated
 * access notices stay in the verified source record: a printed page outlives any notice.
 */
export function renderThematicFacts(evidence: ThematicEvidence): string {
  const route = evidence.route;
  if (!route) return '';
  // Lora has no «→»/«↑»: Chromium fell back to system LucidaGrande Type 3 (#2949).
  const path = [route.start, ...route.via, route.finish].join(' — ');
  return `<p>${e(`Маршрут: ${path}.`)}</p> <p class="thematic-metrics">${e(`${route.scope}: ${metric(route.distanceKm)} км, набор высоты ${metric(route.elevationGainM)} м, около ${time(route.durationMinutes)}.`)}</p> <p>${e(`Сезон: ${route.seasonality}.`)}</p>`;
}

// Story box fits the approved 100–280 character copy plus route facts (#2947, designer check 02.11.2026).
export const thematicPrintStyles = `
.thematic .place-heading{top:5mm;height:15mm}
.thematic .place-heading h2{font-size:18pt}
.thematic-photo-wrap{position:absolute}
.thematic-photo{display:block;width:100%;height:100%;max-width:none}
.thematic-caption{position:absolute;left:15mm;top:44mm;width:58mm;height:12mm;font-size:9pt;line-height:1.1;text-align:left}
.thematic-story{position:absolute;left:15mm;right:15mm;top:57mm;height:38mm;font-size:8.5pt;line-height:1.1;text-align:left}
.thematic-story p+p{margin-top:.5mm}
.thematic-story p{display:inline;margin:0}
.thematic-metrics{font-family:BookHeading,BookHand,serif}
.thematic .qr-row{left:auto;right:15mm;width:60mm;top:21mm;bottom:auto;gap:2mm;justify-content:space-between}
.thematic .qr-link{font-size:8.5pt}
.album-layout.thematic .place-heading{top:10mm;height:21mm}
.album-layout.thematic .place-heading h2{font-size:24pt}
.album-layout.thematic .thematic-caption{left:15mm;top:89mm;width:118mm;height:12mm;font-size:10pt;line-height:1.15;text-align:center}
.album-layout.thematic .thematic-story{left:15mm;right:15mm;top:105mm;height:61mm;font-size:10.5pt;line-height:1.15}
.album-layout.thematic .qr-row{left:15mm;right:15mm;width:auto;top:auto;bottom:9mm;justify-content:space-around}
.album-layout.thematic .qr-link{font-size:10pt}
`;
