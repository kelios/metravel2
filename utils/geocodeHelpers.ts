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

export const buildAddressFromGeocode = (
    geocodeData: any,
    latlng: any,
    matchedCountry?: any,
) => {
    const parts: string[] = [];

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
    const streetLine = [road, house].filter(Boolean).join(' ');

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
