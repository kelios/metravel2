import React, { useMemo } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


const MOBILE_LAYOUT_MAX_WIDTH = 767

interface WeatherLegendProps {
  enabledOverlays?: Record<string, boolean> | null
}

type ScaleStop = { offset: number; color: string }

interface WeatherScale {
  /** Заголовок легенды. */
  title: string
  /** CSS linear-gradient (слева направо). */
  stops: ScaleStop[]
  /** Подписи под шкалой (равномерно распределены). */
  ticks: string[]
}

/**
 * Палитры приближены к OWM tile-стилям temp_new / precipitation_new /
 * clouds_new. Точные значения не критичны — легенда объясняет
 * качественную связь «цвет → величина», иначе heatmap нечитаем.
 */
const TEMP_SCALE: Omit<WeatherScale, 'title'> = {
  stops: [
    { offset: 0, color: '#7c2bd6' }, // −40
    { offset: 0.25, color: '#3b6ce0' }, // −20
    { offset: 0.5, color: '#37c4b9' }, // 0
    { offset: 0.7, color: '#9ee35a' }, // +10
    { offset: 0.85, color: '#f2c43d' }, // +25
    { offset: 1, color: '#e84d3d' }, // +40
  ],
  ticks: ['−40', '−20', '0', '+20', '+40'],
}

const PRECIP_SCALE: Omit<WeatherScale, 'title' | 'ticks'> = {
  stops: [
    { offset: 0, color: 'rgba(120,180,255,0.15)' },
    { offset: 0.35, color: '#5aa9f2' },
    { offset: 0.7, color: '#2f5fe0' },
    { offset: 1, color: '#7c2bd6' },
  ],
}

const CLOUDS_SCALE: Omit<WeatherScale, 'title'> = {
  stops: [
    { offset: 0, color: 'rgba(255,255,255,0.1)' },
    { offset: 1, color: 'rgba(120,130,150,0.95)' },
  ],
  ticks: ['0%', '50%', '100%'],
}

const TEMP_ID = 'weather-temp'
const TEMP_LABELS_ID = 'weather-temp-labels'
const PRECIP_ID = 'weather-precip'
const CLOUDS_ID = 'weather-clouds'

/** Активный heatmap → его шкала. Подписи °C без заливки тоже показывают темп-шкалу. */
const resolveScale = (
  enabled: Record<string, boolean> | null | undefined,
): WeatherScale | null => {
  if (!enabled) return null
  if (enabled[TEMP_ID] || enabled[TEMP_LABELS_ID]) {
    return {
      ...TEMP_SCALE,
      title: i18nT('map:components.MapPage.WeatherLegend.temperatura_c_adac082a'),
    }
  }
  if (enabled[PRECIP_ID]) {
    return {
      ...PRECIP_SCALE,
      title: i18nT('map:components.MapPage.WeatherLegend.osadki_mm_ch_53d78d8f'),
      ticks: [
        i18nT('map:components.MapPage.WeatherLegend.net_650340b5'),
        i18nT('map:components.MapPage.WeatherLegend.slabye_e84dd490'),
        i18nT('map:components.MapPage.WeatherLegend.silnye_ea342e61'),
      ],
    }
  }
  if (enabled[CLOUDS_ID]) {
    return {
      ...CLOUDS_SCALE,
      title: i18nT('map:components.MapPage.WeatherLegend.oblachnost_protsent_f61c0456'),
    }
  }
  return null
}

const buildGradient = (stops: ScaleStop[]): string =>
  `linear-gradient(to right, ${stops
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ')})`

function WeatherLegend({ enabledOverlays }: WeatherLegendProps) {
  const colors = useThemedColors()
  const { width } = useWindowDimensions()
  const isMobile = width <= MOBILE_LAYOUT_MAX_WIDTH
  const styles = useMemo(() => getStyles(colors, isMobile), [colors, isMobile])

  const scale = useMemo(() => resolveScale(enabledOverlays), [enabledOverlays])
  const gradient = useMemo(
    () => (scale ? buildGradient(scale.stops) : ''),
    [scale],
  )

  if (!scale) return null

  return (
    <View
      style={styles.container}
      accessibilityLabel={i18nT('map:components.MapPage.WeatherLegend.legenda_value1_bfe44549', { value1: scale.title })}
      testID="weather-legend"
      {...({ role: 'region' } as object)}
    >
      <Text style={styles.title} accessibilityRole="header">
        {scale.title}
      </Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { backgroundImage: gradient } as any]} />
      </View>
      <View style={styles.ticks}>
        {scale.ticks.map((tick) => (
          <Text key={tick} style={styles.tick} numberOfLines={1}>
            {tick}
          </Text>
        ))}
      </View>
    </View>
  )
}

const getStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 12,
      bottom: 28,
      zIndex: 700,
      maxWidth: 240,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      gap: 6,
      ...({
        pointerEvents: 'none',
        ...(isMobile ? {} : { backdropFilter: 'blur(8px)' }),
      } as any),
    },
    title: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    bar: {
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    barFill: {
      flex: 1,
    },
    ticks: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tick: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
  })

export default React.memo(WeatherLegend)
