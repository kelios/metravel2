import React, { useCallback, useMemo, useState } from 'react';
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
import type { PointListResponsiveModel } from '@/components/travel/hooks/usePointListResponsiveModel';

type PointLike = {
  address: string;
  coord: string;
};

type PointCardProps = {
  addButtonDisabled?: boolean;
  addButtonLoading?: boolean;
  categoryLabel?: string;
  colors: {
    textOnDark: string;
    textOnPrimary: string;
  };
  imageUrl?: string;
  isMobile: boolean;
  onAddPoint?: () => void;
  onCardPress?: () => void;
  onCopy: (coordStr: string) => void | Promise<void>;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  onShare: (coordStr: string) => void | Promise<void>;
  point: PointLike;
  responsive: PointListResponsiveModel;
  styles: Record<string, any>;
};

type AddToPointsButtonProps = {
  colors: {
    textOnPrimary: string;
  };
  disabled: boolean;
  isWide?: boolean;
  loading: boolean;
  onPress: () => void;
  styles: Record<string, any>;
};

const PointActionIcon = React.memo(function PointActionIcon({
  accessibilityLabel,
  icon,
  onPress,
  style,
  title,
}: {
  accessibilityLabel: string;
  icon: React.ReactNode;
  onPress: () => void;
  style: any;
  title?: string;
}) {
  return (
    <CardActionPressable
      style={style}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      title={title ?? accessibilityLabel}
    >
      {icon}
    </CardActionPressable>
  );
});

const AddToPointsButton = React.memo(function AddToPointsButton({
  colors,
  disabled,
  isWide = false,
  loading,
  onPress,
  styles,
}: AddToPointsButtonProps) {
  return (
    <View style={[styles.addButtonContainer, isWide && styles.addButtonContainerWide]}>
      <CardActionPressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityLabel="Мои точки"
        style={({ pressed }) => [
          globalFocusStyles.focusable,
          styles.addButton,
          pressed && !disabled && !loading && styles.addButtonPressed,
          (disabled || loading) && styles.addButtonDisabled,
          isWide && styles.addButtonFullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <View style={styles.addButtonRow}>
            <Feather name="plus-circle" size={16} color={colors.textOnPrimary} />
            <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>Мои точки</Text>
          </View>
        )}
      </CardActionPressable>
    </View>
  );
});

const PointCard = React.memo(function PointCard({
  addButtonDisabled,
  addButtonLoading,
  categoryLabel,
  colors,
  imageUrl,
  isMobile,
  onAddPoint,
  onCardPress,
  onCopy,
  onOpenMap,
  onShare,
  point,
  responsive,
  styles,
}: PointCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isTouchWeb = useMemo(
    () =>
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none)').matches,
    [],
  );

  const openMapFromLink = useCallback(() => onOpenMap(point.coord), [onOpenMap, point.coord]);
  const showActions = isMobile || hovered || isTouchWeb;
  const hasAddPointAction = Boolean(onAddPoint);
  const imageHeight = hasAddPointAction && isMobile
    ? Math.max(responsive.imageMinHeight, 320)
    : responsive.imageMinHeight;

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <View
      style={styles.card}
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => !isMobile && setHovered(true),
            onMouseLeave: () => !isMobile && setHovered(false),
          } as any)
        : null)}
    >
      <Pressable
        onPress={onCardPress ?? openMapFromLink}
        style={[styles.cardPressable, globalFocusStyles.focusable]}
        accessibilityRole="button"
        accessibilityLabel={`Открыть место: ${point.address}`}
      >
        <View
          testID="travel-point-card-image-wrap"
          style={[
            styles.imageWrap,
            {
              height: imageHeight,
            },
          ]}
        >
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
            <View style={[styles.noImage, { minHeight: imageHeight }]} />
          )}

          {showActions && (
            <View
              style={[
                styles.actionsWrap,
                { pointerEvents: 'box-none' } as any,
              ]}
            >
              <View style={styles.actionsRow}>
                <PointActionIcon
                  accessibilityLabel="Скопировать координаты"
                  title="Скопировать координаты"
                  onPress={() => onCopy(point.coord)}
                  icon={<Feather name="clipboard" size={18} color={colors.textOnDark} />}
                  style={styles.actionBtn}
                />
                <PointActionIcon
                  accessibilityLabel="Поделиться"
                  title="Поделиться в Telegram"
                  onPress={() => onShare(point.coord)}
                  icon={<Feather name="send" size={18} color={colors.textOnDark} />}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          )}

          <View style={styles.overlayBottom} testID="travel-point-card-overlay">
            <Text
              style={[
                styles.overlayTitle,
                showActions && styles.overlayTitleWithActions,
                { fontSize: responsive.titleSize },
              ]}
              numberOfLines={2}
            >
              {point.address}
            </Text>

            <CardActionPressable
              style={[styles.overlayCoordRow, globalFocusStyles.focusable]}
              onPress={openMapFromLink}
              accessibilityLabel={`Координаты: ${point.coord}`}
              title="Открыть координаты в Google Maps"
            >
              <Feather name="map-pin" size={14} color={colors.textOnDark} />
              <Text
                style={[styles.overlayCoordText, { fontSize: responsive.coordSize }]}
                numberOfLines={1}
              >
                {point.coord}
              </Text>
            </CardActionPressable>

            <View style={styles.overlayNavigationMenu}>
              <PointNavigationMenu
                coord={point.coord}
                label="Открыть в навигаторе"
                testIDPrefix={`travel-point-card-navigation-${point.coord.replace(/[^a-zA-Z0-9_-]+/g, '-')}`}
              />
            </View>

            {!!categoryLabel && (
              <View style={styles.overlayCategoryRow}>
                <View style={styles.overlayCategoryChip}>
                  <Text style={styles.overlayCategoryText} numberOfLines={1}>
                    {categoryLabel}
                  </Text>
                </View>
              </View>
            )}

            {onAddPoint && (
              <AddToPointsButton
                onPress={onAddPoint}
                loading={Boolean(addButtonLoading)}
                disabled={Boolean(addButtonDisabled)}
                colors={colors}
                styles={styles}
                isWide={isMobile}
              />
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export default PointCard;
