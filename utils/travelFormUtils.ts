import { TravelFormData, Travel, MarkerData } from '@/src/types/types';
import { CoordinateConverter } from '@/utils/coordinateConverter';

const coerceBoolean = (value: any, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  if (value == null) return fallback;
  return Boolean(value);
};

const normalizeIdList = (raw: any, idKeys: string[] = ['id', 'pk', 'value']): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (item == null) return null;
      if (typeof item === 'string' || typeof item === 'number') return String(item);
      if (typeof item === 'object') {
        for (const key of idKeys) {
          if ((item as any)[key] != null) return String((item as any)[key]);
        }
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
};

const normalizeNumberList = (raw: any, idKeys: string[] = ['id', 'pk', 'value']): number[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (item == null) return null;
      if (typeof item === 'number') return Number.isFinite(item) ? item : null;
      if (typeof item === 'string') {
        const parsed = Number(item);
        return Number.isFinite(parsed) ? parsed : null;
      }
      if (typeof item === 'object') {
        for (const key of idKeys) {
          if ((item as any)[key] != null) {
            const parsed = Number((item as any)[key]);
            return Number.isFinite(parsed) ? parsed : null;
          }
        }
      }
      return null;
    })
    .filter((value): value is number => Number.isFinite(value));
};

const normalizeDefinedFields = <T extends Record<string, any>>(source: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
};

const normalizeMarkersFromCoords = (coords: any[]): MarkerData[] => {
  if (!Array.isArray(coords)) return [];
  return coords
    .map(item => {
      if (!item) return null;
      const parsed = CoordinateConverter.fromLooseString(item.coord ?? item.coords ?? '');
      const lat = Number(item.lat ?? item.latitude ?? parsed?.lat);
      const lng = Number(item.lng ?? item.longitude ?? parsed?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const countryRaw = item.country_id ?? item.country ?? null;
      const countryValue = Number(countryRaw);
      const country = Number.isFinite(countryValue) ? countryValue : null;
      const imageRaw =
        item.image ??
        item.travelImageThumbUrl ??
        item.travelImageThumbSmallUrl ??
        item.travel_image_thumb_url ??
        null;
      const image = typeof imageRaw === 'string' ? imageRaw.trim() : imageRaw;

      return {
        id: item.id ?? item.pk ?? null,
        lat,
        lng,
        country,
        address: item.address ?? item.name ?? item.title ?? '',
        categories: normalizeNumberList(item.categories ?? item.category_ids ?? item.category ?? [], ['id', 'pk', 'value']),
        image: image || null,
      } as MarkerData;
    })
    .filter((item): item is MarkerData => Boolean(item));
};

const normalizeMarkersFromTravelAddress = (travelAddress: any[]): MarkerData[] => {
  if (!Array.isArray(travelAddress)) return [];
  return travelAddress
    .map(item => {
      if (!item) return null;
      const coordStr = item.coord ?? item.coords ?? '';
      const parsed = CoordinateConverter.fromLooseString(coordStr);
      const lat = Number(item.lat ?? item.latitude ?? parsed?.lat);
      const lng = Number(item.lng ?? item.longitude ?? parsed?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const countryRaw = item.country_id ?? item.country ?? null;
      const countryValue = Number(countryRaw);
      const country = Number.isFinite(countryValue) ? countryValue : null;
      const imageRaw =
        item.image ??
        item.travelImageThumbUrl ??
        item.travelImageThumbSmallUrl ??
        item.travel_image_thumb_url ??
        null;
      const image = typeof imageRaw === 'string' ? imageRaw.trim() : imageRaw;

      return {
        id: item.id ?? item.pk ?? null,
        lat,
        lng,
        country,
        address: item.address ?? item.name ?? item.title ?? '',
        categories: normalizeNumberList(item.categories ?? item.category_ids ?? item.category ?? [], ['id', 'pk', 'value']),
        image: image || null,
      } as MarkerData;
    })
    .filter((item): item is MarkerData => Boolean(item));
};

const resolveMarkers = (travel: Travel): MarkerData[] => {
  const travelAny = travel as any;
  const coordsMarkers = normalizeMarkersFromCoords(travelAny.coordsMeTravel ?? []);
  if (coordsMarkers.length > 0) return coordsMarkers;
  return normalizeMarkersFromTravelAddress(travelAny.travelAddress ?? []);
};

/**
 * Создает пустую форму данных путешествия
 */
export function getEmptyFormData(id: string | null): TravelFormData {
  return {
    id: id || null,
    name: '',
    categories: [],
    transports: [],
    month: [],
    complexity: [],
    over_nights_stay: [],
    cities: [],
    countries: [],
    budget: '',
    year: '',
    number_peoples: '',
    number_days: '',
    minus: '',
    plus: '',
    recommendation: '',
    description: '',
    publish: false,
    moderation: false,
    visa: false,
    coordsMeTravel: [],
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    gallery: [],
    youtube_link: '',
    companions: [],
    countryIds: [],
    travelAddressIds: [],
    travelAddressCity: [],
    travelAddressCountry: [],
    travelAddressAdress: [],
    travelAddressCategory: [],
    categoriesIds: [],
  };
}

/**
 * Преобразует данные путешествия с сервера в формат формы
 */
export function transformTravelToFormData(travel: Travel): TravelFormData {
  const yearStr = travel.year != null ? String(travel.year) : '';
  const daysStr = (travel as any).number_days != null ? String((travel as any).number_days) : '';
  const peoplesStr = (travel as any).number_peoples != null ? String((travel as any).number_peoples) : '';
  const travelAny = travel as any;
  const mergedTravel = {
    ...getEmptyFormData(String(travel.id)),
    ...normalizeDefinedFields(travelAny),
  } as TravelFormData;

  const normalizedMarkers = resolveMarkers(travel);

  return {
    ...mergedTravel,
    id: String(travel.id),
    year: yearStr,
    number_days: daysStr,
    number_peoples: peoplesStr,
    moderation: coerceBoolean(travelAny.moderation, false),
    publish: coerceBoolean(travelAny.publish, false),
    visa: coerceBoolean(travelAny.visa, false),
    categories: normalizeIdList(travelAny.categories, ['id', 'category_id', 'pk', 'value']),
    transports: normalizeIdList(travelAny.transports, ['id', 'transport_id', 'pk', 'value']),
    companions: normalizeIdList(travelAny.companions, ['id', 'pk', 'value']),
    complexity: normalizeIdList(travelAny.complexity, ['id', 'pk', 'value']),
    month: normalizeIdList(travelAny.month, ['id', 'pk', 'value']),
    over_nights_stay: normalizeIdList(travelAny.over_nights_stay, ['id', 'pk', 'value']),
    countries: normalizeIdList(travelAny.countries, ['country_id', 'id', 'pk', 'value']),
    cities: normalizeIdList(travelAny.cities, ['id', 'pk', 'value']),
    coordsMeTravel: normalizedMarkers.length > 0 ? normalizedMarkers : mergedTravel.coordsMeTravel ?? [],
  };
}

/**
 * Синхронизирует список стран путешествия с выбранными на карте точками
 */
export function syncCountriesFromMarkers(
  markers: MarkerData[],
  existingCountries: string[]
): string[] {
  const markerCountryIds = Array.from(
    new Set(
      (markers || [])
        .map(m => (m.country != null ? String(m.country) : null))
        .filter((id): id is string => !!id)
    )
  );

  const result = new Set<string>([...existingCountries, ...markerCountryIds]);
  return Array.from(result);
}

/**
 * Очищает пустые поля в объекте (заменяет пустые строки на null)
 */
export function cleanEmptyFields(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (value === '') return [key, null];
      if (value === false) return [key, false];
      return [key, value];
    })
  );
}

