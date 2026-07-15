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
import { translate as i18nT } from '@/i18n'


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
        accessibilityLabel={i18nT('travel:components.travel.PointCard.moi_tochki_095b9737')}
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
            <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>{i18nT('travel:components.travel.PointCard.moi_tochki_095b9737')}</Text>
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
  const useSeparatedNativeLayout = Platform.OS !== 'web' && isMobile;
  const showActions = !useSeparatedNativeLayout && (isMobile || hovered || isTouchWeb);
  const hasAddPointAction = Boolean(onAddPoint);
  const imageHeight = hasAddPointAction && isMobile
    ? Math.max(responsive.imageMinHeight, 320)
    : responsive.imageMinHeight;
  const cardTextColor = (colors as any).text ?? colors.textOnDark;
  const cardMutedColor = (colors as any).textMuted ?? colors.textOnDark;
  const primaryColor = (colors as any).primary ?? colors.textOnPrimary;

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
        accessibilityLabel={i18nT('travel:components.travel.PointCard.otkryt_mesto_value1_146f093c', { value1: point.address })}
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
              fit={useSeparatedNativeLayout ? 'cover' : 'contain'}
              blurBackground={!useSeparatedNativeLayout}
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
                  accessibilityLabel={i18nT('travel:components.travel.PointCard.skopirovat_koordinaty_ef85ad09')}
                  title={i18nT('travel:components.travel.PointCard.skopirovat_koordinaty_ef85ad09')}
                  onPress={() => onCopy(point.coord)}
                  icon={<Feather name="clipboard" size={18} color={colors.textOnDark} />}
                  style={styles.actionBtn}
                />
                <PointActionIcon
                  accessibilityLabel={i18nT('travel:components.travel.PointCard.podelitsya_ee0ad34e')}
                  title={i18nT('travel:components.travel.PointCard.podelitsya_v_telegram_7a0e6aac')}
                  onPress={() => onShare(point.coord)}
                  icon={<Feather name="send" size={18} color={colors.textOnDark} />}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          )}

          {!useSeparatedNativeLayout && (
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
              accessibilityLabel={i18nT('travel:components.travel.PointCard.koordinaty_value1_dfde5151', { value1: point.coord })}
              title={i18nT('travel:components.travel.PointCard.otkryt_koordinaty_v_google_maps_55c82450')}
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
                label={i18nT('travel:components.travel.PointCard.otkryt_v_navigatore_c8c53ed9')}
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
          )}
        </View>

        {useSeparatedNativeLayout && (
          <View style={styles.cardInfoPanel} testID="travel-point-card-info-panel">
            <Text
              style={[
                styles.cardInfoTitle,
                { fontSize: responsive.titleSize + 2 },
              ]}
              numberOfLines={2}
            >
              {point.address}
            </Text>

            {!!categoryLabel && (
              <View style={styles.cardInfoCategoryChip}>
                <Feather name="tag" size={13} color={cardMutedColor} />
                <Text style={styles.cardInfoCategoryText} numberOfLines={1}>
                  {categoryLabel}
                </Text>
              </View>
            )}

            <View style={styles.cardInfoNavigationMenu}>
              <PointNavigationMenu
                coord={point.coord}
                label={i18nT('travel:components.travel.PointCard.karta_e5879a2e')}
                testIDPrefix={`travel-point-card-navigation-${point.coord.replace(/[^a-zA-Z0-9_-]+/g, '-')}`}
              />
            </View>

            <View style={styles.cardInfoCoordRow}>
              <Feather name="map-pin" size={15} color={cardMutedColor} />
              <Text
                style={[styles.cardInfoCoordText, { fontSize: responsive.coordSize + 1 }]}
                numberOfLines={1}
              >
                {point.coord}
              </Text>
              <CardActionPressable
                accessibilityLabel={i18nT('travel:components.travel.PointCard.skopirovat_koordinaty_ef85ad09')}
                title={i18nT('travel:components.travel.PointCard.skopirovat_koordinaty_ef85ad09')}
                onPress={() => onCopy(point.coord)}
                style={({ pressed }) => [
                  styles.cardInfoIconButton,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <Feather name="copy" size={17} color={cardTextColor} />
              </CardActionPressable>
            </View>

            <View style={styles.cardInfoActionsRow}>
              <CardActionPressable
                accessibilityLabel={i18nT('travel:components.travel.PointCard.podelitsya_ee0ad34e')}
                title={i18nT('travel:components.travel.PointCard.podelitsya_v_telegram_7a0e6aac')}
                onPress={() => onShare(point.coord)}
                style={({ pressed }) => [
                  styles.cardInfoActionButton,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <Feather name="send" size={18} color={primaryColor} />
                <Text style={styles.cardInfoActionText} numberOfLines={1} allowFontScaling={false}>
                  {i18nT('travel:components.travel.PointCard.tg_58c2e64e')}</Text>
              </CardActionPressable>

              {onAddPoint && (
                <CardActionPressable
                  accessibilityLabel={i18nT('travel:components.travel.PointCard.moi_tochki_095b9737')}
                  title={i18nT('travel:components.travel.PointCard.moi_tochki_095b9737')}
                  onPress={onAddPoint}
                  disabled={Boolean(addButtonDisabled) || Boolean(addButtonLoading)}
                  style={({ pressed }) => [
                    styles.cardInfoActionButton,
                    styles.cardInfoActionPrimarySoft,
                    pressed && !addButtonDisabled && !addButtonLoading && styles.actionBtnPressed,
                    (addButtonDisabled || addButtonLoading) && styles.addButtonDisabled,
                  ]}
                >
                  {addButtonLoading ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <Feather name="plus-circle" size={18} color={primaryColor} />
                  )}
                  <Text style={styles.cardInfoActionText} numberOfLines={1} allowFontScaling={false}>
                    {i18nT('travel:components.travel.PointCard.moi_551ccc5e')}</Text>
                </CardActionPressable>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
});

export default PointCard;
