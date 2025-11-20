// PageContent.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Основной контент страницы с адаптивной сеткой

import React from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface PageContentProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;

export default function PageContent({
  sidebar,
  children,
  maxWidth = 1400,
}: PageContentProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.content,
          { maxWidth },
          Platform.OS === 'web' && { marginHorizontal: 'auto' },
        ]}
      >
        {/* Боковая панель (только на десктопе) */}
        {!isMobile && sidebar && (
          <View style={styles.sidebar}>
            {sidebar}
          </View>
        )}

        {/* Основной контент */}
        <View style={styles.main}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    ...Platform.select({
      web: {
        paddingHorizontal: spacing.lg,
      },
      default: {
        paddingHorizontal: spacing.md,
      },
    }),
  },
  sidebar: {
    width: 260,
    paddingRight: spacing.lg,
    paddingTop: spacing.sm,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        maxHeight: '100vh',
        overflowY: 'auto',
        zIndex: 10,
      },
    }),
  },
  main: {
    flex: 1,
    padding: spacing.md,
    ...Platform.select({
      web: {
        paddingLeft: spacing.lg,
      },
    }),
  },
});

