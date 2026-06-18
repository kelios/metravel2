import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import RelatedTravelActionStack from '@/components/travel/RelatedTravelActionStack'
import { POPUP_TOOLTIPS } from './constants';
import FullscreenImageViewer from './FullscreenImageViewer';
import FullscreenPopupOverlay from './FullscreenPopupOverlay';
import { stopWebPopupEvent } from './domEvents';
import { usePopupDomGuard } from './usePopupDomGuard';
import { usePopupLayout } from './usePopupLayout';
import { usePopupActions } from './usePopupActions';

type Props = {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  categoryLabel?: string | null;
  coord?: string | null;
  drivingDistanceMeters?: number | null;
  drivingDurationSeconds?: number | null;
  isDrivingLoading?: boolean;
  onOpenArticle?: () => void;
  articleHref?: string | null;
  relatedTravelUrl?: string | null;
  relatedTravelCountry?: string | null;
  relatedTravelCity?: string | null;
  onCopyCoord?: () => void;
  onShareTelegram?: () => void;
  onOpenGoogleMaps?: () => void;
  onOpenOrganicMaps?: () => void;
  onOpenWaze?: () => void;
  onOpenYandexNavi?: () => void;
  onAddPoint?: () => void;
  onBuildRoute?: () => void;
  addDisabled?: boolean;
  isAdding?: boolean;
  addLabel?: string;
  addTooltip?: string;
  width?: number;
  imageHeight?: number;
  compactLayout?: boolean;
  fullscreenOnMobile?: boolean;
  onClose?: () => void;
  colors: ThemedColors;
  /**
   * Optional override for the primary action button. When provided, it wins over
   * the default selection (route → article → google maps). Used by feature-specific
   * popups (e.g. quest map) to surface a custom CTA without forking the card.
   */
  primaryActionOverride?: {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    onPress: () => void;
    accessibilityLabel?: string;
    tooltip?: string;
  };
};

