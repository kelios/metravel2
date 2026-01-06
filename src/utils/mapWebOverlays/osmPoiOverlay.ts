import type { BBox } from '@/src/utils/overpass';
import {
  bboxAreaKm2,
  fetchOsmPoi,
  overpassToPoints,
  type OsmPoiCategory,
  type OSMPointFeature,
} from '@/src/utils/overpass';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type LeafletMap = any;

export type OsmPoiOverlayOptions = {
  maxAreaKm2?: number;
  debounceMs?: number;
  categories?: OsmPoiCategory[];
};

const defaultOpts = {
  maxAreaKm2: 2500,
  debounceMs: 650,
} as const;

export const attachOsmPoiOverlay = (L: any, map: LeafletMap, opts?: OsmPoiOverlayOptions) => {
  const options: Required<Pick<OsmPoiOverlayOptions, 'maxAreaKm2' | 'debounceMs'>> & Pick<OsmPoiOverlayOptions, 'categories'> = {
    ...defaultOpts,
    ...(opts || {}),
  };

  const layerGroup = L.layerGroup();

  let abort: AbortController | null = null;
  let timer: any = null;
  let lastKey: string | null = null;
  let isLoading = false;
  let nextAllowedAt = 0;
  let backoffMs = 0;
  let selectedCategories: OsmPoiCategory[] | undefined = Array.isArray(options.categories)
    ? options.categories
    : undefined;

  const makeBBox = (): BBox => {
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return {
      south: sw.lat,
      west: sw.lng,
      north: ne.lat,
      east: ne.lng,
    };
  };

  const shrinkBBoxToMaxArea = (bbox: BBox, maxAreaKm2: number): BBox => {
    const area = bboxAreaKm2(bbox);
    if (!(area > maxAreaKm2)) return bbox;

    const factor = Math.sqrt(maxAreaKm2 / area);

    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLng = (bbox.east + bbox.west) / 2;
    const halfLat = Math.abs(bbox.north - bbox.south) / 2;
    const halfLng = Math.abs(bbox.east - bbox.west) / 2;

    const nextHalfLat = halfLat * factor;
    const nextHalfLng = halfLng * factor;

    return {
      south: centerLat - nextHalfLat,
      west: centerLng - nextHalfLng,
      north: centerLat + nextHalfLat,
      east: centerLng + nextHalfLng,
    };
  };

  const keyFromBBox = (bbox: BBox) => {
    const r = (n: number) => Math.round(n * 100) / 100;
    return `${r(bbox.south)}|${r(bbox.west)}|${r(bbox.north)}|${r(bbox.east)}`;
  };

  const escapeHtml = (s: string) =>
    (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const escapeAttr = (s: string) => escapeHtml(s).replace(/`/g, '');

  const getCategory = (tags: Record<string, string>) => {
    const tourism = tags.tourism;
    const amenity = tags.amenity;
    const historic = tags.historic;

    if (tourism === 'museum') return 'Культура';
    if (tourism === 'viewpoint') return 'Видовые места';
    if (tourism === 'zoo' || tourism === 'theme_park') return 'Развлечения';
    if (amenity === 'place_of_worship') return 'Религия';
    if (historic) return 'История';
    if (tourism === 'attraction') return 'Достопримечательности';

    return 'Достопримечательности';
  };

  const getTypeLabel = (tags: Record<string, string>) => {
    const tourism = tags.tourism;
    const amenity = tags.amenity;
    const historic = tags.historic;

    if (tourism === 'museum') return 'Музей';
    if (tourism === 'viewpoint') return 'Смотровая площадка';
    if (tourism === 'zoo') return 'Зоопарк';
    if (tourism === 'theme_park') return 'Парк развлечений';
    if (tourism === 'attraction') return 'Достопримечательность';
    if (amenity === 'place_of_worship') return 'Храм';

    if (historic === 'castle') return 'Замок';
    if (historic === 'manor') return 'Усадьба';
    if (historic === 'fort') return 'Форт';
    if (historic === 'memorial') return 'Мемориал';
    if (historic === 'monument') return 'Памятник';
    if (historic === 'ruins') return 'Руины';
    if (historic === 'archaeological_site') return 'Археологический памятник';

    return tourism || historic || amenity || 'Точка на карте';
  };

  const getMarkerColors = (category: string) => {
    if (category === 'История') return { stroke: DESIGN_TOKENS.colors.accentDark, fill: DESIGN_TOKENS.colors.accentLight };
    if (category === 'Культура') return { stroke: DESIGN_TOKENS.colors.infoDark, fill: DESIGN_TOKENS.colors.infoLight };
    if (category === 'Видовые места') return { stroke: DESIGN_TOKENS.colors.successDark, fill: DESIGN_TOKENS.colors.successLight };
    if (category === 'Религия') return { stroke: DESIGN_TOKENS.colors.warningDark, fill: DESIGN_TOKENS.colors.warningLight };
    if (category === 'Развлечения') return { stroke: DESIGN_TOKENS.colors.dangerDark, fill: DESIGN_TOKENS.colors.dangerLight };
    // Default category ("Достопримечательности")
    return { stroke: DESIGN_TOKENS.colors.warningDark, fill: DESIGN_TOKENS.colors.warningLight };
  };

  const getBadgeColors = (category: string) => {
    if (category === 'История') return { bg: DESIGN_TOKENS.colors.accentSoft, fg: DESIGN_TOKENS.colors.accentDark };
    if (category === 'Культура') return { bg: DESIGN_TOKENS.colors.infoSoft, fg: DESIGN_TOKENS.colors.infoDark };
    if (category === 'Видовые места') return { bg: DESIGN_TOKENS.colors.successSoft, fg: DESIGN_TOKENS.colors.successDark };
    if (category === 'Религия') return { bg: DESIGN_TOKENS.colors.warningSoft, fg: DESIGN_TOKENS.colors.warningDark };
    if (category === 'Развлечения') return { bg: DESIGN_TOKENS.colors.dangerSoft, fg: DESIGN_TOKENS.colors.dangerDark };
    return { bg: DESIGN_TOKENS.colors.surfaceMuted, fg: DESIGN_TOKENS.colors.text };
  };

  const getMarkerSizingByZoom = (zoom: number) => {
    if (zoom >= 16) return { outerRadius: 9, innerRadius: 6, outerWeight: 2, innerWeight: 2 };
    if (zoom >= 14) return { outerRadius: 8, innerRadius: 5.5, outerWeight: 2, innerWeight: 2 };
    if (zoom >= 12) return { outerRadius: 7, innerRadius: 5, outerWeight: 2, innerWeight: 2 };
    return { outerRadius: 6, innerRadius: 4.5, outerWeight: 2, innerWeight: 2 };
  };

  const renderPoints = (points: OSMPointFeature[]) => {
    layerGroup.clearLayers();

    const zoom = typeof map?.getZoom === 'function' ? Number(map.getZoom()) : 14;
    const sizing = getMarkerSizingByZoom(Number.isFinite(zoom) ? zoom : 14);

    for (const p of points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;

      const category = getCategory(p.tags);
      const typeLabel = getTypeLabel(p.tags);
      const markerColors = getMarkerColors(category);
      const badgeColors = getBadgeColors(category);

      let marker: any = null;
      try {
        const outer = L.circleMarker([p.lat, p.lng], {
          radius: sizing.outerRadius,
          color: DESIGN_TOKENS.colors.surface,
          weight: sizing.outerWeight,
          fillColor: DESIGN_TOKENS.colors.surface,
          fillOpacity: 0.95,
        });

        const inner = L.circleMarker([p.lat, p.lng], {
          radius: sizing.innerRadius,
          color: markerColors.stroke,
          weight: sizing.innerWeight,
          fillColor: markerColors.fill,
          fillOpacity: 0.9,
        });

        marker = L.featureGroup([outer, inner]);
      } catch (e: any) {
        console.warn('[OSM POI Overlay] Invalid marker coordinates, skipping:', {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.title,
          error: e?.message || e,
        });
        continue;
      }

      const website = p.tags.website || p.tags.url || '';
      const wikidata = p.tags.wikidata || '';
      const wikipedia = p.tags.wikipedia || '';

      const desc =
        p.tags['description:ru'] ||
        p.tags.description ||
        p.tags['note:ru'] ||
        p.tags.note ||
        '';
      const shortDesc = desc && desc.length > 220 ? `${desc.slice(0, 220)}…` : desc;

      const wikiUrl = wikipedia
        ? `https://wikipedia.org/wiki/${encodeURIComponent(wikipedia.includes(':') ? wikipedia.split(':').slice(1).join(':') : wikipedia)}`
        : '';
      const wikidataUrl = wikidata ? `https://www.wikidata.org/wiki/${encodeURIComponent(wikidata)}` : '';

      const buttons: string[] = [];
      if (website) {
        buttons.push(
          `<a href="${escapeAttr(website)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 10px;border-radius:10px;border:1px solid ${escapeAttr(DESIGN_TOKENS.colors.border)};color:${escapeAttr(DESIGN_TOKENS.colors.text)};background:${escapeAttr(DESIGN_TOKENS.colors.surface)};text-decoration:none;font-weight:600">Сайт</a>`,
        );
      }
      if (wikiUrl) {
        buttons.push(
          `<a href="${escapeAttr(wikiUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 10px;border-radius:10px;border:1px solid ${escapeAttr(DESIGN_TOKENS.colors.border)};color:${escapeAttr(DESIGN_TOKENS.colors.text)};background:${escapeAttr(DESIGN_TOKENS.colors.surface)};text-decoration:none;font-weight:600">Wikipedia</a>`,
        );
      } else if (wikidataUrl) {
        buttons.push(
          `<a href="${escapeAttr(wikidataUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 10px;border-radius:10px;border:1px solid ${escapeAttr(DESIGN_TOKENS.colors.border)};color:${escapeAttr(DESIGN_TOKENS.colors.text)};background:${escapeAttr(DESIGN_TOKENS.colors.surface)};text-decoration:none;font-weight:600">Wikidata</a>`,
        );
      }
      if (p.osmUrl) {
        buttons.push(
          `<a href="${escapeAttr(p.osmUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 10px;border-radius:10px;border:1px solid ${escapeAttr(DESIGN_TOKENS.colors.border)};color:${escapeAttr(DESIGN_TOKENS.colors.text)};background:${escapeAttr(DESIGN_TOKENS.colors.surface)};text-decoration:none;font-weight:600">OpenStreetMap</a>`,
        );
      }

      const html = `
        <div style="max-width:320px">
          <div style="background:${escapeAttr(DESIGN_TOKENS.colors.surface)};border:1px solid ${escapeAttr(DESIGN_TOKENS.colors.borderLight)};border-radius:14px;padding:12px 12px 10px 12px;box-shadow:${escapeAttr(DESIGN_TOKENS.shadows.light)}">
            <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between">
              <div style="min-width:0">
                <div style="font-weight:800;line-height:1.2;font-size:14px;color:${escapeAttr(DESIGN_TOKENS.colors.text)};word-break:break-word">${escapeHtml(p.title)}</div>
                <div style="margin-top:4px;font-size:12px;line-height:1.3;color:${escapeAttr(DESIGN_TOKENS.colors.textMuted)}">${escapeHtml(typeLabel)}</div>
              </div>
              <div style="white-space:nowrap;align-self:flex-start;padding:4px 10px;border-radius:999px;background:${badgeColors.bg};color:${badgeColors.fg};font-size:12px;font-weight:800;line-height:1">${escapeHtml(category)}</div>
            </div>

            ${shortDesc ? `<div style="margin-top:8px;font-size:12px;line-height:1.35;color:${escapeAttr(DESIGN_TOKENS.colors.text)};opacity:0.92;word-break:break-word">${escapeHtml(shortDesc)}</div>` : ''}

            ${buttons.length ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">${buttons
              .map(
                (b) =>
                  b.replace(
                    'padding:6px 10px',
                    'padding:8px 12px'
                  ).replace(
                    'border-radius:10px',
                    'border-radius:999px'
                  ).replace(
                    'font-weight:600',
                    'font-weight:800;font-size:12px;line-height:1'
                  ),
              )
              .join('')}</div>` : ''}

            <div style="margin-top:${buttons.length ? '10px' : '8px'};padding-top:10px;border-top:1px solid ${escapeAttr(DESIGN_TOKENS.colors.borderLight)};font-size:11px;line-height:1.2;color:${escapeAttr(DESIGN_TOKENS.colors.textSubtle)}">Источник: OpenStreetMap</div>
          </div>
        </div>
      `;

      try {
        marker.bindPopup(html);
        marker.addTo(layerGroup);
      } catch (e: any) {
        console.warn('[OSM POI Overlay] Failed to add marker, skipping:', {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.title,
          error: e?.message || e,
        });
      }
    }
  };

  const load = async () => {
    if (!map || !L) return;

    // Avoid spamming Overpass when users pan/zoom rapidly.
    if (isLoading) return;
    const now = Date.now();
    if (now < nextAllowedAt) return;

    const bbox = shrinkBBoxToMaxArea(makeBBox(), options.maxAreaKm2);

    const key = keyFromBBox(bbox);
    if (key === lastKey) return;
    lastKey = key;

    abort?.abort();
    abort = new AbortController();

    isLoading = true;

    try {
      const data = await fetchOsmPoi(bbox, { signal: abort.signal, categories: selectedCategories });
      const pts = overpassToPoints(data);
      renderPoints(pts);

      // Successful call: reset backoff and allow subsequent loads relatively soon.
      backoffMs = 0;
      nextAllowedAt = Date.now() + 800;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;

      const msg = String(e?.message || '').toLowerCase();
      const isRateLimited = msg.includes('429') || msg.includes('too many requests');
      const isTimeoutish = msg.includes('timeout') || msg.includes('too busy');

      // Exponential backoff on rate limit / busy errors.
      if (isRateLimited || isTimeoutish) {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, 30000) : 2000;
        nextAllowedAt = Date.now() + backoffMs;
      } else {
        nextAllowedAt = Date.now() + 1500;
      }

      if (isTimeoutish || isRateLimited) {
        console.warn('[OSM POI Overlay] Overpass API is busy, skipping load.');
      } else {
        console.warn('[OSM POI Overlay] Failed to load data:', e?.message || e);
      }
      layerGroup.clearLayers();
    } finally {
      isLoading = false;
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    // If we are under cooldown/backoff, delay scheduling accordingly.
    const now = Date.now();
    const delay = Math.max(options.debounceMs, Math.max(0, nextAllowedAt - now));
    timer = setTimeout(load, delay);
  };

  const onMoveEnd = () => schedule();

  const start = () => {
    map.on('moveend', onMoveEnd);
    schedule();
  };

  const stop = () => {
    map.off('moveend', onMoveEnd);
    abort?.abort();
    abort = null;
    if (timer) clearTimeout(timer);
    timer = null;
    lastKey = null;
    layerGroup.clearLayers();
  };

  const setCategories = (categories?: OsmPoiCategory[]) => {
    selectedCategories = Array.isArray(categories) ? categories : undefined;
    lastKey = null;
    schedule();
  };

  return {
    layer: layerGroup,
    start,
    stop,
    setCategories,
  };
};
