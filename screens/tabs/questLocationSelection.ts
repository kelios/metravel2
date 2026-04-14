import { haversineKm } from '@/utils/geo';

type QuestCityCandidate = {
    id: string;
    lat?: number;
    lng?: number;
};

type UserLocation = {
    lat: number;
    lng: number;
};

type ResolveInitialQuestCitySelectionArgs = {
    cities: QuestCityCandidate[];
    selectedCityId: string | null;
    userLoc: UserLocation | null;
    nearbyId: string;
    autoSelectRadiusKm?: number;
};

const DEFAULT_AUTO_SELECT_RADIUS_KM = 75;

function hasFiniteCoords(city: QuestCityCandidate | undefined): city is QuestCityCandidate & { lat: number; lng: number } {
    return !!city && Number.isFinite(city.lat) && Number.isFinite(city.lng);
}

function findNearestCity(cities: QuestCityCandidate[], userLoc: UserLocation) {
    let nearestCity: QuestCityCandidate | null = null;
    let nearestDistanceKm = Infinity;

    for (const city of cities) {
        if (!hasFiniteCoords(city)) continue;
        const distanceKm = haversineKm(userLoc.lat, userLoc.lng, city.lat, city.lng);
        if (distanceKm < nearestDistanceKm) {
            nearestDistanceKm = distanceKm;
            nearestCity = city;
        }
    }

    return {
        nearestCity,
        nearestDistanceKm,
    };
}

export function resolveInitialQuestCitySelection({
    cities,
    selectedCityId,
    userLoc,
    nearbyId,
    autoSelectRadiusKm = DEFAULT_AUTO_SELECT_RADIUS_KM,
}: ResolveInitialQuestCitySelectionArgs): string | null {
    if (!cities.length) return null;
    if (selectedCityId === nearbyId) return nearbyId;

    const firstCityId = cities[0]?.id ?? null;
    const savedCity = selectedCityId ? cities.find((city) => city.id === selectedCityId) ?? null : null;

    if (!userLoc) {
        return savedCity?.id ?? firstCityId;
    }

    const { nearestCity, nearestDistanceKm } = findNearestCity(cities, userLoc);
    if (!nearestCity) {
        return savedCity?.id ?? firstCityId;
    }

    if (!savedCity) {
        return nearestDistanceKm <= autoSelectRadiusKm ? nearestCity.id : firstCityId;
    }

    if (savedCity.id === nearestCity.id) {
        return savedCity.id;
    }

    const savedDistanceKm = hasFiniteCoords(savedCity)
        ? haversineKm(userLoc.lat, userLoc.lng, savedCity.lat, savedCity.lng)
        : Infinity;

    if (nearestDistanceKm <= autoSelectRadiusKm && savedDistanceKm > autoSelectRadiusKm) {
        return nearestCity.id;
    }

    return savedCity.id;
}
