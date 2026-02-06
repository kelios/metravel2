// components/MainHubLayout.tsx
// ✅ РЕДИЗАЙН: Обновленный layout для главной страницы
// ✅ РЕДИЗАЙН: Поддержка темной темы с useThemedColors

import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface MainHubLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  maxWidth?: number;
}

export default function MainHubLayout({
  children,
  sidebar,
  maxWidth = 1400,
}: MainHubLayoutProps) {
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Динамическая поддержка тем

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      width: '100%',
      ...Platform.select({
        web: {
          paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        },
        default: {
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
        },
      }),
    },
    sidebar: {
      width: 260,
      paddingRight: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.sm,
    },
    main: {
      flex: 1,
      padding: DESIGN_TOKENS.spacing.md,
      ...Platform.select({
        web: {
          paddingLeft: DESIGN_TOKENS.spacing.lg,
        },
      }),
    },
  }), [colors]);

  const webContentStyle: any =
    Platform.OS === 'web' ? { marginHorizontal: 'auto' } : undefined;

  const webSidebarStyle: any =
    Platform.OS === 'web'
      ? {
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          maxHeight: '100vh',
          overflowY: 'auto',
          zIndex: 10,
        }
      : undefined;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.content,
          { maxWidth },
          webContentStyle,
        ]}
      >
        {sidebar && <View style={[styles.sidebar, webSidebarStyle]}>{sidebar}</View>}
        <View style={styles.main}>{children}</View>
      </View>
    </View>
  );
}

