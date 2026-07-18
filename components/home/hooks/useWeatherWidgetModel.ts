import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { translate as i18nT } from '@/i18n'


type WeatherPoint = {
    coord: string;
    address?: string;
};

export type DailyForecast = {
    date: string;
    temperatureMin: number;
    temperatureMax: number;
    condition: string;
    icon: React.ComponentProps<typeof Feather>['name'];
};

export type WeatherWidgetStatus = 'idle' | 'loading' | 'success' | 'error';

export function useWeatherWidgetModel({
    points,
    countryName,
    onSettled,
}: {
    points: WeatherPoint[];
    countryName?: string;
    onSettled?: () => void;
}) {
    const [forecast, setForecast] = useState<DailyForecast[]>([]);
    const [status, setStatus] = useState<WeatherWidgetStatus>('idle');
    const settledRef = useRef(false);

    const primaryCoord = useMemo(() => String(points?.[0]?.coord ?? '').trim(), [points]);
    const primaryAddress = useMemo(() => String(points?.[0]?.address ?? '').trim(), [points]);
    const normalizedCountryName = useMemo(() => String(countryName ?? '').trim(), [countryName]);

    const locationLabel = useMemo(() => {
        if (!primaryAddress && !normalizedCountryName) {
            return primaryCoord ? i18nT('home:components.home.hooks.useWeatherWidgetModel.tochke_marshruta_50fd9f66') : '';
        }
        // Адрес приходит из reverse-геокода (specific→general): «POI, улица,
        // населённый пункт, страна». В заголовке погоды нужен именно населённый
        // пункт — самая общая часть перед страной, — а не весь шумный хвост с
        // POI и улицей (UI-review #5).
        const addressParts = primaryAddress.split(',').map((part) => part.trim()).filter(Boolean)
        let body = addressParts
        if (
            normalizedCountryName &&
            body.length > 0 &&
            body[body.length - 1].toLowerCase() === normalizedCountryName.toLowerCase()
        ) {
            body = body.slice(0, -1)
        }
        const settlement = body.length > 0 ? body[body.length - 1] : ''
        const locationParts = [settlement, normalizedCountryName].filter(Boolean)
        return locationParts.join(', ')
    }, [normalizedCountryName, primaryAddress, primaryCoord]);

    const settle = useCallback(() => {
        if (settledRef.current) return;
        settledRef.current = true;
        onSettled?.();
    }, [onSettled]);

    useEffect(() => {
        settledRef.current = false;
        setForecast([]);
        setStatus(primaryCoord ? 'loading' : 'idle');
    }, [locationLabel, primaryCoord]);

    useEffect(() => {
        if (!primaryCoord) {
            setStatus('error');
            settle();
            return;
        }

        let isCancelled = false;

        const [latStr, lonStr] = primaryCoord.split(',').map((s) => s.trim());
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (isNaN(lat) || isNaN(lon)) {
            setStatus('error');
            settle();
            return;
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;

        void (async () => {
          try {
            const res = await fetchWithTimeout(url, undefined as any, 8000);
            if (!res.ok) {
              if (!isCancelled) {
                setStatus('error');
                settle();
              }
              return;
            }

            const data = await res.json();
            const dates = data?.daily?.time ?? [];
            const tempMax = data?.daily?.temperature_2m_max ?? [];
            const tempMin = data?.daily?.temperature_2m_min ?? [];
            const codes = data?.daily?.weather_code ?? [];
            const forecastData: DailyForecast[] = dates.slice(0, 3).map((date: string, i: number) => ({
              date,
              temperatureMin: tempMin[i],
              temperatureMax: tempMax[i],
              condition: getWeatherDescription(codes[i]),
              icon: iconFromCode(codes[i]),
            }));

            if (!isCancelled) {
              setForecast(forecastData);
              setStatus(forecastData.length > 0 ? 'success' : 'error');
              settle();
            }
          } catch {
            if (!isCancelled) {
              setStatus('error');
              settle();
            }
          }
        })();

        return () => {
          isCancelled = true;
        };
    }, [primaryCoord, settle]);

    return {
        forecast,
        locationLabel,
        status,
    };
}

const WEATHER_DESCRIPTION_KEYS = {
    0: 'homeStatic:weather.clear',
    1: 'homeStatic:weather.mainlyClear',
    2: 'homeStatic:weather.partlyCloudy',
    3: 'homeStatic:weather.overcast',
    45: 'homeStatic:weather.fog',
    48: 'homeStatic:weather.rimeFog',
    51: 'homeStatic:weather.lightDrizzle',
    53: 'homeStatic:weather.moderateDrizzle',
    55: 'homeStatic:weather.heavyDrizzle',
    56: 'homeStatic:weather.freezingDrizzle',
    57: 'homeStatic:weather.heavyFreezingDrizzle',
    61: 'homeStatic:weather.lightRain',
    63: 'homeStatic:weather.moderateRain',
    65: 'homeStatic:weather.heavyRain',
    66: 'homeStatic:weather.freezingRain',
    67: 'homeStatic:weather.heavyFreezingRain',
    71: 'homeStatic:weather.lightSnow',
    73: 'homeStatic:weather.moderateSnow',
    75: 'homeStatic:weather.heavySnow',
    77: 'homeStatic:weather.snowGrains',
    80: 'homeStatic:weather.lightShowers',
    81: 'homeStatic:weather.moderateShowers',
    82: 'homeStatic:weather.heavyShowers',
    85: 'homeStatic:weather.lightSnowShowers',
    86: 'homeStatic:weather.heavySnowShowers',
    95: 'homeStatic:weather.thunderstorm',
    96: 'homeStatic:weather.thunderstormWithHail',
    99: 'homeStatic:weather.heavyThunderstorm',
} as const;

function getWeatherDescription(code: number): string {
    const key = WEATHER_DESCRIPTION_KEYS[code as keyof typeof WEATHER_DESCRIPTION_KEYS];
    return key ? i18nT(key) : i18nT('homeStatic:weather.unknown');
}

function iconFromCode(code: number): React.ComponentProps<typeof Feather>['name'] {
    if (code === 0) return 'sun';
    if (code <= 2) return 'cloud';
    if (code <= 3) return 'cloud';
    if (code >= 45 && code < 60) return 'wind';
    if (code >= 60 && code < 70) return 'cloud-rain';
    if (code >= 70 && code < 80) return 'cloud-snow';
    if (code >= 80 && code < 90) return 'cloud-rain';
    if (code >= 95) return 'cloud-lightning';
    return 'cloud-drizzle';
}
