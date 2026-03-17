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
  onOpenAppleMap: () => void;
  onOpenGoogleMap: () => void;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  onOpenOsmMap: () => void;
  onOpenYandexMap: () => void;
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

const PointActionChip = React.memo(function PointActionChip({
  chipStyle,
  label,
  onPress,
  textStyle,
  title,
}: {
  chipStyle: any;
  label: string;
  onPress: () => void;
  textStyle: any;
  title?: string;
}) {
  return (
    <CardActionPressable
      style={chipStyle}
      onPress={onPress}
      accessibilityLabel={label}
      title={title ?? label}
    >
      <Text style={textStyle}>{label}</Text>
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
  onOpenAppleMap,
  onOpenGoogleMap,
  onOpenMap,
  onOpenOsmMap,
  onOpenYandexMap,
  onShare,
  point,
  responsive,
  styles,
}: PointCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const openMapFromLink = useCallback(() => onOpenMap(point.coord), [onOpenMap, point.coord]);
  const showActions = isMobile || hovered;

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
          style={[
            styles.imageWrap,
            {
              height: responsive.imageMinHeight,
            },
          ]}
        >
          {imageUrl && !imageError ? (
            <ImageCardMedia
              src={imageUrl}
              alt={point.address}
              fit="contain"
              blurBackground
              blurRadius={16}
              priority="low"
              loading={Platform.OS === 'web' ? 'lazy' : 'lazy'}
              onError={handleImageError}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[styles.noImage, { minHeight: responsive.imageMinHeight }]} />
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

          <View style={styles.overlayBottom}>
            <Text
              style={[styles.overlayTitle, { fontSize: responsive.titleSize }]}
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

            <View style={styles.overlayMapChipsRow}>
              <PointActionChip
                label="Google"
                title="Открыть в Google Maps"
                onPress={onOpenGoogleMap}
                chipStyle={styles.mapChip}
                textStyle={styles.mapChipText}
              />
              <PointActionChip
                label="Apple"
                title="Открыть в Apple Maps"
                onPress={onOpenAppleMap}
                chipStyle={styles.mapChip}
                textStyle={styles.mapChipText}
              />
              <PointActionChip
                label="Яндекс"
                title="Открыть в Яндекс Картах"
                onPress={onOpenYandexMap}
                chipStyle={styles.mapChip}
                textStyle={styles.mapChipText}
              />
              <PointActionChip
                label="OSM"
                title="Открыть в OpenStreetMap"
                onPress={onOpenOsmMap}
                chipStyle={styles.mapChip}
                textStyle={styles.mapChipText}
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
          </View>
          {onAddPoint && (
            <AddToPointsButton
              onPress={onAddPoint}
              loading={Boolean(addButtonLoading)}
              disabled={Boolean(addButtonDisabled)}
              colors={colors}
              styles={styles}
              isWide={false}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
});

export default PointCard;
