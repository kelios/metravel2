import { ParsedPoint, PointColor, PointCategory, PointStatus } from '@/types/userPoints';
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
      
      const point: ParsedPoint = {
        id: this.generateId(),
        name: props.name || 'Без названия',
        description: props.description,
        latitude: coords[1],
        longitude: coords[0],
        color: PointColor.BLUE,
        category: this.detectCategoryFromTags(props),
        status: PointStatus.PLANNING,
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
      const type = wpt.getElementsByTagName('type')[0]?.textContent;
      
      if (isNaN(lat) || isNaN(lon)) continue;

      const inferredCategory = this.detectCategoryFromGpx(name, desc, type);
      
      const point: ParsedPoint = {
        id: this.generateId(),
        name,
        description: desc || undefined,
        latitude: lat,
        longitude: lon,
        color: PointColor.BLUE,
        category: inferredCategory,
        status: PointStatus.PLANNING,
        source: 'osm',
        importedAt: new Date().toISOString(),
      };
      
      points.push(point);
    }
    
    return points;
  }
  
  private static detectCategoryFromTags(props: any): PointCategory {
    const amenity = props.amenity;
    const tourism = props.tourism;
    const natural = props.natural;
    const leisure = props.leisure;
    
    if (tourism === 'museum') return PointCategory.MUSEUM;
    if (tourism === 'castle') return PointCategory.CASTLE;
    if (tourism === 'attraction') return PointCategory.ATTRACTION;
    if (tourism === 'hotel') return PointCategory.HOTEL;
    
    if (amenity === 'restaurant') return PointCategory.RESTAURANT;
    if (amenity === 'cafe') return PointCategory.CAFE;
    if (amenity === 'theatre') return PointCategory.THEATER;
    if (amenity === 'cinema') return PointCategory.CINEMA;
    if (amenity === 'place_of_worship') return PointCategory.CHURCH;
    
    if (natural === 'peak') return PointCategory.MOUNTAIN;
    if (natural === 'beach') return PointCategory.BEACH;
    if (natural === 'water') return PointCategory.LAKE;
    
    if (leisure === 'park') return PointCategory.PARK;
    
    return PointCategory.OTHER;
  }

  private static detectCategoryFromGpx(
    name?: string | null,
    description?: string | null,
    type?: string | null
  ): PointCategory {
    const text = `${name ?? ''} ${description ?? ''} ${type ?? ''}`.toLowerCase();
    if (text.includes('hotel')) return PointCategory.HOTEL;
    if (text.includes('restaurant')) return PointCategory.RESTAURANT;
    if (text.includes('cafe') || text.includes('coffee')) return PointCategory.CAFE;
    if (text.includes('theatre') || text.includes('theater')) return PointCategory.THEATER;
    if (text.includes('cinema')) return PointCategory.CINEMA;
    return PointCategory.OTHER;
  }
  
  private static generateId(): string {
    return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
