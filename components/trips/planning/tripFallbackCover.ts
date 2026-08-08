import { Image, Platform } from 'react-native';

import { parseTripDateTime } from '@/utils/tripDateTime';

type TripFallbackSeason = 'spring' | 'summer' | 'autumn' | 'winter';

type TripFallbackInput = {
  id: number | string;
  startDate?: string | null;
  title?: string | null;
  transport?: string | null;
  region?: string | null;
};

type AssetSourceResolver = {
  resolveAssetSource?: (source: number | string) => { uri?: string } | null;
};

const FALLBACK_SOURCES: Record<TripFallbackSeason, number> = {
  spring: require('../../../assets/trips/fallbacks/trip-fallback-spring.jpg'),
  summer: require('../../../assets/trips/fallbacks/trip-fallback-summer.jpg'),
  autumn: require('../../../assets/trips/fallbacks/trip-fallback-autumn.jpg'),
  winter: require('../../../assets/trips/fallbacks/trip-fallback-winter.jpg'),
};

const WEB_FALLBACK_URIS: Record<TripFallbackSeason, string> = {
  spring: '/trips/fallbacks/trip-fallback-spring.jpg',
  summer: '/trips/fallbacks/trip-fallback-summer.jpg',
  autumn: '/trips/fallbacks/trip-fallback-autumn.jpg',
  winter: '/trips/fallbacks/trip-fallback-winter.jpg',
};

const SEASON_BY_MONTH: Record<number, TripFallbackSeason> = {
  0: 'winter',
  1: 'winter',
  2: 'spring',
  3: 'spring',
  4: 'spring',
  5: 'summer',
  6: 'summer',
  7: 'summer',
  8: 'autumn',
  9: 'autumn',
  10: 'autumn',
  11: 'winter',
};

const FALLBACK_SEASONS: TripFallbackSeason[] = ['spring', 'summer', 'autumn', 'winter'];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const getTripFallbackCoverSeason = ({
  startDate,
  title,
  transport,
  region,
}: Pick<TripFallbackInput, 'startDate' | 'title' | 'transport' | 'region'>): TripFallbackSeason => {
  // Месяц берём из общей нормализации (#1313): у ISO date-time со смещением
  // локальный месяц может отличаться от того, что стоит в самой строке.
  const parsedStart = parseTripDateTime(startDate);
  if (parsedStart) {
    const season = SEASON_BY_MONTH[parsedStart.value.getMonth()];
    if (season) return season;
  }

  const fallbackSeed = [title, region, transport]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .join('|');
  return FALLBACK_SEASONS[hashString(fallbackSeed) % FALLBACK_SEASONS.length] ?? 'summer';
};

export const getTripFallbackCover = (trip: TripFallbackInput) => {
  const season = getTripFallbackCoverSeason(trip);
  if (Platform.OS === 'web') {
    return {
      key: `trip-fallback-${season}-${trip.id}`,
      season,
      uri: WEB_FALLBACK_URIS[season],
    };
  }

  const source = FALLBACK_SOURCES[season];
  const resolved = (Image as unknown as AssetSourceResolver).resolveAssetSource?.(source);
  const uri = resolved?.uri ?? (typeof source === 'string' ? source : '');

  return {
    key: `trip-fallback-${season}-${trip.id}`,
    season,
    uri,
  };
};
