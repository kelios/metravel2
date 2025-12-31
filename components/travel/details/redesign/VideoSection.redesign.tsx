/**
 * VideoSection.redesign.tsx
 *
 * ✅ Редизайн секции видео маршрута с темной темой
 *
 * Особенности:
 * - Темная тема через useThemedColors
 * - Компактный дизайн (-15-20%)
 * - Превью с ленивой загрузкой
 * - Автоплей при клике
 * - WCAG AA доступность
 * - Поддержка Web/Native
 */

import React, { memo, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

/* -------------------- Types -------------------- */

interface VideoSectionProps {
  /** URL YouTube видео */
  url: string;
  /** Заголовок секции */
  title?: string;
  /** Подзаголовок секции */
  subtitle?: string;
}

/* -------------------- Utils -------------------- */

/**
 * Извлечение YouTube ID из URL
 */
const getYoutubeId = (url: string): string | null => {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/* -------------------- Component -------------------- */

export const VideoSection: React.FC<VideoSectionProps> = memo(({
  url,
  title = 'Видео',
  subtitle = 'Одно нажатие — и ролик начнёт проигрываться',
}) => {
  const colors = useThemedColors();
  const [isPlaying, setIsPlaying] = useState(false);

  // Извлечение YouTube ID
  const videoId = useMemo(() => getYoutubeId(url), [url]);

  // URL превью
  const thumbnailUrl = useMemo(() => {
    if (!videoId) return null;
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }, [videoId]);

  // URL для встраивания
  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    const params = [
      'autoplay=1',
      'mute=0',
      'playsinline=1',
      'rel=0',
      'modestbranding=1',
    ].join('&');
    return `https://www.youtube.com/embed/${videoId}?${params}`;
  }, [videoId]);

  // Обработчик клика
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  // Если нет ID - не рендерим
  if (!videoId) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface }
      ]}
      testID="video-section-redesign"
      accessible
      accessibilityLabel="Видео маршрута"
      {...(Platform.OS === 'web' ? { role: 'region' } as any : {})}
    >
      {/* Заголовок */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name="video" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            accessibilityRole="header"
            {...(Platform.OS === 'web' ? { 'aria-level': 2 } as any : {})}
          >
            {title}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      {/* Видео контейнер */}
      <View
        style={[
          styles.videoWrapper,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.borderLight,
          }
        ]}
        testID="video-container"
      >
        {!isPlaying ? (
          /* Превью с кнопкой play */
          <Pressable
            onPress={handlePlay}
            style={({ pressed }) => [
              styles.preview,
              pressed && styles.previewPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Смотреть видео"
            accessibilityHint="Нажмите, чтобы запустить видео"
            testID="video-preview"
          >
            {/* Фоновое изображение */}
            {Platform.OS === 'web' && thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Превью видео"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <View style={[styles.previewPlaceholder, { backgroundColor: colors.surfaceElevated }]} />
            )}

            {/* Оверлей с кнопкой play */}
            <View style={styles.playOverlay}>
              <View style={[styles.playButton, { backgroundColor: colors.primary }]}>
                <Feather name="play" size={32} color="#ffffff" style={styles.playIcon} />
              </View>
              <Text style={[styles.playHint, { color: colors.text }]}>
                Видео запустится автоматически
              </Text>
            </View>
          </Pressable>
        ) : (
          /* YouTube iframe */
          Platform.OS === 'web' ? (
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: '#000',
              }}
            >
              <iframe
                src={embedUrl || undefined}
                width="100%"
                height="100%"
                style={{ border: 'none', display: 'block' }}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title="YouTube video"
              />
            </div>
          ) : (
            /* Native WebView placeholder */
            <View style={styles.nativeVideoPlaceholder}>
              <Text style={[styles.nativeVideoText, { color: colors.textMuted }]}>
                Видео доступно в веб-версии
              </Text>
            </View>
          )
        )}
      </View>
    </View>
  );
});

VideoSection.displayName = 'VideoSection';

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  container: {
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: Platform.select({
      web: DESIGN_TOKENS.spacing.xl,
      default: DESIGN_TOKENS.spacing.lg,
    }),
    marginBottom: DESIGN_TOKENS.spacing.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },

  // ✅ Заголовок
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: DESIGN_TOKENS.spacing.lg,
    gap: DESIGN_TOKENS.spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Platform.select({
      web: 20,
      default: 18,
    }),
    fontWeight: '600',
    lineHeight: Platform.select({
      web: 26,
      default: 24,
    }),
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },

  // ✅ Видео контейнер
  videoWrapper: {
    width: '100%',
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
      } as any,
    }),
  },

  // ✅ Превью
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
      } as any,
    }),
  },
  previewPressed: {
    ...Platform.select({
      web: {
        transform: 'scale(0.98)',
      } as any,
    }),
  },
  previewPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },

  // ✅ Оверлей с кнопкой
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    gap: DESIGN_TOKENS.spacing.md,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
      },
    }),
  },
  playIcon: {
    marginLeft: 4, // Визуальное центрирование треугольника
  },
  playHint: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ✅ Native видео placeholder
  nativeVideoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
  },
  nativeVideoText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

export default VideoSection;

