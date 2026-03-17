import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

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
    const settledRef = useRef(false);

    const primaryCoord = useMemo(() => String(points?.[0]?.coord ?? '').trim(), [points]);
    const primaryAddress = useMemo(() => String(points?.[0]?.address ?? '').trim(), [points]);
    const normalizedCountryName = useMemo(() => String(countryName ?? '').trim(), [countryName]);

    const locationLabel = useMemo(() => {
        if (!primaryAddress && !normalizedCountryName) return '';
        const addressParts = primaryAddress.split(',').map((part) => part.trim());
        const locationParts = addressParts.slice(0, 3).filter(Boolean);
        if (normalizedCountryName) locationParts.push(normalizedCountryName);
        return locationParts.join(', ');
    }, [normalizedCountryName, primaryAddress]);

    const settle = useCallback(() => {
        if (settledRef.current) return;
        settledRef.current = true;
        onSettled?.();
    }, [onSettled]);

    useEffect(() => {
        settledRef.current = false;
        setForecast([]);
    }, [locationLabel, primaryCoord]);

    useEffect(() => {
        if (Platform.OS !== 'web' || !primaryCoord) {
            settle();
            return;
        }

        let isCancelled = false;

        const [latStr, lonStr] = primaryCoord.split(',').map((s) => s.trim());
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (isNaN(lat) || isNaN(lon)) {
            settle();
            return;
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;

        void (async () => {
          try {
            const res = await fetchWithTimeout(url, undefined as any, 8000);
            if (!res.ok) {
              if (!isCancelled) settle();
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
              condition: weatherDescriptions[codes[i]] ?? 'Неизвестно',
              icon: iconFromCode(codes[i]),
            }));

            if (!isCancelled) {
              setForecast(forecastData);
              settle();
            }
          } catch {
            if (!isCancelled) settle();
          }
        })();

        return () => {
          isCancelled = true;
        };
    }, [primaryCoord, settle]);

    return {
        forecast,
        locationLabel,
    };
}

const weatherDescriptions: Record<number, string> = {
    0: 'Ясно',
    1: 'Преим. ясно',
    2: 'Переменная облачность',
    3: 'Пасмурно',
    45: 'Туман',
    48: 'Инейный туман',
    51: 'Мелкий дождь',
    53: 'Умеренный дождь',
    55: 'Сильный дождь',
    56: 'Ледяной дождь',
    57: 'Сильный ледяной дождь',
    61: 'Слабый дождь',
    63: 'Умеренный дождь',
    65: 'Сильный дождь',
    66: 'Ледяной дождь',
    67: 'Сильный ледяной дождь',
    71: 'Слабый снег',
    73: 'Умеренный снег',
    75: 'Сильный снег',
    77: 'Снежная крупа',
    80: 'Слабый ливень',
    81: 'Умеренный ливень',
    82: 'Сильный ливень',
    85: 'Слабый снег',
    86: 'Сильный снег',
    95: 'Гроза',
    96: 'Гроза с градом',
    99: 'Сильная гроза',
};

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
