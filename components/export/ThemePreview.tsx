// components/export/ThemePreview.tsx
// Компонент для предпросмотра тем PDF с миниатюрами

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

export type PdfThemeName = 
  | 'minimal' 
  | 'light' 
  | 'dark' 
  | 'travel-magazine' 
  | 'classic' 
  | 'modern' 
  | 'romantic' 
  | 'adventure';

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
      primary: '#1a1a1a',
      secondary: '#666666',
      accent: '#2563eb',
      background: '#ffffff',
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
      primary: '#1e293b',
      secondary: '#64748b',
      accent: '#3b82f6',
      background: '#f8fafc',
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
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      accent: '#f59e0b',
      background: '#0f172a',
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
      primary: '#1a1a1a',
      secondary: '#4a4a4a',
      accent: '#ea580c',
      background: '#ffffff',
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
      primary: '#2c1810',
      secondary: '#5a4a42',
      accent: '#8b4513',
      background: '#faf8f5',
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
      primary: '#18181b',
      secondary: '#52525b',
      accent: '#8b5cf6',
      background: '#ffffff',
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
      primary: '#4a1942',
      secondary: '#8b5a83',
      accent: '#e91e63',
      background: '#fdf2f8',
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
      primary: '#1a1a1a',
      secondary: '#4a4a4a',
      accent: '#ff6b35',
      background: '#ffffff',
    },
    preview: {
      headerFont: 'Oswald',
      bodyFont: 'Roboto',
      style: 'playful',
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
}

function ThemeCard({ theme, isSelected, onSelect, compact }: ThemeCardProps) {
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
        <Text style={styles.themeName}>{theme.name}</Text>
        {!compact && <Text style={styles.themeDescription}>{theme.description}</Text>}
        
        {/* Цветовая палитра */}
        <View style={styles.colorPalette}>
          <View style={[styles.colorDot, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.colorDot, { backgroundColor: theme.colors.accent }]} />
          <View style={[styles.colorDot, { backgroundColor: theme.colors.secondary }]} />
        </View>

        {/* Шрифты */}
        {!compact && (
          <Text style={styles.fontInfo}>
            {theme.preview.headerFont} • {theme.preview.bodyFont}
          </Text>
        )}
      </View>

      {/* Индикатор выбора */}
      {isSelected && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  themeCardCompact: {
    width: 180,
    marginHorizontal: 0,
  },
  themeCardSelected: {
    borderColor: '#2563eb',
    borderWidth: 3,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  thumbnail: {
    height: 140,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    color: '#1a1a1a',
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
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
    borderColor: '#e5e7eb',
  },
  fontInfo: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