/**
 * Нормализует ID путешествия к числу или null
 */
export function normalizeTravelId(id: unknown): number | null {
  if (id == null) return null;
  if (typeof id === 'number') return Number.isFinite(id) ? id : null;
  if (typeof id === 'string') {
    const trimmed = id.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Проверяет права доступа пользователя к редактированию путешествия
 */
export function checkTravelEditAccess(
  travel: Travel | null,
  userId: string | null,
  isSuperAdmin: boolean
): boolean {
  if (!travel) return true; // Новое путешествие
  
  const travelUserId = travel.userIds || travel.user?.id?.toString() || '';
  const currentUserIdStr = userId?.toString() || '';
  
  const isOwner = travelUserId === currentUserIdStr;
  return isOwner || isSuperAdmin;
}

/**
 * Валидирует обязательные поля для отправки на модерацию
 * ✅ FIX: Улучшена валидация с дополнительными проверками
 */
export function validateModerationRequirements(formData: TravelFormData): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // ✅ FIX: Более строгая валидация названия
  if (!formData.name || formData.name.trim().length < 3) {
    missingFields.push('name');
  } else if (formData.name.trim().length > 200) {
    missingFields.push('name_too_long');
  }

  // ✅ FIX: Проверка на подозрительное содержимое
  if (formData.name && /^[^a-zа-я0-9]+$/i.test(formData.name.trim())) {
    missingFields.push('name_invalid_chars');
  }

  if (!formData.description || formData.description.trim().length < 50) {
    missingFields.push('description');
  } else if (formData.description.trim().length > 10000) {
    missingFields.push('description_too_long');
  }

  // ✅ FIX: Валидация массивов с проверкой типов
  if (!Array.isArray(formData.countries) || formData.countries.length === 0) {
    missingFields.push('countries');
  } else {
    // Проверяем, что все элементы валидные
    const hasInvalidCountries = formData.countries.some(c =>
      c == null || c === ''
    );
    if (hasInvalidCountries) {
      missingFields.push('countries_invalid');
    }
  }

  const categories = (formData as any).categories || [];
  if (!Array.isArray(categories) || categories.length === 0) {
    missingFields.push('categories');
  }

  const coordsMeTravel = (formData as any).coordsMeTravel || [];
  const markers = (formData as any).markers || [];
  const hasRoute = coordsMeTravel.length > 0 || markers.length > 0;
  if (!hasRoute) {
    missingFields.push('route');
  } else {
    // ✅ FIX: Проверяем валидность координат в маркерах
    const hasInvalidMarkers = coordsMeTravel.some((m: any) => {
      const lat = Number(m?.lat);
      const lng = Number(m?.lng);
      return !Number.isFinite(lat) || !Number.isFinite(lng) ||
             lat < -90 || lat > 90 || lng < -180 || lng > 180;
    });
    if (hasInvalidMarkers) {
      missingFields.push('route_invalid_coords');
    }
  }

  const gallery = (formData as any).gallery || [];
  const hasCover = !!(formData as any).travel_image_thumb_small_url;
  const hasPhotos = hasCover || gallery.length > 0;
  if (!hasPhotos) {
    missingFields.push('photos');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}
