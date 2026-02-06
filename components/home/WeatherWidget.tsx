/**
 * Компонент виджета погоды
 * ✅ РЕДИЗАЙН: Поддержка темной темы + компактный дизайн
 */
import { useEffect, useMemo, useState } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

// ✅ УЛУЧШЕНИЕ: Импорт CSS для предотвращения проблем с текстом на hover
if (Platform.OS === 'web') {
  require('./WeatherWidget.web.css');
}

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
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
    const styles = useMemo(() => createStyles(colors), [colors]);

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
          .catch((error) => {
              // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки вместо молчаливого игнорирования
              if (__DEV__) {
                  console.warn('[WeatherWidget] Ошибка загрузки прогноза погоды:', error);
              }
          });
    }, [points, countryName]);

    if (Platform.OS !== 'web' || !forecast.length || !locationLabel) return null;

    return (
      <View 
        style={styles.wrapper}
        {...(Platform.OS === 'web' ? { 'data-weather-widget': true } : {})}
      >
          <View style={styles.titleContainer}>
              <Text
                style={[styles.title, { color: colors.text }]}
                {...(Platform.OS === 'web' ? { 'data-weather-title': true } : {})}
              >
                  Погода в {locationLabel}
              </Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.forecastContainer}
            {...(Platform.OS === 'web' ? { 'data-weather-forecast': true } : {})}
          >
              {forecast.map((day, index) => (
                <View key={day.date} style={[
                    styles.forecastItem,
                    index === forecast.length - 1 && styles.lastItem
                ]}>
                    <View style={styles.dateIconContainer}>
                        <Text style={[styles.date, { color: colors.textMuted }]}>{formatDateShort(day.date)}</Text>
                        <Text style={styles.iconEmoji} accessibilityRole="image" aria-label={day.condition}>
                          {day.icon}
                        </Text>
                    </View>
                    <View style={styles.tempContainer}>
                        <Text style={[styles.tempMax, { color: colors.text }]}>{Math.round(day.temperatureMax)}°</Text>
                        <Text style={[styles.tempMin, { color: colors.textMuted }]}>/{Math.round(day.temperatureMin)}°</Text>
                    </View>
                    <Text style={[styles.desc, { color: colors.textMuted }]}>
                        {day.condition}
                    </Text>
                </View>
              ))}
          </ScrollView>
      </View>
    );
}

function formatDateShort(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    // ✅ РЕДИЗАЙН: Компактный wrapper
    wrapper: {
        width: '100%',
        maxWidth: '100%',
        backgroundColor: 'transparent',
        borderRadius: 0,
        paddingVertical: 8, // было 10px (-20%)
        paddingHorizontal: 0,
        marginBottom: 0,
        shadowColor: colors.shadows.light.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
        borderWidth: 0,
        borderColor: 'transparent',
        marginTop: 10, // было 12px (-17%)
        overflow: 'visible',
    },
    titleContainer: {
        position: 'relative',
        marginBottom: 7, // было 8px (-12.5%)
    },
    title: {
        fontSize: 13, // было 14px (-7%)
        fontWeight: '600',
        color: colors.text,
        width: '100%',
        flexWrap: 'wrap',
        ...(Platform.OS === 'web' ? {
            cursor: 'default',
            textDecorationLine: 'none',
            fontFamily: 'Georgia',
        } as any : {}),
    },
    forecastContainer: {
        flexDirection: 'row',
        gap: 12,
        paddingRight: 8,
    },
    forecastItem: {
        alignItems: 'center',
        paddingVertical: 1,
        minWidth: 80,
        width: 80,
    },
    lastItem: {
        marginRight: 0,
    },
    dateIconContainer: {
        alignItems: 'center',
        marginBottom: 5, // было 6px (-17%)
    },
    date: {
        fontSize: 13, // было 14px (-7%)
        fontWeight: '500',
        color: colors.textMuted,
        marginBottom: 3, // было 4px (-25%)
        textAlign: 'center',
    },
    icon: {
        width: 28, // было 32px (-12.5%)
        height: 28, // было 32px (-12.5%)
    },
    iconEmoji: {
        width: 28,
        height: 28,
        textAlign: 'center',
        fontSize: 20,
        lineHeight: 28,
    },
    tempContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 2,
    },
    tempMax: {
        fontSize: 13, // было 14px (-7%)
        fontWeight: '600',
        color: colors.text,
    },
    tempMin: {
        fontSize: 13, // было 14px (-7%)
        fontWeight: '400',
        color: colors.textMuted,
    },
    desc: {
        fontSize: 13, // было 14px (-7%)
        color: colors.textMuted,
        fontWeight: '400',
        textAlign: 'center',
        maxWidth: '100%',
        flexWrap: 'wrap',
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
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code <= 3) return '☁️';
    if (code >= 45 && code < 60) return '🌫️';
    if (code >= 60 && code < 70) return '🌧️';
    if (code >= 80) return '⛈️';
    return '🌦️';
}
