import { ImportedPoint, PointColor, PointCategory, PointStatus } from '@/types/userPoints';
import type { DocumentPickerAsset } from 'expo-document-picker';

type FileInput = File | DocumentPickerAsset;

export class GoogleMapsParser {
  static async parse(file: FileInput): Promise<ImportedPoint[]> {
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
    
    if (extension === 'json') {
      return this.parseJSON(text);
    } else if (extension === 'kml') {
      return this.parseKML(text);
    } else if (extension === 'kmz') {
      return this.parseKMZ(text, file);
    }
    
    throw new Error('Неподдерживаемый формат файла. Используйте JSON, KML или KMZ.');
  }
  
  private static parseJSON(text: string): ImportedPoint[] {
    const data = JSON.parse(text);
    const points: ImportedPoint[] = [];
    
    const features = data.features || [];
    
    for (const feature of features) {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      
      if (!coords || coords.length < 2) continue;

      const location = props.Location || props.location || {};
      const address = props.address ?? props.Address ?? location.Address ?? location.address;
      
      const point: ImportedPoint = {
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
  
  private static parseKML(text: string): ImportedPoint[] {
    if (typeof DOMParser === 'undefined') {
      throw new Error('KML парсинг доступен только в web окружении');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const placemarks = doc.getElementsByTagName('Placemark');
    const points: ImportedPoint[] = [];
    
    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i];
      const name = placemark.getElementsByTagName('name')[0]?.textContent || 'Без названия';
      const description = placemark.getElementsByTagName('description')[0]?.textContent;
      const coordinates = placemark.getElementsByTagName('coordinates')[0]?.textContent;
      
      if (!coordinates) continue;
      
      const [lng, lat] = coordinates.trim().split(',').map(Number);
      
      if (isNaN(lat) || isNaN(lng)) continue;
      
      const point: ImportedPoint = {
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
      
      points.push(point);
    }
    
    return points;
  }

  private static async parseKMZ(_text: string, _file: FileInput): Promise<ImportedPoint[]> {
    // KMZ - это ZIP архив с KML файлом внутри
    // Для парсинга нужна библиотека для работы с ZIP
    // Пока выбрасываем ошибку с инструкцией
    throw new Error(
      'KMZ файлы нужно сначала распаковать. ' +
      'Извлеките KML файл из архива и загрузите его. ' +
      'Или используйте JSON формат из Google Takeout.'
    );
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
