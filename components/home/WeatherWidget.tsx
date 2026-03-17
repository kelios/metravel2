/**
 * Компонент виджета погоды
 * ✅ РЕДИЗАЙН: Поддержка темной темы + компактный дизайн
 */
import { memo, useMemo } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { useWeatherWidgetModel } from './hooks/useWeatherWidgetModel';

// ✅ УЛУЧШЕНИЕ: Импорт CSS для предотвращения проблем с текстом на hover
if (Platform.OS === 'web') {
  require('./WeatherWidget.web.css');
}

type Props = {
    points: { coord: string; address?: string }[];
    countryName?: string;
    onSettled?: () => void;
};

function WeatherWidget({ points, countryName, onSettled }: Props) {
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { forecast, locationLabel } = useWeatherWidgetModel({
        points,
        countryName,
        onSettled,
    });

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
                        <View style={styles.iconContainer} accessibilityRole="image" aria-label={day.condition}>
                          <Feather name={day.icon} size={20} color={colors.textMuted} />
                        </View>
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
    iconContainer: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
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

export default memo(WeatherWidget);
