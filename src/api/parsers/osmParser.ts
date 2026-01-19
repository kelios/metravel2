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
    const data = JSON.parse(text);
    const points: ParsedPoint[] = [];
    
    const features = data.features || [];
    
    for (const feature of features) {
      const props = feature.properties || {};
      const geometryType = feature.geometry?.type;
      const coords = feature.geometry?.coordinates;
      
      if (geometryType !== 'Point') continue;
      if (!coords || coords.length < 2) continue;

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
        latitude: coords[1],
        longitude: coords[0],
        color,
        category: '',
        status,
        source: 'osm',
        importedAt: new Date().toISOString(),
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static parseGPX(text: string): ParsedPoint[] {
    if (typeof DOMParser === 'undefined') {
      throw new Error('GPX парсинг доступен только в web окружении');
    }
    
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
        category: '',
        status,
        source: 'osm',
        importedAt: new Date().toISOString(),
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static generateId(): string {
    return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
