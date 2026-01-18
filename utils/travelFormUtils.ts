import { TravelFormData, Travel, MarkerData } from '@/src/types/types';
import { CoordinateConverter } from '@/utils/coordinateConverter';

type UnknownRecord = Record<string, unknown>;

const coerceString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value == null) return fallback;
  return fallback;
};

const pickFirstString = (
  source: UnknownRecord,
  keys: string[],
  fallback = ''
): string => {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      if (v.startsWith('__draft_placeholder__')) continue;
      return v;
    }
  }
  // Allow empty-but-explicit strings (e.g. server returns "") when nothing else exists.
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'string') {
      if (v.startsWith('__draft_placeholder__')) continue;
      return v;
    }
  }
  return fallback;
};

const coerceBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  if (value == null) return fallback;
  return Boolean(value);
};

const normalizeIdList = (raw: unknown, idKeys: string[] = ['id', 'pk', 'value']): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (item == null) return null;
      if (typeof item === 'string' || typeof item === 'number') return String(item);
      if (typeof item === 'object') {
        const rec = item as UnknownRecord;
        for (const key of idKeys) {
          if (rec[key] != null) return String(rec[key]);
        }
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
};

const normalizeNumberList = (raw: unknown, idKeys: string[] = ['id', 'pk', 'value']): number[] => {
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
        const rec = item as UnknownRecord;
        for (const key of idKeys) {
          if (rec[key] != null) {
            const parsed = Number(rec[key]);
            return Number.isFinite(parsed) ? parsed : null;
          }
        }
      }
      return null;
    })
    .filter((value): value is number => Number.isFinite(value));
};

const normalizeDefinedFields = <T extends Record<string, unknown>>(source: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
};

