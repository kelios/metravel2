import type { ParsedPoint } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';
import type { DocumentPickerAsset } from 'expo-document-picker';

type FileInput = File | DocumentPickerAsset;

export class OSMParser {
  static async parse(file: FileInput): Promise<ParsedPoint[]> {
    let text: string;
    let fileName: string;

    // Проверяем тип файла и читаем его соответствующим образом
    if ('text' in file && typeof file.text === 'function') {
      // Web File API
      text = await file.text();
      fileName = file.name;
    } else {
      // React Native DocumentPickerAsset
      const asset = file as DocumentPickerAsset;
      const response = await fetch(asset.uri);
      text = await response.text();
      fileName = asset.name;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'geojson' || extension === 'json') {
      return this.parseGeoJSON(text);
    } else if (extension === 'gpx') {
      return this.parseGPX(text);
    }
    
    throw new Error('Неподдерживаемый формат файла. Используйте GeoJSON или GPX.');
  }

  private static normalizeStatus(input: unknown): PointStatus | null {
    const raw = String(input ?? '').trim();
    if (!raw) return null;

    const allowed = new Set<string>(Object.values(PointStatus));
    if (allowed.has(raw)) return raw as PointStatus;
    return null;
  }

  private static normalizeColor(input: unknown): string | null {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    return raw;
  }
  
  private static parseGeoJSON(text: string): ParsedPoint[] {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Не удалось прочитать GeoJSON файл.');
    }
    const points: ParsedPoint[] = [];
    
    const features = Array.isArray(data?.features) ? data.features : [];
    
    for (const feature of features) {
      const props = feature.properties || {};
      const geometryType = feature.geometry?.type;
      const coords = feature.geometry?.coordinates;
      
      if (geometryType !== 'Point') continue;
      if (!Array.isArray(coords) || coords.length < 2) continue;

      const lat = Number(coords[1]);
      const lng = Number(coords[0]);
      const hasValidCoords =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180;

      if (!hasValidCoords) continue;

      const color =
        this.normalizeColor(props.color) ??
        this.normalizeColor(props['marker-color']) ??
        this.normalizeColor(props.markerColor) ??
        '#2196F3';

      const status = this.normalizeStatus(props.status) ?? PointStatus.PLANNING;
      
      const point: ParsedPoint = {
        id: this.generateId(),
        name: props.name || 'Без названия',
        description: props.description,
        latitude: lat,
        longitude: lng,
        color,
        categoryIds: [],
        status,
        source: 'osm',
        importedAt: new Date().toISOString(),
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static parseGPX(text: string): ParsedPoint[] {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        const waypoints = doc.getElementsByTagName('wpt');
        const points: ParsedPoint[] = [];

        for (let i = 0; i < waypoints.length; i++) {
          const wpt = waypoints[i];
          const latRaw = wpt.getAttribute('lat');
          const lonRaw = wpt.getAttribute('lon');
          if (!latRaw || !lonRaw) continue;

          const lat = parseFloat(latRaw);
          const lon = parseFloat(lonRaw);
          const name = wpt.getElementsByTagName('name')[0]?.textContent || 'Без названия';
          const desc = wpt.getElementsByTagName('desc')[0]?.textContent;
          const statusRaw = wpt.getElementsByTagName('status')[0]?.textContent;
          const colorRaw = wpt.getElementsByTagName('color')[0]?.textContent;

          if (isNaN(lat) || isNaN(lon)) continue;

          const status = this.normalizeStatus(statusRaw) ?? PointStatus.PLANNING;
          const color = this.normalizeColor(colorRaw) ?? '#2196F3';

          const point: ParsedPoint = {
            id: this.generateId(),
            name,
            description: desc || undefined,
            latitude: lat,
            longitude: lon,
            color,
            categoryIds: [],
            status,
            source: 'osm',
            importedAt: new Date().toISOString(),
          };

          points.push(point);
        }

        return points;
      } catch {
        // fallback below
      }
    }

    // Fallback parser for native environments where DOMParser is not available.
    // It extracts <wpt ...>...</wpt> blocks with minimal tag parsing.
    const points: ParsedPoint[] = [];
    const waypoints = text.match(/<wpt\b[\s\S]*?<\/wpt>/gi) ?? [];

    for (const wptXml of waypoints) {
      const latRaw = this.extractAttr(wptXml, 'lat');
      const lonRaw = this.extractAttr(wptXml, 'lon');
      if (!latRaw || !lonRaw) continue;

      const lat = parseFloat(latRaw);
      const lon = parseFloat(lonRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const name = this.extractTagText(wptXml, 'name') || 'Без названия';
      const desc = this.extractTagText(wptXml, 'desc');
      const statusRaw = this.extractTagText(wptXml, 'status');
      const colorRaw = this.extractTagText(wptXml, 'color');

      const status = this.normalizeStatus(statusRaw) ?? PointStatus.PLANNING;
      const color = this.normalizeColor(colorRaw) ?? '#2196F3';

      points.push({
        id: this.generateId(),
        name,
        description: desc || undefined,
        latitude: lat,
        longitude: lon,
        color,
        categoryIds: [],
        status,
        source: 'osm',
        importedAt: new Date().toISOString(),
      });
    }

    return points;
  }

  private static extractAttr(xml: string, attrName: string): string | null {
    const re = new RegExp(`${attrName}="([^"]+)"|${attrName}='([^']+)'`, 'i');
    const m = xml.match(re);
    return (m?.[1] ?? m?.[2] ?? null) ? String(m?.[1] ?? m?.[2]).trim() : null;
  }

  private static extractTagText(xml: string, tagName: string): string | null {
    const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
    const m = xml.match(re);
    if (!m?.[1]) return null;
    return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
  }
  
  private static generateId(): string {
    return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
