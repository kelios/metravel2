const normalizeCountryString = (value?: string | null) =>
    (value || '')
        .toLowerCase()
        .replace(/[.,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const matchCountryId = (
    countryName: string,
    countrylist: any[],
    countryCode?: string | null,
): number | null => {
    const normalizedCode = (countryCode || '').toString().trim().toUpperCase();
    if (normalizedCode) {
        const byCode = countrylist.find((c: any) => {
            const candidates = [
                c?.code,
                c?.country_code,
                c?.countryCode,
                c?.iso2,
                c?.iso,
                c?.alpha2,
                c?.alpha_2,
            ]
                .map((v: any) => (v == null ? '' : String(v).trim().toUpperCase()))
                .filter(Boolean);
            return candidates.includes(normalizedCode);
        });
        if (byCode?.country_id != null) {
            const num = Number(byCode.country_id);
            if (Number.isFinite(num)) return num;
        }
    }

    const target = normalizeCountryString(countryName);
    if (!target) return null;

    const found = countrylist.find((c: any) => {
        const candidates = [
            c?.title_ru,
            c?.title_en,
            c?.title,
            c?.name,
        ]
            .map(normalizeCountryString)
            .filter(Boolean);

        return candidates.some((candidate: string) => {
            if (!candidate) return false;
            return target === candidate || target.includes(candidate) || candidate.includes(target);
        });
    });

    if (found?.country_id != null) {
        const num = Number(found.country_id);
        return Number.isFinite(num) ? num : null;
    }
    return null;
};

export type GeocodeParts = {
    /** Имя самого объекта: музей, приют, перевал. Это и есть человеческое название точки. */
    poi: string;
    /** Улица с домом. Дом БЕЗ улицы сюда не попадает — «332» названием быть не может. */
    streetLine: string;
    city: string;
    adminRegion: string;
    adminArea: string;
    countryLabel: string;
};

/**
 * Разбор ответа геокодера на части. Форм ответа две: Nominatim (`address.*`) и
 * bigdatacloud (`localityInfo`), поэтому каждое поле собирается по цепочке
 * альтернатив, а не по одному ключу.
 */
export const buildGeocodeParts = (geocodeData: any, matchedCountry?: any): GeocodeParts => {
    const poi =
        geocodeData?.name ||
        geocodeData?.address?.name ||
        geocodeData?.address?.tourism ||
        geocodeData?.address?.amenity ||
        geocodeData?.address?.historic ||
        geocodeData?.address?.leisure ||
        geocodeData?.address?.place_of_worship ||
        geocodeData?.address?.building;

    const road = geocodeData?.address?.road || geocodeData?.locality;
    const house = geocodeData?.address?.house_number;
    // Номер дома без улицы — не строка адреса, а обрывок: именно так рождалось
    // название «332 · Soblówka · …» (#1717). Без улицы дом отбрасывается.
    const streetLine = road ? [road, house].filter(Boolean).join(' ') : '';

    const city =
        geocodeData?.city ||
        geocodeData?.address?.city ||
        geocodeData?.address?.town ||
        geocodeData?.address?.village ||
        geocodeData?.address?.municipality ||
        geocodeData?.address?.suburb ||
        geocodeData?.localityInfo?.locality?.[0]?.name;

    const adminRegion =
        geocodeData?.principalSubdivision ||
        geocodeData?.address?.state ||
        geocodeData?.address?.region ||
        geocodeData?.localityInfo?.administrative?.find((item: any) => item?.order === 2)?.name;

    const adminArea =
        geocodeData?.address?.county ||
        geocodeData?.localityInfo?.administrative?.find((item: any) => item?.order === 4)?.name;

    const countryLabel =
        matchedCountry?.title_ru ||
        matchedCountry?.title ||
        geocodeData?.countryName ||
        geocodeData?.address?.country ||
        '';

    return {
        poi: poi || '',
        streetLine,
        city: city || '',
        adminRegion: adminRegion || '',
        adminArea: adminArea || '',
        countryLabel,
    };
};

/**
 * Сегмент цепочки, который названием быть не может: номер дома, почтовый индекс,
 * кадастровый номер — «332», «31-042», «1832/0», «48H».
 */
export const isChainNoiseSegment = (value: string): boolean =>
    /^[\d\s\-/]+[a-zA-Z]?$/.test(value.trim());

/**
 * Разделители, которыми цепочка геокодера сшивается в одну строку: запятая у
 * `display_name` Nominatim и ` · ` у подписи, собранной тапом по карте до #1717.
 * Без второго разделителя такая подпись оставалась одним сегментом, и читатель
 * видел её целиком (#1750).
 */
const CHAIN_SEPARATORS = /\s·\s|,/;

/**
 * Сегменты цепочки геокодера: тримленные, непустые, без повторов. Обратное
 * геокодирование часто повторяет название на двух языках или дважды перечисляет
 * район — «Wawel, Podzamcze, Old Town, Stare Miasto, Old Town, Краков»; остаётся
 * первое вхождение. Правило одно на всех потребителей цепочки.
 */
export const splitGeocodeChain = (value: unknown): string[] => {
    if (typeof value !== 'string') return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of value.split(CHAIN_SEPARATORS).map((p: string) => p.trim())) {
        if (!part) continue;
        const key = part.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(part);
    }
    return out;
};

/**
 * Первый сегмент цепочки, который годится в название (#1717). Номер дома
 * пропускается: он остаётся частью адреса, но названием не становится — иначе
 * точка подписывается «332». Одно правило и на `display_name`-фолбэк при
 * записи, и на укорачивание уже сохранённых подписей при отрисовке (#1750).
 *
 * Строка без разделителей возвращается как есть, поэтому вызов идемпотентен:
 * после миграции данных (#1735) он просто перестанет что-либо менять.
 */
export const pickFirstNamedSegment = (value: unknown): string | null =>
    splitGeocodeChain(value).find((part) => !isChainNoiseSegment(part)) ?? null;

/**
 * Короткое название точки маршрута (#1717).
 *
 * Раньше сюда попадала вся цепочка обратного геокодирования, и читатель видел
 * «332 · Soblówka · Силезское воеводство · Живецкий повят · Польша» вместо
 * «Соблувка». Внутри одной статьи такие подписи почти не отличались друг от
 * друга — совпадал весь административный хвост, а он же уезжал в `cityName`
 * шапки статьи (бэкенд берёт адрес ПЕРВОЙ точки как есть,
 * `travels/serializers.py:371`).
 *
 * Административный хвост сознательно не показывается вовсе: страна у статьи
 * уже есть отдельным полем, а место видно на карте. Отдельного поля под хвост
 * в `travelAddress[]` нет, и заводить его значило бы менять контракт API.
 */
export const buildPointTitleFromGeocode = (
    geocodeData: any,
    latlng: any,
    matchedCountry?: any,
) => {
    const { poi, streetLine, city, adminArea, adminRegion, countryLabel } = buildGeocodeParts(
        geocodeData,
        matchedCountry,
    );

    const title = poi || streetLine || city || adminArea || adminRegion || countryLabel;
    if (title) return title;

    // Первый годный сегмент — обычно и есть объект.
    const segment = pickFirstNamedSegment(geocodeData?.display_name);
    if (segment) return segment;
    return `${latlng.lat}, ${latlng.lng}`;
};

/**
 * Полная строка адреса. Остаётся у «Моих точек» (`components/UserPoints`), где
 * это именно адрес сохранённого места, а не подпись на карте маршрута.
 */
export const buildAddressFromGeocode = (
    geocodeData: any,
    latlng: any,
    matchedCountry?: any,
) => {
    const { poi, streetLine, city, adminRegion, adminArea, countryLabel } = buildGeocodeParts(
        geocodeData,
        matchedCountry,
    );
    const road = geocodeData?.address?.road || geocodeData?.locality;
    const parts: string[] = [];

    if (poi && poi !== city && poi !== road) parts.push(poi);
    if (streetLine && streetLine !== city && streetLine !== poi) parts.push(streetLine);
    if (city) parts.push(city);
    if (adminRegion && adminRegion !== countryLabel && adminRegion !== city) parts.push(adminRegion);
    if (adminArea && adminArea !== adminRegion && adminArea !== countryLabel && adminArea !== city) parts.push(adminArea);
    if (countryLabel) parts.push(countryLabel);

    const separator = ' · ';
    const combined = parts.filter(Boolean).join(separator);
    if (combined) return combined;

    if (geocodeData?.display_name) {
        const displayName = String(geocodeData.display_name)
            .replace(/,\s*/g, ' · ')
            .trim();
        if (displayName) return displayName;
    }
    return `${latlng.lat}, ${latlng.lng}`;
};
