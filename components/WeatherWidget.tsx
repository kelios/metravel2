import React, { useEffect, useState, useRef } from 'react';
import { Platform, View, Text, StyleSheet, Image } from 'react-native';

type Props = {
    points: { coord: string; address?: string }[];
    countryName?: string;
};

type DailyForecast = {
    date: string;
    temperatureMin: number;
    temperatureMax: number;
    condition: string;
    icon: string;
};

export default function WeatherWidget({ points, countryName }: Props) {
    const [forecast, setForecast] = useState<DailyForecast[]>([]);
    const [locationLabel, setLocationLabel] = useState<string>('');
    const [isTitleTruncated, setIsTitleTruncated] = useState(false);
    const [showFullTitle, setShowFullTitle] = useState(false);
    const titleRef = useRef<Text>(null);

    useEffect(() => {
        if (Platform.OS !== 'web' || !points?.length) return;

        const [latStr, lonStr] = points[0].coord.split(',').map((s) => s.trim());
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (isNaN(lat) || isNaN(lon)) return;

        const rawAddress = points[0]?.address ?? '';
        const addressParts = rawAddress.split(',').map(part => part.trim());
        const locationParts = addressParts.slice(0, 3).filter(Boolean);
        if (countryName) locationParts.push(countryName);
        const fullLabel = locationParts.join(', ');
        setLocationLabel(fullLabel);

        // Check if title will be truncated
        setTimeout(() => {
            if (titleRef.current) {
                const element = titleRef.current as unknown as HTMLElement;
                setIsTitleTruncated(element.scrollWidth > element.clientWidth);
            }
        }, 100);

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;

        fetch(url)
          .then(res => res.json())
          .then(data => {
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
              setForecast(forecastData);
          })
          .catch(() => {});
    }, [points, countryName]);

    if (Platform.OS !== 'web' || !forecast.length || !locationLabel) return null;

    const webTitleEvents =
      Platform.OS === 'web'
        ? {
            onMouseEnter: () => isTitleTruncated && setShowFullTitle(true),
            onMouseLeave: () => setShowFullTitle(false),
          }
        : undefined;

    return (
      <View style={styles.wrapper}>
          <View style={styles.titleContainer}>
              <Text
                ref={titleRef}
                style={styles.title}
                numberOfLines={1}
                ellipsizeMode="tail"
                {...webTitleEvents}
              >
                  Погода в {locationLabel}
              </Text>
              {showFullTitle && isTitleTruncated && (
                <View style={styles.tooltip}>
                    <Text style={styles.tooltipText}>Погода в {locationLabel}</Text>
                </View>
              )}
          </View>

          <View style={styles.forecastContainer}>
              {forecast.map((day, index) => (
                <View key={day.date} style={[
                    styles.forecastItem,
                    index === forecast.length - 1 && styles.lastItem
                ]}>
                    <View style={styles.dateIconContainer}>
                        <Text style={styles.date}>{formatDateShort(day.date)}</Text>
                        <Image
                          source={{ uri: day.icon }}
                          style={styles.icon}
                          {...(Platform.OS === 'web' ? { loading: 'lazy' } : {})}
                        />
                    </View>
                    <View style={styles.tempContainer}>
                        <Text style={styles.tempMax}>{Math.round(day.temperatureMax)}°</Text>
                        <Text style={styles.tempMin}>/{Math.round(day.temperatureMin)}°</Text>
                    </View>
                    <Text style={styles.desc} numberOfLines={1} ellipsizeMode="tail">
                        {day.condition}
                    </Text>
                </View>
              ))}
          </View>
      </View>
    );
}

function formatDateShort(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        maxWidth: '100%',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 8, // ✅ UX: Ещё более компактный
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        marginTop: 8,
        overflow: 'hidden',
    },
    titleContainer: {
        position: 'relative',
        marginBottom: 12, // ✅ UX: Уменьшено с 16
    },
    title: {
        fontSize: 14, // ✅ UX: Уменьшено с 16 для компактности
        fontWeight: '600',
        fontFamily: 'Roboto-Medium',
        color: '#1a1a1a',
        cursor: 'default',
        width: '100%',
        flexWrap: 'wrap',
    },
    tooltip: {
        position: 'absolute',
        top: '100%',
        left: 0,
        backgroundColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        zIndex: 1000,
        marginTop: 4,
    },
    tooltipText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'Roboto-Regular',
    },
    forecastContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4, // ✅ UX: Ещё более компактный
    },
    forecastItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 1,
    },
    lastItem: {
        marginRight: 0,
    },
    dateIconContainer: {
        alignItems: 'center',
        marginBottom: 6, // ✅ UX: Уменьшено с 8
    },
    date: {
        fontSize: 11, // ✅ UX: Уменьшено с 13
        fontWeight: '500',
        fontFamily: 'Roboto-Medium',
        color: '#666',
        marginBottom: 4, // ✅ UX: Уменьшено с 6
        textAlign: 'center',
    },
    icon: {
        width: 32, // ✅ UX: Уменьшено с 36
        height: 32, // ✅ UX: Уменьшено с 36
    },
    tempContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 2, // ✅ UX: Уменьшено с 4
    },
    tempMax: {
        fontSize: 14, // ✅ UX: Уменьшено с 16
        fontWeight: '600',
        fontFamily: 'Roboto-Medium',
        color: '#1a1a1a',
    },
    tempMin: {
        fontSize: 12, // ✅ UX: Уменьшено с 14
        fontWeight: '400',
        fontFamily: 'Roboto-Regular',
        color: '#666',
    },
    desc: {
        fontSize: 10, // ✅ UX: Уменьшено с 12 для компактности
        color: '#888',
        fontFamily: 'Roboto-Regular',
        textAlign: 'center',
        maxWidth: '100%',
    },
});

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

function iconFromCode(code: number): string {
    if (code === 0) return 'https://cdn-icons-png.flaticon.com/512/869/869869.png';
    if (code <= 2) return 'https://cdn-icons-png.flaticon.com/512/1163/1163661.png';
    if (code <= 3) return 'https://cdn-icons-png.flaticon.com/512/414/414825.png';
    if (code >= 45 && code < 60) return 'https://cdn-icons-png.flaticon.com/512/4005/4005901.png';
    if (code >= 60 && code < 70) return 'https://cdn-icons-png.flaticon.com/512/3075/3075858.png';
    if (code >= 80) return 'https://cdn-icons-png.flaticon.com/512/1146/1146869.png';
    return 'https://cdn-icons-png.flaticon.com/512/1163/1163624.png';
}