const PlacePopupCard: React.FC<Props> = ({
  title,
  subtitle: _subtitle,
  imageUrl,
  categoryLabel,
  coord,
  drivingDistanceMeters,
  drivingDurationSeconds,
  isDrivingLoading = false,
  onOpenArticle,
  articleHref,
  relatedTravelUrl,
  relatedTravelCountry,
  relatedTravelCity,
  onCopyCoord,
  onShareTelegram,
  onOpenGoogleMaps,
  onOpenOrganicMaps,
  onOpenWaze,
  onOpenYandexNavi,
  onAddPoint,
  onBuildRoute,
  addDisabled = false,
  isAdding = false,
  addLabel = 'Сохранить',
  addTooltip,
  width = 352,
  imageHeight: _imageHeight = 56,
  compactLayout = false,
  fullscreenOnMobile = false,
  onClose,
  colors,
  primaryActionOverride,
}) => {
  const setCardRootNode = usePopupDomGuard();
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  const {
    revealPopupImageOnLoadOnly,
    bp,
    compactLabel,
    useFullscreenMobileOverlay,
    useCompactLayout,
    maxPopupWidth,
    useSplitLayout,
    styles,
  } = usePopupLayout({
    colors,
    width,
    imageUrl,
    addLabel,
    compactLayout,
    fullscreenOnMobile,
  });

  const {
    hasCoord,
    normalizedArticleHref,
    hasDrivingInfo,
    drivingText,
    primaryAction,
    saveActionVisual,
    secondaryActions,
  } = usePopupActions({
    colors,
    coord,
    articleHref,
    drivingDistanceMeters,
    drivingDurationSeconds,
    onOpenArticle,
    onOpenGoogleMaps,
    onOpenOrganicMaps,
    onOpenWaze,
    onOpenYandexNavi,
    onShareTelegram,
    onBuildRoute,
    primaryActionOverride,
  });

  const handleOpenFullscreen = useCallback((event?: any) => {
    stopWebPopupEvent(event);
    event?.preventDefault?.();
    if (imageUrl) setFullscreenVisible(true);
  }, [imageUrl]);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  useEffect(() => {
    setFullscreenVisible(false);
  }, [imageUrl]);

  const topInfoSlot = useMemo(() => (
    <View style={styles.infoSection}>
      <Text style={styles.titleText} numberOfLines={useCompactLayout ? 2 : bp === 'narrow' ? 2 : 2}>
        {title}
      </Text>

      {!!_subtitle && (
        <Text style={styles.subtitleText} numberOfLines={useCompactLayout ? 2 : 1}>
          {_subtitle}
        </Text>
      )}

      {normalizedArticleHref && Platform.OS === 'web' && primaryAction?.onPress !== onOpenArticle && (
        <View
          style={styles.inlineLinkRow}
          {...({
            'data-card-action': 'true',
          } as any)}
        >
          <a
            href={normalizedArticleHref}
            onClick={(event) => {
              stopWebPopupEvent(event);
              event.preventDefault();
              onOpenArticle?.();
            }}
            style={styles.inlineLink as any}
            aria-label="Открыть страницу точки"
          >
            Открыть страницу
          </a>
        </View>
      )}

      <View style={styles.metaRow}>
        {!!categoryLabel && (
          <View style={styles.metaBadge}>
            <Feather name="tag" size={12} color={colors.textMuted} />
            <Text style={styles.categoryText} numberOfLines={1}>
              {categoryLabel}
            </Text>
          </View>
        )}

        {(isDrivingLoading || hasDrivingInfo) && (
          <View testID="popup-driving-info" style={[styles.drivingRow, styles.metaBadge]}>
            <Feather name="navigation" size={12} color={colors.textMuted} />
            {isDrivingLoading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Text style={styles.smallText} numberOfLines={1}>
                {drivingText}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  ), [
    _subtitle,
    bp,
    categoryLabel,
    colors.textMuted,
    drivingText,
    hasDrivingInfo,
    isDrivingLoading,
    normalizedArticleHref,
    onOpenArticle,
    primaryAction,
    styles,
    title,
    useCompactLayout,
  ]);

  const footerSlot = useMemo(() => (
    <View style={styles.footerStack}>
      {hasCoord && (
        <CardActionPressable
          accessibilityLabel="Скопировать координаты"
          onPress={onCopyCoord ? () => void onCopyCoord() : undefined}
          title={POPUP_TOOLTIPS.copyCoords}
          enableWebClickFallback
          style={styles.coordRow}
        >
          <Feather name="map-pin" size={13} color={colors.textMuted} style={{ flexShrink: 0 } as any} />
          <Text style={styles.coordText} numberOfLines={1} selectable>{coord}</Text>
          {onCopyCoord && <Feather name="copy" size={13} color={colors.textMuted} style={{ flexShrink: 0 } as any} />}
        </CardActionPressable>
      )}

      <View style={styles.actionsStack}>
        {primaryAction && (
          <CardActionPressable
            accessibilityLabel={primaryAction.accessibilityLabel}
            onPress={primaryAction.onPress}
            title={primaryAction.tooltip}
            testID="popup-primary-action"
            enableWebClickFallback
            style={({ pressed }) => [
              styles.primaryActionBtn,
              pressed && styles.primaryActionBtnPressed,
            ]}
          >
            <Feather name={primaryAction.icon} size={15} color={colors.textOnPrimary ?? colors.textOnDark} />
            <Text style={styles.primaryActionText}>{primaryAction.label}</Text>
          </CardActionPressable>
        )}

        <View style={styles.secondaryActionsRow}>
          {secondaryActions.map((action) => (
            <CardActionPressable
              key={action.key}
              accessibilityLabel={action.accessibilityLabel}
              onPress={action.onPress}
              title={action.title}
              enableWebClickFallback
              style={({ pressed }) => [
                styles.chipActionBtn,
                pressed && styles.chipActionBtnPressed,
              ]}
            >
              <View style={[styles.chipIconBubble, { backgroundColor: action.tintBg }]}>
                <Feather name={action.icon} size={16} color={action.iconColor} />
              </View>
              <Text style={styles.chipActionText} numberOfLines={1}>
                {action.label}
              </Text>
            </CardActionPressable>
          ))}

          {onAddPoint && (
            <CardActionPressable
              accessibilityLabel={compactLabel}
              onPress={() => void onAddPoint()}
              disabled={addDisabled || isAdding}
              title={addTooltip ?? compactLabel}
              enableWebClickFallback
              style={({ pressed }) => [
                styles.chipActionBtn,
                (addDisabled || isAdding) && styles.addBtnDisabled,
                pressed && styles.chipActionBtnPressed,
              ]}
            >
              <View style={[styles.chipIconBubble, { backgroundColor: saveActionVisual.tintBg }]}>
                {isAdding ? (
                  <ActivityIndicator size="small" color={saveActionVisual.iconColor} />
                ) : (
                  <Feather name={saveActionVisual.icon} size={16} color={saveActionVisual.iconColor} />
                )}
              </View>
              <Text style={styles.chipActionText} numberOfLines={1}>
                {compactLabel}
              </Text>
            </CardActionPressable>
          )}
        </View>
      </View>
    </View>
  ), [
    secondaryActions,
    addDisabled,
    addTooltip,
    colors.textMuted,
    compactLabel,
    coord,
    hasCoord,
    isAdding,
    onAddPoint,
    onCopyCoord,
    primaryAction,
    saveActionVisual,
    styles,
    colors.textOnDark,
    colors.textOnPrimary,
  ]);

  const cardBody = (
    <View
      ref={setCardRootNode}
      style={[styles.container, { maxWidth: maxPopupWidth }]}
      {...(Platform.OS === 'web'
        ? ({
            onClick: stopWebPopupEvent,
            onMouseDown: stopWebPopupEvent,
            onMouseUp: stopWebPopupEvent,
            onPointerDown: stopWebPopupEvent,
            onPointerUp: stopWebPopupEvent,
            onTouchStart: stopWebPopupEvent,
            onTouchEnd: stopWebPopupEvent,
          } as any)
        : null)}
    >
      <View style={styles.popupCard}>
        {relatedTravelUrl ? (
          <View style={styles.relatedTravelActions} pointerEvents="box-none">
            <RelatedTravelActionStack
              relatedTravelUrl={relatedTravelUrl}
              fallbackTitle={title}
              fallbackImageUrl={imageUrl}
              fallbackCountry={relatedTravelCountry}
              fallbackCity={relatedTravelCity}
            />
          </View>
        ) : null}
        <View style={[styles.topSection, useSplitLayout && styles.topSectionSplit]}>
          {imageUrl && (
            <Pressable
              onPress={handleOpenFullscreen}
              onMouseDown={stopWebPopupEvent as any}
              onPointerDown={stopWebPopupEvent as any}
              onTouchStart={stopWebPopupEvent as any}
              accessibilityRole="button"
              accessibilityLabel="Открыть фото на весь экран"
              {...(Platform.OS === 'web'
                ? ({
                    'data-card-action': 'true',
                    title: POPUP_TOOLTIPS.openPhoto,
                    onMouseDownCapture: handleOpenFullscreen,
                    onPointerDownCapture: handleOpenFullscreen,
                    onClickCapture: handleOpenFullscreen,
                    onTouchStartCapture: stopWebPopupEvent,
                    onTouchEndCapture: handleOpenFullscreen,
                  } as any)
                : null)}
              style={({ pressed, hovered }: any) => [
                styles.imageContainer,
                useSplitLayout && styles.imageContainerSplit,
                hovered && styles.imageContainerHovered,
                pressed && styles.imageContainerPressed,
              ]}
            >
              {({ pressed, hovered }: any) => (
                <>
                  <ImageCardMedia
                    src={imageUrl}
                    alt={title}
                    fit="contain"
                    blurBackground
                    allowCriticalWebBlur
                    revealOnLoadOnly={revealPopupImageOnLoadOnly}
                    priority="high"
                    loading="eager"
                    optimizeWeb={false}
                    style={StyleSheet.absoluteFill}
                  />
                  {Platform.OS === 'web' ? (
                    <span
                      data-card-action="true"
                      aria-hidden="true"
                      title={POPUP_TOOLTIPS.openPhoto}
                      onMouseDownCapture={handleOpenFullscreen}
                      onPointerDownCapture={handleOpenFullscreen}
                      onClickCapture={handleOpenFullscreen}
                      onTouchStartCapture={stopWebPopupEvent as any}
                      onTouchEndCapture={handleOpenFullscreen}
                      onClick={handleOpenFullscreen}
                      onMouseDown={stopWebPopupEvent as any}
                      onPointerDown={stopWebPopupEvent as any}
                      onTouchStart={stopWebPopupEvent as any}
                      onTouchEnd={handleOpenFullscreen}
                      style={{
                        position: 'absolute',
                        bottom: useCompactLayout ? 8 : 10,
                        right: useCompactLayout ? 8 : 10,
                        width: useCompactLayout ? 30 : 34,
                        height: useCompactLayout ? 30 : 34,
                        borderRadius: 9999,
                        border: 'none',
                        padding: 0,
                        backgroundColor: pressed
                          ? 'rgba(15,23,42,0.85)'
                          : hovered
                            ? 'rgba(15,23,42,0.78)'
                            : 'rgba(15,23,42,0.58)',
                        color: colors.textOnDark,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        transform: pressed ? 'scale(0.94)' : hovered ? 'scale(1.06)' : 'scale(1)',
                        transition: 'background-color 0.15s ease, transform 0.15s ease',
                      }}
                    >
                      <Feather name="maximize-2" size={16} color={colors.textOnDark} />
                    </span>
                  ) : (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.imageExpandButton,
                        hovered && styles.imageExpandButtonHovered,
                        pressed && styles.imageExpandButtonPressed,
                      ]}
                    >
                      <Feather name="maximize-2" size={16} color={colors.textOnDark} />
                    </View>
                  )}
                </>
              )}
            </Pressable>
          )}

          <View style={[styles.contentContainer, useSplitLayout && styles.contentContainerSplit]}>
            {topInfoSlot}
          </View>
        </View>

        <View style={styles.footerContainer}>
          {footerSlot}
        </View>
      </View>
    </View>
  );

  return (
    <>
      {useFullscreenMobileOverlay ? (
        <>
          <View style={{ width: 1, height: 1, opacity: 0 }} />
          <FullscreenPopupOverlay
            visible
            onClose={onClose ?? (() => {})}
            colors={colors}
            imageUrl={imageUrl}
            imageAlt={title}
            topInfoSlot={topInfoSlot}
            footerSlot={footerSlot}
            onOpenFullscreenImage={imageUrl ? handleOpenFullscreen : undefined}
          />
        </>
      ) : (
        cardBody
      )}

      {imageUrl && (
        <FullscreenImageViewer
          imageUrl={imageUrl}
          alt={title || 'Point image'}
          visible={fullscreenVisible}
          onClose={handleCloseFullscreen}
          colors={colors}
        />
      )}
    </>
  );
};

export default React.memo(PlacePopupCard);
