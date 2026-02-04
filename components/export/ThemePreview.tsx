// components/export/ThemePreview.tsx
// Компонент для предпросмотра тем PDF с миниатюрами

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';

export type PdfThemeName = 
  | 'minimal' 
  | 'light' 
  | 'dark' 
  | 'travel-magazine' 
  | 'classic' 
  | 'modern' 
  | 'romantic' 
  | 'adventure'
  | 'black-white'
  | 'sepia'
  | 'newspaper';

interface ThemeInfo {
  id: PdfThemeName;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  preview: {
    headerFont: string;
    bodyFont: string;
    style: 'modern' | 'classic' | 'playful' | 'elegant';
  };
}

const THEME_CATALOG: Record<PdfThemeName, ThemeInfo> = {
  minimal: {
    id: 'minimal',
    name: 'Минимал',
    description: 'Чистый и простой дизайн',
    colors: {
      primary: 'rgb(26, 26, 26)',
      secondary: 'rgb(102, 102, 102)',
      accent: 'rgb(37, 99, 235)',
      background: 'rgb(255, 255, 255)',
    },
    preview: {
      headerFont: 'Inter',
      bodyFont: 'Inter',
      style: 'modern',
    },
  },
  light: {
    id: 'light',
    name: 'Светлая',
    description: 'Мягкие цвета и много воздуха',
    colors: {
      primary: 'rgb(30, 41, 59)',
      secondary: 'rgb(100, 116, 139)',
      accent: 'rgb(59, 130, 246)',
      background: 'rgb(248, 250, 252)',
    },
    preview: {
      headerFont: 'Inter',
      bodyFont: 'Inter',
      style: 'modern',
    },
  },
  dark: {
    id: 'dark',
    name: 'Темная',
    description: 'Элегантное темное оформление',
    colors: {
      primary: 'rgb(241, 245, 249)',
      secondary: 'rgb(203, 213, 225)',
      accent: 'rgb(245, 158, 11)',
      background: 'rgb(15, 23, 42)',
    },
    preview: {
      headerFont: 'Montserrat',
      bodyFont: 'Open Sans',
      style: 'modern',
    },
  },
  'travel-magazine': {
    id: 'travel-magazine',
    name: 'Журнал',
    description: 'Яркий журнальный стиль',
    colors: {
      primary: 'rgb(26, 26, 26)',
      secondary: 'rgb(74, 74, 74)',
      accent: 'rgb(234, 88, 12)',
      background: 'rgb(255, 255, 255)',
    },
    preview: {
      headerFont: 'Playfair Display',
      bodyFont: 'Lato',
      style: 'elegant',
    },
  },
  classic: {
    id: 'classic',
    name: 'Классика',
    description: 'Традиционная типографика',
    colors: {
      primary: 'rgb(44, 24, 16)',
      secondary: 'rgb(90, 74, 66)',
      accent: 'rgb(139, 69, 19)',
      background: 'rgb(250, 248, 245)',
    },
    preview: {
      headerFont: 'Crimson Text',
      bodyFont: 'Crimson Text',
      style: 'classic',
    },
  },
  modern: {
    id: 'modern',
    name: 'Модерн',
    description: 'Современный геометрический стиль',
    colors: {
      primary: 'rgb(24, 24, 27)',
      secondary: 'rgb(82, 82, 91)',
      accent: 'rgb(139, 92, 246)',
      background: 'rgb(255, 255, 255)',
    },
    preview: {
      headerFont: 'Poppins',
      bodyFont: 'Inter',
      style: 'modern',
    },
  },
  romantic: {
    id: 'romantic',
    name: 'Романтика',
    description: 'Элегантный и нежный',
    colors: {
      primary: 'rgb(74, 25, 66)',
      secondary: 'rgb(139, 90, 131)',
      accent: 'rgb(233, 30, 99)',
      background: 'rgb(253, 242, 248)',
    },
    preview: {
      headerFont: 'Cormorant Garamond',
      bodyFont: 'Lora',
      style: 'elegant',
    },
  },
  adventure: {
    id: 'adventure',
    name: 'Приключение',
    description: 'Динамичный и смелый',
    colors: {
      primary: 'rgb(26, 26, 26)',
      secondary: 'rgb(74, 74, 74)',
      accent: 'rgb(255, 107, 53)',
      background: 'rgb(255, 255, 255)',
    },
    preview: {
      headerFont: 'Oswald',
      bodyFont: 'Roboto',
      style: 'playful',
    },
  },
  'black-white': {
    id: 'black-white',
    name: 'Ч/Б Газета',
    description: 'Классическая монохромная печать',
    colors: {
      primary: 'rgb(0, 0, 0)',
      secondary: 'rgb(74, 74, 74)',
      accent: 'rgb(0, 0, 0)',
      background: 'rgb(255, 255, 255)',
    },
    preview: {
      headerFont: 'Libre Franklin',
      bodyFont: 'PT Serif',
      style: 'classic',
    },
  },
  sepia: {
    id: 'sepia',
    name: 'Сепия',
    description: 'Винтажная газета 1920-х',
    colors: {
      primary: 'rgb(62, 39, 35)',
      secondary: 'rgb(109, 76, 65)',
      accent: 'rgb(141, 110, 99)',
      background: 'rgb(245, 241, 232)',
    },
    preview: {
      headerFont: 'Libre Franklin',
      bodyFont: 'PT Serif',
      style: 'classic',
    },
  },
  newspaper: {
    id: 'newspaper',
    name: 'Газета',
    description: 'Яркая современная газетная верстка',
    colors: {
      primary: 'rgb(26, 26, 26)',
      secondary: 'rgb(74, 74, 74)',
      accent: 'rgb(211, 47, 47)',
      background: 'rgb(250, 250, 247)',
    },
    preview: {
      headerFont: 'Libre Franklin',
      bodyFont: 'PT Serif',
      style: 'modern',
    },
  },
};

