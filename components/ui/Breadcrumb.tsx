import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  testID?: string;
};

export default function Breadcrumb({ items, testID }: BreadcrumbProps) {
  const router = useRouter();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleNavigate = useCallback(
    (href: string) => {
      if (!href) return;
      router.push(href as never);
    },
    [router],
  );

  if (Platform.OS !== 'web') return null;
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <View style={styles.container} testID={testID} accessibilityLabel={testID}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <View key={`${item.label}-${index}`} style={styles.itemRow}>
            {item.href && !isLast ? (
              <TouchableOpacity
                onPress={() => handleNavigate(item.href as string)}
                accessibilityRole="link"
                style={styles.linkTouch}
              >
                <Text style={styles.linkText}>{item.label}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={isLast ? styles.currentText : styles.linkText}>{item.label}</Text>
            )}

            {!isLast ? <Text style={styles.separator}>›</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.sm,
      gap: 4,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    linkTouch: {
      paddingVertical: 2,
      paddingHorizontal: 2,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    linkText: {
      color: colors.primary,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      textDecorationLine: 'underline',
    },
    currentText: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
    },
    separator: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      marginHorizontal: 2,
    },
  });
