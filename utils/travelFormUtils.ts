import { TravelFormData, Travel, MarkerData } from '@/src/types/types';

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

  return {
    ...getEmptyFormData(String(travel.id)),
    ...travel,
    id: String(travel.id),
    year: yearStr,
    number_days: daysStr,
    number_peoples: peoplesStr,
    moderation: (travel as any).moderation ?? false,
    publish: (travel as any).publish ?? false,
    visa: (travel as any).visa ?? false,
    categories: ((travel as any).categories || []).map((c: any) => String(c)),
    transports: ((travel as any).transports || []).map((t: any) => String(t)),
    companions: (travel.companions || []).map((c: any) => String(c)),
    complexity: ((travel as any).complexity || []).map((c: any) => String(c)),
    month: ((travel as any).month || []).map((m: any) => String(m)),
    over_nights_stay: ((travel as any).over_nights_stay || []).map((o: any) => String(o)),
    countries: ((travel as any).countries || []).map((c: any) => String(c)),
    cities: ((travel as any).cities || []).map((c: any) => String(c)),
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
 */
export function validateModerationRequirements(formData: TravelFormData): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!formData.name || formData.name.trim().length < 3) {
    missingFields.push('name');
  }

  if (!formData.description || formData.description.trim().length < 50) {
    missingFields.push('description');
  }

  if (!Array.isArray(formData.countries) || formData.countries.length === 0) {
    missingFields.push('countries');
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