const normalizeMarkersFromCoords = (coords: unknown[]): MarkerData[] => {
  if (!Array.isArray(coords)) return [];
  return coords
    .map(item => {
      if (!item) return null;
      if (typeof item !== 'object') return null;
      const rec = item as UnknownRecord;
      const parsed = CoordinateConverter.fromLooseString(String(rec.coord ?? rec.coords ?? ''));
      const lat = Number(rec.lat ?? rec.latitude ?? parsed?.lat);
      const lng = Number(rec.lng ?? rec.longitude ?? parsed?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const countryRaw = rec.country_id ?? rec.country ?? null;
      const countryValue = Number(countryRaw);
      const country = Number.isFinite(countryValue) ? countryValue : null;
      const imageRaw =
        rec.image ??
        rec.travelImageThumbUrl ??
        rec.travelImageThumbSmallUrl ??
        rec.travel_image_thumb_url ??
        null;
      const image = typeof imageRaw === 'string' ? imageRaw.trim() : imageRaw;

      return {
        id: (rec.id as number | null | undefined) ?? (rec.pk as number | null | undefined) ?? null,
        lat,
        lng,
        country,
        address: String(rec.address ?? rec.name ?? rec.title ?? ''),
        categories: normalizeNumberList(rec.categories ?? rec.category_ids ?? rec.category ?? [], ['id', 'pk', 'value']),
        image: image || null,
      } as MarkerData;
    })
    .filter((item): item is MarkerData => Boolean(item));
};

const normalizeMarkersFromTravelAddress = (travelAddress: unknown[]): MarkerData[] => {
  if (!Array.isArray(travelAddress)) return [];
  return travelAddress
    .map(item => {
      if (!item) return null;
      if (typeof item !== 'object') return null;
      const rec = item as UnknownRecord;
      const coordStr = String(rec.coord ?? rec.coords ?? '');
      const parsed = CoordinateConverter.fromLooseString(coordStr);
      const lat = Number(rec.lat ?? rec.latitude ?? parsed?.lat);
      const lng = Number(rec.lng ?? rec.longitude ?? parsed?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const countryRaw = rec.country_id ?? rec.country ?? null;
      const countryValue = Number(countryRaw);
      const country = Number.isFinite(countryValue) ? countryValue : null;
      const imageRaw =
        rec.image ??
        rec.travelImageThumbUrl ??
        rec.travelImageThumbSmallUrl ??
        rec.travel_image_thumb_url ??
        null;
      const image = typeof imageRaw === 'string' ? imageRaw.trim() : imageRaw;

      return {
        id: (rec.id as number | null | undefined) ?? (rec.pk as number | null | undefined) ?? null,
        lat,
        lng,
        country,
        address: String(rec.address ?? rec.name ?? rec.title ?? ''),
        categories: normalizeNumberList(rec.categories ?? rec.category_ids ?? rec.category ?? [], ['id', 'pk', 'value']),
        image: image || null,
      } as MarkerData;
    })
    .filter((item): item is MarkerData => Boolean(item));
};

const resolveMarkers = (travel: Travel): MarkerData[] => {
  const travelRecord = travel as unknown as UnknownRecord;
  const coordsMarkers = normalizeMarkersFromCoords((travelRecord.coordsMeTravel as unknown[]) ?? []);
  if (coordsMarkers.length > 0) return coordsMarkers;
  return normalizeMarkersFromTravelAddress((travelRecord.travelAddress as unknown[]) ?? []);
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
  const travelRecord = travel as unknown as UnknownRecord;
  const daysStr = travelRecord.number_days != null ? String(travelRecord.number_days) : '';
  const peoplesStr = travelRecord.number_peoples != null ? String(travelRecord.number_peoples) : '';

  const description = pickFirstString(travelRecord, [
    'description',
    'description_html',
    'descriptionHtml',
    'descriptionTravel',
    'description_travel',
  ]);
  const plus = pickFirstString(travelRecord, ['plus', 'plus_html', 'plusHtml']);
  const minus = pickFirstString(travelRecord, ['minus', 'minus_html', 'minusHtml']);
  const recommendation = pickFirstString(travelRecord, [
    'recommendation',
    'recommendation_html',
    'recommendationHtml',
  ]);
  const youtube_link = coerceString(
    travelRecord.youtube_link ?? travelRecord.youtubeLink,
    ''
  );

  const mergedTravel = {
    ...getEmptyFormData(String(travel.id)),
    ...normalizeDefinedFields(travelRecord),
  } as TravelFormData;

  const normalizedMarkers = resolveMarkers(travel);

  return {
    ...mergedTravel,
    id: String(travel.id),
    year: yearStr,
    number_days: daysStr,
    number_peoples: peoplesStr,
    description,
    plus,
    minus,
    recommendation,
    youtube_link,
    moderation: coerceBoolean(travelRecord.moderation, false),
    publish: coerceBoolean(travelRecord.publish, false),
    visa: coerceBoolean(travelRecord.visa, false),
    categories: normalizeIdList(travelRecord.categories, ['id', 'category_id', 'pk', 'value']),
    transports: normalizeIdList(travelRecord.transports, ['id', 'transport_id', 'pk', 'value']),
    companions: normalizeIdList(travelRecord.companions, ['id', 'pk', 'value']),
    complexity: normalizeIdList(travelRecord.complexity, ['id', 'pk', 'value']),
    month: normalizeIdList(travelRecord.month, ['id', 'pk', 'value']),
    over_nights_stay: normalizeIdList(travelRecord.over_nights_stay, ['id', 'pk', 'value']),
    countries: normalizeIdList(travelRecord.countries, ['country_id', 'id', 'pk', 'value']),
    cities: normalizeIdList(travelRecord.cities, ['id', 'pk', 'value']),
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
export function cleanEmptyFields<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
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
  const formRecord = formData as unknown as UnknownRecord;

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

  const categories = formData.categories ?? [];
  if (!Array.isArray(categories) || categories.length === 0) {
    missingFields.push('categories');
  }

  const coordsMeTravel = Array.isArray(formData.coordsMeTravel) ? (formData.coordsMeTravel as unknown[]) : [];
  const markers = Array.isArray(formRecord.markers) ? (formRecord.markers as unknown[]) : [];
  const hasRoute = coordsMeTravel.length > 0 || markers.length > 0;
  if (!hasRoute) {
    missingFields.push('route');
  } else {
    // ✅ FIX: Проверяем валидность координат в маркерах
    const hasInvalidMarkers = coordsMeTravel.some((m: unknown) => {
      if (!m || typeof m !== 'object') return true;
      const rec = m as UnknownRecord;
      const lat = Number(rec.lat);
      const lng = Number(rec.lng);
      return !Number.isFinite(lat) || !Number.isFinite(lng) ||
             lat < -90 || lat > 90 || lng < -180 || lng > 180;
    });
    if (hasInvalidMarkers) {
      missingFields.push('route_invalid_coords');
    }
  }

  const gallery = Array.isArray(formData.gallery) ? formData.gallery : [];
  const hasCover = !!formData.travel_image_thumb_small_url;
  const hasPhotos = hasCover || gallery.length > 0;
  if (!hasPhotos) {
    missingFields.push('photos');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}
