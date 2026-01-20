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
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  badge,
  defaultOpen = true,
  children,
  accessibilityLabel,
  icon,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  collapsibleSection: {
    marginBottom: 12,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collapsibleHeaderPressed: {
    opacity: 0.7,
    backgroundColor: colors.surface,
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
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  collapsibleContent: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
});

export default CollapsibleSection;