interface ThemePreviewProps {
  selectedTheme: PdfThemeName;
  onThemeSelect: (theme: PdfThemeName) => void;
  compact?: boolean;
}

export default function ThemePreview({
  selectedTheme,
  onThemeSelect,
  compact = false,
}: ThemePreviewProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const themes = Object.values(THEME_CATALOG);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Выберите тему оформления</Text>
      <ScrollView 
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? styles.horizontalScroll : styles.gridContainer}
      >
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isSelected={selectedTheme === theme.id}
            onSelect={() => onThemeSelect(theme.id)}
            compact={compact}
            styles={styles}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface ThemeCardProps {
  theme: ThemeInfo;
  isSelected: boolean;
  onSelect: () => void;
  compact: boolean;
  styles: ReturnType<typeof createStyles>;
}

function ThemeCard({ theme, isSelected, onSelect, compact, styles }: ThemeCardProps) {
  return (
    <Pressable
      style={[
        styles.themeCard,
        compact && styles.themeCardCompact,
        isSelected && styles.themeCardSelected,
      ]}
      onPress={onSelect}
    >
      {/* Миниатюра темы */}
      <View style={[styles.thumbnail, { backgroundColor: theme.colors.background }]}>
        <View style={styles.thumbnailContent}>
          {/* Заголовок */}
          <View
            style={[
              styles.thumbnailHeader,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.accent },
            ]}
          />
          {/* Текстовые блоки */}
          <View style={styles.thumbnailBody}>
            <View style={[styles.thumbnailLine, { backgroundColor: theme.colors.secondary }]} />
            <View
              style={[
                styles.thumbnailLine,
                styles.thumbnailLineShort,
                { backgroundColor: theme.colors.secondary },
              ]}
            />
          </View>
          {/* Акцентный элемент */}
          <View
            style={[
              styles.thumbnailAccent,
              { backgroundColor: theme.colors.accent },
            ]}
          />
        </View>
      </View>

      {/* Информация о теме */}
      <View style={styles.themeInfo}>
        <Text style={styles.themeName} numberOfLines={2}>
          {theme.name}
        </Text>
        {!compact && (
          <Text style={styles.themeDescription} numberOfLines={2}>
            {theme.description}
          </Text>
        )}
        
        {/* Цветовая палитра */}
        <View style={styles.colorPalette}>
          <View style={[styles.colorDot, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.colorDot, { backgroundColor: theme.colors.accent }]} />
          <View style={[styles.colorDot, { backgroundColor: theme.colors.secondary }]} />
        </View>

        {/* Шрифты */}
        {!compact && (
          <Text style={styles.fontInfo}>
            {theme.preview.headerFont} / {theme.preview.bodyFont}
          </Text>
        )}
      </View>

      {/* Индикатор выбора */}
      {isSelected && (
        <View style={styles.selectedBadge}>
          <Feather name="check" size={16} color={styles.selectedBadgeText.color} />
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  horizontalScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  themeCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 16,
    minHeight: 240,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.card } as any)
      : { ...colors.shadows.medium }),
  },
  themeCardCompact: {
    width: 180,
    marginHorizontal: 0,
  },
  themeCardSelected: {
    borderColor: colors.primary,
    borderWidth: 3,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.heavy } as any)
      : { ...colors.shadows.hover }),
  },
  thumbnail: {
    height: 140,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumbnailContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  thumbnailHeader: {
    height: 24,
    borderRadius: 4,
    borderLeftWidth: 4,
  },
  thumbnailBody: {
    gap: 6,
  },
  thumbnailLine: {
    height: 8,
    borderRadius: 2,
    opacity: 0.6,
  },
  thumbnailLineShort: {
    width: '70%',
  },
  thumbnailAccent: {
    height: 16,
    width: 40,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  themeInfo: {
    padding: 12,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    lineHeight: 20,
    minHeight: 40,
  },
  themeDescription: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 16,
    minHeight: 32,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fontInfo: {
    fontSize: 10,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.medium } as any)
      : { ...colors.shadows.medium }),
  },
  selectedBadgeText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
