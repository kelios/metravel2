import {printQuestLabel} from './labels';
import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import {projectCanvasMapPoint, type CanvasMapViewport} from '../../../../utils/mapSnapshot/viewport';
import {placeMapLabels, mapLabelDistance, MAP_DOT_RADIUS_MM} from '../render/mapLabels';
import type {QuestBookEntry} from '../../../../types/questBook';

export function buildQuestRouteMapModel(quest: Pick<QuestBookEntry, 'points'>, viewport: CanvasMapViewport, widthMm: number, heightMm: number, fontSizePt = 10.5) {
  if (Math.abs(viewport.width / viewport.height - widthMm / heightMm) > .001) throw new Error('Map raster and physical viewport must have the same aspect ratio');
  const geometry = {widthMm, heightMm, labelRadiusMm: fontSizePt >= 10 ? 3 : 2.7};
  const markers = quest.points.map((point, index) => {
    const pixels = projectCanvasMapPoint(viewport, point.lat, point.lng);
    return {x: pixels.x / viewport.width * widthMm, y: pixels.y / viewport.height * heightMm,
      stopId: point.stepId, ordinal: index + 1, title: point.title, label: {x: 0, y: 0}};
  });
  placeMapLabels(markers, geometry);
  return {...geometry, fontSizePt, markers};
}

/** Native geographic basemap plus physically sized vector labels, with no invented walking line. */
export function renderQuestRouteMapSvg(quest: Pick<QuestBookEntry, 'points' | 'title'>, basemapDataUri: string, viewport: CanvasMapViewport, widthMm: number, heightMm: number, fontSizePt = 10.5): string {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(basemapDataUri)) throw new Error('Map requires verified embedded PNG bytes');
  const model = buildQuestRouteMapModel(quest, viewport, widthMm, heightMm, fontSizePt);
  const number = (value: number) => String(Number(value.toFixed(4)));
  const fontMm = fontSizePt * 25.4 / 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="quest-route-map" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" role="img" aria-label="Карта всех ${quest.points.length} точек: ${e(printQuestLabel(quest.title))}" data-label-font-pt="${fontSizePt}"><image href="${basemapDataUri}" x="0" y="0" width="${widthMm}" height="${heightMm}"/>${model.markers.filter(marker => mapLabelDistance(marker, marker.label) > .1).map(marker => `<line x1="${number(marker.x)}" y1="${number(marker.y)}" x2="${number(marker.label.x)}" y2="${number(marker.label.y)}" stroke="#31443d" stroke-width=".25"/>`).join('')}${model.markers.map(marker => `<circle cx="${number(marker.x)}" cy="${number(marker.y)}" r="${MAP_DOT_RADIUS_MM}" fill="#31443d"/>`).join('')}${model.markers.map(marker => `<g data-point-id="${e(marker.stopId)}" data-ordinal="${marker.ordinal}"><title>${marker.ordinal}. ${e(printQuestLabel(marker.title))}</title><circle cx="${number(marker.label.x)}" cy="${number(marker.label.y)}" r="${model.labelRadiusMm}" fill="#fffefa" stroke="#4a6655" stroke-width=".25"/><text x="${number(marker.label.x)}" y="${number(marker.label.y + fontMm * .32)}" text-anchor="middle" font-family="BookHand" font-size="${number(fontMm)}">${marker.ordinal}</text></g>`).join('')}</svg>`;
}
