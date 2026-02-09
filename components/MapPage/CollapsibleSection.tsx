// components/MapPage/CollapsibleSection.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
  icon?: string;
  tone?: 'default' | 'flat';
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  badge,
  defaultOpen = true,
  children,
  accessibilityLabel,
  icon,
  tone = 'default',
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors, tone), [colors, tone]);

  const safeChildren = useMemo(
    () =>
      React.Children.map(children, (child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
          return <Text key={index}>{child}</Text>;
        }
        return child;
      }),
    [children]
  );

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };

  return (
    <View style={styles.collapsibleSection}>
      <Pressable
        testID={`collapsible-${title}`}
        style={({ pressed }) => [
          styles.collapsibleHeader,
          pressed && styles.collapsibleHeaderPressed,
        ]}
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || `${open ? 'Свернуть' : 'Развернуть'} ${title}`}
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.collapsibleTitle}>
          {icon && (
            <Feather name={icon as any} size={18} color={colors.text} style={styles.titleIcon} />
          )}
          <Text style={styles.sectionLabel}>{title}</Text>
          {badge !== undefined && badge !== null && badge !== '' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.collapsibleContent} testID={`collapsible-content-${title}`}>
          {safeChildren}
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: ThemedColors, tone: 'default' | 'flat') => StyleSheet.create({
  collapsibleSection: {
    marginBottom: 16,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: tone === 'flat' ? (colors.backgroundSecondary ?? colors.surface) : colors.surface,
    borderRadius: 12,
    borderWidth: tone === 'flat' ? 0 : 1,
    borderColor: tone === 'flat' ? 'transparent' : colors.borderLight,
  },
  collapsibleHeaderPressed: {
    opacity: 0.7,
    backgroundColor: tone === 'flat' ? (colors.surfaceMuted ?? colors.backgroundSecondary ?? colors.surface) : colors.surface,
  },
  collapsibleTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  titleIcon: {
    marginRight: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryText,
  },
  collapsibleContent: {
    marginTop: 12,
    paddingHorizontal: 12,
  },
});

export default React.memo(CollapsibleSection);
