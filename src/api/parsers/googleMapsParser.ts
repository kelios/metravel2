import { ParsedPoint, PointColor, PointCategory, PointStatus } from '@/types/userPoints';
import type { DocumentPickerAsset } from 'expo-document-picker';
import JSZip from 'jszip';

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
      fileName = asset.name;
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
  
  private static parseJSON(text: string): ParsedPoint[] {
    const data = JSON.parse(text);
    const points: ParsedPoint[] = [];
    
    const features = data.features || [];
    
    for (const feature of features) {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      
      if (!coords || coords.length < 2) continue;

      const location = props.Location || props.location || {};
      const address = props.address ?? props.Address ?? location.Address ?? location.address;
      
      const point: ParsedPoint = {
        id: this.generateId(),
        name: props.Title || props.name || 'Без названия',
        description: props.description,
        latitude: coords[1],
        longitude: coords[0],
        address,
        color: this.mapGoogleCategoryToColor(props.Category),
        category: this.detectCategory(props.Title, props.description),
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

          const point = this.placemarkToPoint({ name, description, coordinates });
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
    const zip = await JSZip.loadAsync(buffer);

    const fileNames = Object.keys(zip.files);
    const kmlName =
      fileNames.find((n) => n.toLowerCase().endsWith('/doc.kml')) ??
      fileNames.find((n) => n.toLowerCase().endsWith('doc.kml')) ??
      fileNames.find((n) => n.toLowerCase().endsWith('.kml'));

    if (!kmlName) {
      throw new Error('KMZ не содержит KML файла');
    }

    const kmlFile = zip.file(kmlName);
    if (!kmlFile) {
      throw new Error('KMZ не содержит KML файла');
    }

    const kmlText = await kmlFile.async('string');
    return this.parseKML(kmlText);
  }

  private static placemarkToPoint(input: {
    name?: string | null;
    description?: string | null;
    coordinates?: string | null;
  }): ParsedPoint | null {
    const coordinates = String(input.coordinates ?? '').trim();
    if (!coordinates) return null;

    const first = coordinates.split(/\s+/).find(Boolean);
    if (!first) return null;

    const [lng, lat] = first.trim().split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const name = String(input.name ?? '').trim() || 'Без названия';
    const description = (input.description ?? undefined) ? String(input.description).trim() : undefined;

    return {
      id: this.generateId(),
      name,
      description: description || undefined,
      latitude: lat,
      longitude: lng,
      color: PointColor.BLUE,
      category: this.detectCategory(name, description),
      status: PointStatus.WANT_TO_VISIT,
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

      const point = this.placemarkToPoint({ name, description, coordinates });
      if (point) points.push(point);
    }

    return points;
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
    if (!category) return PointColor.BLUE;
    
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('starred') || lowerCategory.includes('favorite')) {
      return PointColor.RED;
    }
    if (lowerCategory.includes('want to go')) {
      return PointColor.PURPLE;
    }
    if (lowerCategory.includes('visited')) {
      return PointColor.GREEN;
    }
    
    return PointColor.BLUE;
  }
  
  private static mapGoogleStatusToStatus(category?: string): PointStatus {
    if (!category) return PointStatus.PLANNING;
    
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('visited')) return PointStatus.VISITED;
    if (lowerCategory.includes('want to go')) return PointStatus.WANT_TO_VISIT;
    
    return PointStatus.PLANNING;
  }
  
  private static detectCategory(name?: string, description?: string): PointCategory {
    const text = `${name} ${description}`.toLowerCase();
    
    if (/гора|mountain|peak|вершина|холм/i.test(text)) return PointCategory.MOUNTAIN;
    if (/замок|castle|fortress|крепость/i.test(text)) return PointCategory.CASTLE;
    if (/музей|museum|gallery|галерея/i.test(text)) return PointCategory.MUSEUM;
    if (/ресторан|restaurant/i.test(text)) return PointCategory.RESTAURANT;
    if (/кафе|cafe|coffee/i.test(text)) return PointCategory.CAFE;
    if (/озеро|lake|море|sea/i.test(text)) return PointCategory.LAKE;
    if (/пляж|beach/i.test(text)) return PointCategory.BEACH;
    if (/церковь|church|храм|собор|cathedral/i.test(text)) return PointCategory.CHURCH;
    if (/парк|park|сад|garden/i.test(text)) return PointCategory.PARK;
    if (/отель|hotel/i.test(text)) return PointCategory.HOTEL;
    if (/театр|theater|theatre/i.test(text)) return PointCategory.THEATER;
    if (/кино|cinema/i.test(text)) return PointCategory.CINEMA;
    if (/памятник|monument/i.test(text)) return PointCategory.MONUMENT;
    
    return PointCategory.OTHER;
  }
  
  private static generateId(): string {
    return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
