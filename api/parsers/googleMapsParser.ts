import type { ParsedPoint, PointColor } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';
import type { DocumentPickerAsset } from 'expo-document-picker';
// JSZip is loaded dynamically to avoid pulling ~90 KiB into the initial bundle
const getJSZip = () => import('jszip').then((m) => m.default ?? m);
import { DESIGN_COLORS } from '@/constants/designSystem';

type FileInput = File | DocumentPickerAsset;

export class GoogleMapsParser {
  static async parse(file: FileInput): Promise<ParsedPoint[]> {
    let fileName: string;

    // Проверяем тип файла и читаем его соответствующим образом
    if ('text' in file && typeof file.text === 'function') {
      // Web File API
      fileName = file.name;
    } else {
      // React Native DocumentPickerAsset
      const asset = file as DocumentPickerAsset;
      fileName = String(asset.name || '').trim() || String(asset.uri || '').split('?')[0].split('#')[0].split('/').pop() || '';
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'json') {
      const text = await this.readText(file);
      return this.parseJSON(text);
    } else if (extension === 'kml') {
      const text = await this.readText(file);
      return this.parseKML(text);
    } else if (extension === 'kmz') {
      const buffer = await this.readArrayBuffer(file);
      return this.parseKMZ(buffer);
    }
    
    throw new Error('Неподдерживаемый формат файла. Используйте JSON, KML или KMZ.');
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
  
  private static parseJSON(text: string): ParsedPoint[] {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Не удалось прочитать JSON файл Google Maps.');
    }
    const points: ParsedPoint[] = [];
    
    const features = Array.isArray(data?.features) ? data.features : [];
    
    for (const feature of features) {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      
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

      const location = props.Location || props.location || {};
      const address = props.address ?? props.Address ?? location.Address ?? location.address;
      
      const point: ParsedPoint = {
        id: this.generateId(),
        name: props.Title || props.name || 'Без названия',
        description: props.description,
        latitude: lat,
        longitude: lng,
        address,
        color: this.mapGoogleCategoryToColor(props.Category),
        categoryIds: [],
        status: this.mapGoogleStatusToStatus(props.Category),
        source: 'google_maps',
        originalId: props['Google Maps URL'],
        importedAt: new Date().toISOString(),
        rating: props.rating,
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static parseKML(text: string): ParsedPoint[] {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        const placemarks = doc.getElementsByTagName('Placemark');
        const points: ParsedPoint[] = [];

        for (let i = 0; i < placemarks.length; i++) {
          const placemark = placemarks[i];
          const name = placemark.getElementsByTagName('name')[0]?.textContent || 'Без названия';
          const description = placemark.getElementsByTagName('description')[0]?.textContent;
          const coordinates = placemark.getElementsByTagName('coordinates')[0]?.textContent;

          const extra = this.extractExtendedDataFromPlacemark(placemark);

          const point = this.placemarkToPoint({ name, description, coordinates, ...extra });
          if (point) points.push(point);
        }

        return points;
      } catch {
        // fallback below
      }
    }

    return this.parseKMLFallback(text);
  }

  private static async parseKMZ(buffer: ArrayBuffer): Promise<ParsedPoint[]> {
    const JSZip = await getJSZip();
    const zip = await JSZip.loadAsync(buffer);

    const fileNames = Object.keys(zip.files);
    const kmlNames = fileNames
      .filter((n) => n.toLowerCase().endsWith('.kml'))
      .filter((n) => !zip.files[n]?.dir);

    if (kmlNames.length === 0) {
      throw new Error('KMZ не содержит KML файла');
    }

    const preferDoc = (name: string) => {
      const lower = name.toLowerCase();
      return lower.endsWith('/doc.kml') || lower.endsWith('doc.kml');
    };

    let bestName: string | null = null;
    let bestText: string | null = null;
    let bestScore = -1;

    for (const name of kmlNames) {
      const kmlFile = zip.file(name);
      if (!kmlFile) continue;
      const kmlText = await kmlFile.async('string');
      const score = (kmlText.match(/<Placemark\b/gi) ?? []).length;

      if (
        score > bestScore ||
        (score === bestScore && bestName != null && preferDoc(name) && !preferDoc(bestName)) ||
        (bestName == null)
      ) {
        bestName = name;
        bestText = kmlText;
        bestScore = score;
      }
    }

    if (!bestText) {
      throw new Error('KMZ не содержит KML файла');
    }

    return this.parseKML(bestText);
  }

  private static placemarkToPoint(input: {
    name?: string | null;
    description?: string | null;
    coordinates?: string | null;
    color?: string | null;
    status?: string | null;
  }): ParsedPoint | null {
    const coordinates = String(input.coordinates ?? '').trim();
    if (!coordinates) return null;

    const first = coordinates.split(/\s+/).find(Boolean);
    if (!first) return null;

    const [lng, lat] = first.trim().split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const name = String(input.name ?? '').trim() || 'Без названия';
    const description = (input.description ?? undefined) ? String(input.description).trim() : undefined;

    const status = this.normalizeStatus(input.status) ?? PointStatus.WANT_TO_VISIT;
    const color = this.normalizeColor(input.color) ?? DESIGN_COLORS.userPointDefault;

    return {
      id: this.generateId(),
      name,
      description: description || undefined,
      latitude: lat,
      longitude: lng,
      color,
      categoryIds: [],
      status,
      source: 'google_maps',
      importedAt: new Date().toISOString(),
    };
  }

  private static parseKMLFallback(text: string): ParsedPoint[] {
    const points: ParsedPoint[] = [];
    const placemarks = text.match(/<Placemark[\s\S]*?<\/Placemark>/gi) ?? [];

    for (const pm of placemarks) {
      const name = this.extractTagText(pm, 'name');
      const description = this.extractTagText(pm, 'description');
      const coordinates = this.extractTagText(pm, 'coordinates');

      const status = this.extractDataValue(pm, 'status');
      const color = this.extractDataValue(pm, 'color');

      const point = this.placemarkToPoint({ name, description, coordinates, status, color });
      if (point) points.push(point);
    }

    return points;
  }

  private static extractExtendedDataFromPlacemark(placemark: Element): {
    status?: string | null;
    color?: string | null;
  } {
    const result: { status?: string | null; color?: string | null } = {};

    try {
      const data = placemark.getElementsByTagName('Data');
      for (let i = 0; i < data.length; i++) {
        const el = data[i];
        const name = el.getAttribute('name');
        const value = el.getElementsByTagName('value')[0]?.textContent;
        if (!name) continue;
        if (name === 'status') result.status = value;
        if (name === 'color') result.color = value;
      }
    } catch {
      // ignore
    }

    return result;
  }

  private static extractDataValue(xml: string, dataName: string): string | null {
    const re = new RegExp(
      `<Data\\s+[^>]*name=["']${dataName}["'][^>]*>[\\s\\S]*?<value[^>]*>([\\s\\S]*?)<\\/value>[\\s\\S]*?<\\/Data>`,
      'i'
    );
    const m = xml.match(re);
    if (!m?.[1]) return null;
    return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
  }

  private static extractTagText(xml: string, tagName: string): string | null {
    const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const m = xml.match(re);
    if (!m?.[1]) return null;
    return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
  }

  private static async readText(file: FileInput): Promise<string> {
    if ('text' in file && typeof (file as any).text === 'function') {
      return await (file as any).text();
    }
    const asset = file as DocumentPickerAsset;
    const response = await fetch(asset.uri);
    return await response.text();
  }

  private static async readArrayBuffer(file: FileInput): Promise<ArrayBuffer> {
    if ('arrayBuffer' in file && typeof (file as any).arrayBuffer === 'function') {
      return await (file as any).arrayBuffer();
    }
    const asset = file as DocumentPickerAsset;
    const response = await fetch(asset.uri);
    return await response.arrayBuffer();
  }
  
  private static mapGoogleCategoryToColor(category?: string): PointColor {
    if (!category) return DESIGN_COLORS.userPointDefault as unknown as PointColor;
    
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('starred') || lowerCategory.includes('favorite')) {
      return 'rgb(244, 67, 54)' as unknown as PointColor;
    }
    if (lowerCategory.includes('want to go')) {
      return 'rgb(156, 39, 176)' as unknown as PointColor;
    }
    if (lowerCategory.includes('visited')) {
      return 'rgb(76, 175, 80)' as unknown as PointColor;
    }
    
    return DESIGN_COLORS.userPointDefault as unknown as PointColor;
  }
  
  private static mapGoogleStatusToStatus(category?: string): PointStatus {
    if (!category) return PointStatus.PLANNING;
    
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('visited')) return PointStatus.VISITED;
    if (lowerCategory.includes('want to go')) return PointStatus.WANT_TO_VISIT;
    
    return PointStatus.PLANNING;
  }
  
  private static generateId(): string {
    return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
