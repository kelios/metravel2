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
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { translate as i18nT } from '@/i18n'


const CONTENT_MARGIN_STYLE = { marginTop: 12 } as const;

const normalizeViewChildren = (children: React.ReactNode): React.ReactNode =>
  React.Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <Text>{child}</Text>;
    }
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return (
        <React.Fragment key={child.key}>
          {normalizeViewChildren((child.props as { children?: React.ReactNode }).children)}
        </React.Fragment>
      );
    }
    return child;
  });

export type HighlightType = 'default' | 'positive' | 'negative' | 'info';

export interface CollapsibleSectionProps {
  title: string;
  initiallyOpen?: boolean;
  forceOpen?: boolean;
  iconName?: string;
  coverImageUrl?: string | null;
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
    coverImageUrl,
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
    const safeChildren = normalizeViewChildren(children);

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
          accessibilityLabel={getAccessibilityLabel(title, `${open ? i18nT('travel:components.travel.details.sections.CollapsibleSection.razvernuto_20293f70') : i18nT('travel:components.travel.details.sections.CollapsibleSection.svernuto_f932e3ff')}`)}
          accessibilityHint={i18nT('travel:components.travel.details.sections.CollapsibleSection.nazhmite_chtoby_value1_razdel_8d102e51', { value1: open ? i18nT('travel:common.collapseLower') : i18nT('travel:common.expandLower') })}
        >
          <View style={styles.sectionHeaderTitleWrap}>
            {coverImageUrl ? (
              <View style={styles.sectionHeaderCover}>
                <ImageCardMedia
                  src={coverImageUrl}
                  alt={title}
                  width={56}
                  height={56}
                  fit="contain"
                  blurBackground
                  allowCriticalWebBlur
                  loading="lazy"
                  priority="low"
                  borderRadius={10}
                  style={styles.sectionHeaderCoverImage}
                />
              </View>
            ) : iconName ? (
              <View style={styles.sectionHeaderIcon}>
                <Icon name={iconName} size={18} color={colors.primaryDark} />
              </View>
            ) : null}
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {badgeLabel && <Text style={styles.sectionHeaderBadge}>{badgeLabel}</Text>}
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} />
          </View>
        </CardActionPressable>
        {open ? <View style={CONTENT_MARGIN_STYLE}>{safeChildren}</View> : null}
      </View>
    );
  }
);

CollapsibleSection.displayName = 'CollapsibleSection';
