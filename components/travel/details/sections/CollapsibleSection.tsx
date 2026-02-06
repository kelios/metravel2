/**
 * CollapsibleSection - Раскрывающаяся секция с иконкой и бейджем
 * Извлечено из TravelDetailsDeferred для переиспользования
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { getAccessibilityLabel } from '@/utils/a11y';
import { useTravelDetailsStyles } from '../TravelDetailsStyles';
import { Icon } from '../TravelDetailsIcons';
import CardActionPressable from '@/components/ui/CardActionPressable';

export type HighlightType = 'default' | 'positive' | 'negative' | 'info';

export interface CollapsibleSectionProps {
  title: string;
  initiallyOpen?: boolean;
  forceOpen?: boolean;
  iconName?: string;
  highlight?: HighlightType;
  badgeLabel?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = memo(
  ({
    title,
    initiallyOpen = false,
    forceOpen = false,
    iconName,
    highlight = 'default',
    badgeLabel,
    open: controlledOpen,
    onToggle,
    children,
  }) => {
    const styles = useTravelDetailsStyles();
    const colors = useThemedColors();
    const isControlled = typeof controlledOpen === 'boolean';
    const [internalOpen, setInternalOpen] = useState(initiallyOpen);
    const open = isControlled ? (controlledOpen as boolean) : internalOpen;

    useEffect(() => {
      if (forceOpen) {
        if (isControlled) {
          onToggle?.(true);
        } else {
          setInternalOpen(true);
        }
      }
    }, [forceOpen, isControlled, onToggle]);

    const handleToggle = useCallback(() => {
      if (isControlled) {
        onToggle?.(!controlledOpen);
      } else {
        setInternalOpen((o) => !o);
      }
    }, [controlledOpen, isControlled, onToggle]);

    return (
      <View style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
        <CardActionPressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={handleToggle}
          style={[
            styles.sectionHeaderBtn,
            highlight === 'positive' && styles.sectionHeaderPositive,
            highlight === 'negative' && styles.sectionHeaderNegative,
            highlight === 'info' && styles.sectionHeaderInfo,
            open && styles.sectionHeaderActive,
          ]}
          accessibilityLabel={getAccessibilityLabel(title, `${open ? 'Expanded' : 'Collapsed'}`)}
        >
          <View style={styles.sectionHeaderTitleWrap}>
            {iconName && (
              <View style={styles.sectionHeaderIcon}>
                <Icon name={iconName} size={18} color={colors.primary} />
              </View>
            )}
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {badgeLabel && <Text style={styles.sectionHeaderBadge}>{badgeLabel}</Text>}
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} />
          </View>
        </CardActionPressable>
        {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      </View>
    );
  }
);

CollapsibleSection.displayName = 'CollapsibleSection';
