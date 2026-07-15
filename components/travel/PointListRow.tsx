import React, { useCallback, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CardActionPressable from '@/components/ui/CardActionPressable';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import PointNavigationMenu from '@/components/navigation/PointNavigationMenu';
import { globalFocusStyles } from '@/styles/globalFocus';
import { translate as i18nT } from '@/i18n'


type PointLike = {
  id: string;
  address: string;
  coord: string;
};

type PointListRowProps = {
  addButtonDisabled?: boolean;
  addButtonLoading?: boolean;
  categoryLabel?: string;
  colors: {
    primary: string;
    primaryDark: string;
    textMuted: string;
  };
  imageUrl?: string;
  index: number;
  onAddPoint?: () => void;
  onCardPress?: () => void;
  onCopy: (coordStr: string) => void | Promise<void>;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  onShare: (coordStr: string) => void | Promise<void>;
  point: PointLike;
  styles: Record<string, any>;
};

const PointListRow = React.memo(function PointListRow({
  addButtonDisabled,
  addButtonLoading,
  categoryLabel,
  colors,
  imageUrl,
  index,
  onAddPoint,
  onCardPress,
  onCopy,
  onOpenMap,
  onShare,
  point,
  styles,
}: PointListRowProps) {
  const [imageError, setImageError] = useState(false);
  const handleImageError = useCallback(() => setImageError(true), []);
  const openMapFromLink = useCallback(() => onOpenMap(point.coord), [onOpenMap, point.coord]);
  const handleRowPress = useCallback(() => {
    (onCardPress ?? openMapFromLink)();
  }, [onCardPress, openMapFromLink]);
  const shouldIgnoreWebRowEvent = useCallback((event: any) => {
    if (Platform.OS !== 'web') return false;
    const target = event?.target;
    const currentTarget = event?.currentTarget;
    if (!target || target === currentTarget || typeof target.closest !== 'function') return false;
    const actionNode = target.closest('[data-card-action="true"]');
    return Boolean(actionNode && actionNode !== currentTarget);
  }, []);
  const handleWebRowClick = useCallback((event: any) => {
    if (shouldIgnoreWebRowEvent(event)) return;
    handleRowPress();
  }, [handleRowPress, shouldIgnoreWebRowEvent]);
  const handleWebRowKeyDown = useCallback((event: any) => {
    if (shouldIgnoreWebRowEvent(event)) return;
    const key = event?.key;
    if (key !== 'Enter' && key !== ' ') return;
    event?.preventDefault?.();
    handleRowPress();
  }, [handleRowPress, shouldIgnoreWebRowEvent]);
  const rowContent = (
    <>
      <View style={styles.listRowThumb}>
        {imageUrl && !imageError ? (
          <ImageCardMedia
            src={imageUrl}
            alt={point.address}
            fit="contain"
            blurBackground
            allowCriticalWebBlur
            blurRadius={16}
            priority="low"
            loading={Platform.OS === 'web' ? 'lazy' : 'lazy'}
            onError={handleImageError}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.listRowThumbPlaceholder} />
        )}
      </View>

      <View style={styles.listRowInfo}>
        <View style={styles.listRowHeader}>
          <View style={styles.listRowBullet}>
            <Text style={styles.listRowBulletText}>{index + 1}</Text>
          </View>
          <Text style={styles.listRowTitle} numberOfLines={2}>
            {point.address || i18nT('travel:common.noAddress')}
          </Text>
        </View>

        {point.coord ? (
          <CardActionPressable
            style={[styles.listRowCoordChip, globalFocusStyles.focusable]}
            onPress={openMapFromLink}
            accessibilityLabel={i18nT('travel:components.travel.PointListRow.koordinaty_value1_591481b3', { value1: point.coord })}
            title={i18nT('travel:components.travel.PointListRow.otkryt_koordinaty_v_google_maps_2d3dbad0')}
          >
            <Feather name="map-pin" size={12} color={colors.textMuted} />
            <Text style={styles.listRowCoordText} numberOfLines={1}>
              {point.coord}
            </Text>
          </CardActionPressable>
        ) : null}

        {!!categoryLabel && (
          <Text style={styles.listRowCategory} numberOfLines={1}>
            {categoryLabel}
          </Text>
        )}

        <View style={styles.listRowActions}>
          {point.coord ? (
            <>
              {/* Утилиты: копировать, поделиться */}
              <CardActionPressable
                accessibilityLabel={i18nT('travel:components.travel.PointListRow.skopirovat_koordinaty_b49dd414')}
                onPress={() => onCopy(point.coord)}
                title={i18nT('travel:components.travel.PointListRow.skopirovat_koordinaty_b49dd414')}
                style={styles.listRowIconBtn}
              >
                <Feather name="copy" size={14} color={colors.textMuted} />
              </CardActionPressable>
              <CardActionPressable
                accessibilityLabel={i18nT('travel:components.travel.PointListRow.podelitsya_v_telegram_ee5e5b6b')}
                onPress={() => onShare(point.coord)}
                title={i18nT('travel:components.travel.PointListRow.telegram_7701804c')}
                style={styles.listRowIconBtn}
              >
                <Feather name="send" size={14} color={colors.textMuted} />
              </CardActionPressable>

              <View
                style={styles.listRowNavigationMenu}
                {...(Platform.OS === 'web' ? ({ 'data-card-action': 'true' } as any) : null)}
              >
                <PointNavigationMenu
                  coord={point.coord}
                  label={i18nT('travel:components.travel.PointListRow.navigatsiya_17c636a8')}
                  testIDPrefix={`travel-point-row-navigation-${point.id}`}
                />
              </View>
            </>
          ) : null}

          {onAddPoint && (
            <CardActionPressable
              onPress={onAddPoint}
              disabled={Boolean(addButtonDisabled) || Boolean(addButtonLoading)}
              accessibilityLabel={i18nT('travel:components.travel.PointListRow.moi_tochki_aad50a18')}
              title={i18nT('travel:components.travel.PointListRow.moi_tochki_aad50a18')}
              style={({ pressed }) => [
                styles.listRowAddBtn,
                pressed && !addButtonDisabled && !addButtonLoading && styles.addButtonPressed,
                (addButtonDisabled || addButtonLoading) && styles.addButtonDisabled,
              ]}
            >
              {addButtonLoading ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <>
                  <Feather name="map-pin" size={13} color={colors.primaryDark} />
                  <Text style={styles.listRowAddBtnText}>{i18nT('travel:components.travel.PointListRow.moi_tochki_aad50a18')}</Text>
                </>
              )}
            </CardActionPressable>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.listRow}>
      {Platform.OS === 'web' ? (
        <View
          style={[styles.listRowPressable, globalFocusStyles.focusable]}
          accessibilityLabel={i18nT('travel:components.travel.PointListRow.otkryt_mesto_value1_219c3742', { value1: point.address })}
          {...({
            'aria-label': i18nT('travel:components.travel.PointListRow.otkryt_mesto_value1_219c3742', { value1: point.address }),
            tabIndex: 0,
            onClick: handleWebRowClick,
            onKeyDown: handleWebRowKeyDown,
          } as any)}
        >
          {rowContent}
        </View>
      ) : (
        <Pressable
          onPress={handleRowPress}
          style={[styles.listRowPressable, globalFocusStyles.focusable]}
          accessibilityRole="button"
          accessibilityLabel={i18nT('travel:components.travel.PointListRow.otkryt_mesto_value1_219c3742', { value1: point.address })}
        >
          {rowContent}
        </Pressable>
      )}
    </View>
  );
});

export default PointListRow;
