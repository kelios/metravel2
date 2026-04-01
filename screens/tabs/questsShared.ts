export type City = {
    id: string;
    name: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
};

export type NearbyCity = City & { isNearby: true };

export type QuestMeta = {
    id: string;
    title: string;
    points: number;
    durationMin?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    cover?: any;
    lat: number;
    lng: number;
    cityId?: string;
    cityName?: string;
    countryName?: string;
    countryCode?: string;
};

export const pluralizeQuest = (n: number): string => {
    const abs = Math.abs(n) % 100;
    const lastDigit = abs % 10;
    if (abs > 10 && abs < 20) return `${n} квестов`;
    if (lastDigit === 1) return `${n} квест`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${n} квеста`;
    return `${n} квестов`;
};
