import React, { useMemo } from 'react';
import { Platform, Pressable, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { Travel } from '@/types/types';
import { useThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { Caption } from '@/components/ui/Typography';
import { createStyles } from './listTravelStyles';

type ExportBarStyles = ReturnType<typeof createStyles>;
const MEDIA_WIDTH = 128;
const MEDIA_HEIGHT = 96;
const MEDIA_RADIUS = 10;

type Props = {
  travel: Travel;
  itemId: string;
  index: number;
  isMobile: boolean;
  styles: ExportBarStyles;
  isDragging: boolean;
  isDropTarget: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: (sourceId?: string | null) => void;
  onDragEnd: () => void;
};

function resolveTravelCover(travel: Travel): string | null {
  const galleryFirst =
    Array.isArray(travel.gallery) && travel.gallery.length > 0
      ? typeof travel.gallery[0] === 'string'
        ? travel.gallery[0]
        : travel.gallery[0]?.url
      : null;

  return (
    travel.travel_image_thumb_url ||
    (travel as any).travel_image_thumb_small_url ||
    galleryFirst ||
    null
  );
}

export default function SelectedTravelOrderCard({
  travel,
  itemId,
  index,
  isMobile: _isMobile,
  styles,
  isDragging,
  isDropTarget,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: Props) {
  const colors = useThemedColors();
  const cover = useMemo(() => resolveTravelCover(travel), [travel]);
  const asViewStyle = (style: unknown): StyleProp<ViewStyle> => style as StyleProp<ViewStyle>;
  const asTextStyle = (style: unknown): StyleProp<TextStyle> => style as StyleProp<TextStyle>;

  if (Platform.OS === 'web') {
    const cardShellStyle: React.CSSProperties = {
      width: `${MEDIA_WIDTH}px`,
      minWidth: `${MEDIA_WIDTH}px`,
      maxWidth: `${MEDIA_WIDTH}px`,
      flex: '0 0 auto',
      display: 'block',
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none',
    };
    const mediaWrapStyle: React.CSSProperties = {
      position: 'relative',
      width: `${MEDIA_WIDTH}px`,
      height: `${MEDIA_HEIGHT}px`,
      overflow: 'hidden',
      borderRadius: '12px',
      border: `1.5px solid ${isDropTarget ? colors.primary : 'transparent'}`,
      backgroundColor: colors.surface,
      boxShadow: isDropTarget
        ? '0 4px 16px rgba(77, 124, 112, 0.22)'
        : '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      opacity: isDragging ? 0.5 : 1,
      transition: 'all 0.2s ease',
    };
    const badgeStyle: React.CSSProperties = {
      position: 'absolute',
      top: '6px',
      left: '6px',
      zIndex: 3,
      minWidth: '22px',
      height: '22px',
      padding: '0 6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '999px',
      backgroundColor: colors.primary,
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      fontSize: '11px',
      fontWeight: 700,
      color: '#fff',
      lineHeight: '1',
    };
    const controlsStyle: React.CSSProperties = {
      position: 'absolute',
      left: '6px',
      right: '6px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 4,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: '6px',
    };
    const actionButtonStyle: React.CSSProperties = {
      width: '26px',
      height: '26px',
      borderRadius: '13px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '0',
      backgroundColor: 'rgba(255,255,255,0.92)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      backdropFilter: 'blur(6px)',
      cursor: 'pointer',
      padding: 0,
      transition: 'opacity 0.15s ease',
    };
    const titleOverlayStyle: React.CSSProperties = {
      position: 'absolute',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: 2,
      padding: '6px 8px',
      borderBottomLeftRadius: '11px',
      borderBottomRightRadius: '11px',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      backdropFilter: 'blur(8px)',
      color: '#fff',
      fontSize: '12px',
      fontWeight: 600,
      lineHeight: '1.3',
      overflow: 'hidden',
      pointerEvents: 'none',
    };
    const titleTextStyle: React.CSSProperties = {
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'normal',
    };

    return (
      <div
        style={cardShellStyle}
        draggable
        onDragStart={(event) => {
          event.dataTransfer?.setData('text/plain', itemId);
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
          }
          onDragStart();
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragEnter();
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(event.dataTransfer?.getData('text/plain'));
        }}
        onDragEnd={() => onDragEnd()}
      >
        <div style={mediaWrapStyle}>
          {cover ? (
            <img
              src={cover}
              alt={travel.name || 'Путешествие'}
              width={MEDIA_WIDTH}
              height={MEDIA_HEIGHT}
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                display: 'block',
                borderRadius: MEDIA_RADIUS,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: colors.backgroundSecondary,
              }}
            />
          )}

          <div style={badgeStyle}>
            <span>{index + 1}</span>
          </div>

          <div style={controlsStyle}>
            <button
              type="button"
              aria-label={`Поднять ${travel.name || 'путешествие'} выше`}
              disabled={!canMoveUp}
              onClick={onMoveUp}
              style={{
                ...actionButtonStyle,
                opacity: canMoveUp ? 1 : 0.38,
                cursor: canMoveUp ? 'pointer' : 'default',
              }}
            >
              <Feather
                name="chevron-left"
                size={14}
                color={canMoveUp ? colors.text : colors.textTertiary}
              />
            </button>
            <button
              type="button"
              aria-label={`Опустить ${travel.name || 'путешествие'} ниже`}
              disabled={!canMoveDown}
              onClick={onMoveDown}
              style={{
                ...actionButtonStyle,
                opacity: canMoveDown ? 1 : 0.38,
                cursor: canMoveDown ? 'pointer' : 'default',
              }}
            >
              <Feather
                name="chevron-right"
                size={14}
                color={canMoveDown ? colors.text : colors.textTertiary}
              />
            </button>
          </div>

          <div style={titleOverlayStyle}>
            <span style={titleTextStyle}>
              {travel.name || 'Без названия'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <View
      style={[
        asViewStyle(styles.selectedOrderItem),
        isDragging ? asViewStyle(styles.selectedOrderItemDragging) : null,
        isDropTarget ? asViewStyle(styles.selectedOrderItemDropTarget) : null,
      ]}
    >
      <View style={asViewStyle(styles.selectedOrderMediaWrap)}>
        {cover ? (
          <ImageCardMedia
            src={cover}
            alt={travel.name || 'Путешествие'}
            width={MEDIA_WIDTH}
            height={MEDIA_HEIGHT}
            borderRadius={MEDIA_RADIUS}
            fit="cover"
            blurBackground
            allowCriticalWebBlur
            priority="low"
            loading="lazy"
            style={asViewStyle(styles.selectedOrderMedia)}
          />
        ) : (
          <View
            style={[
              asViewStyle(styles.selectedOrderMedia),
              asViewStyle(styles.selectedOrderMediaPlaceholder),
            ]}
          />
        )}
        <View style={asViewStyle(styles.selectedOrderIndexBadge)}>
          <Caption
            muted={false}
            style={asTextStyle(styles.selectedOrderIndex)}
          >
            {index + 1}
          </Caption>
        </View>
        <View style={asViewStyle(styles.selectedOrderTitleOverlay)}>
          <Caption
            muted={false}
            style={asTextStyle(styles.selectedOrderOverlayTitle)}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {travel.name || 'Без названия'}
          </Caption>
        </View>
        <View style={asViewStyle(styles.selectedOrderControlsOverlay)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Поднять ${travel.name || 'путешествие'} выше`}
            disabled={!canMoveUp}
            onPress={onMoveUp}
            style={[
              asViewStyle(styles.selectedOrderActionButton),
              !canMoveUp ? asViewStyle(styles.selectedOrderActionButtonDisabled) : null,
            ]}
          >
            <Feather
              name="chevron-left"
              size={18}
              color={canMoveUp ? colors.text : colors.textTertiary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Опустить ${travel.name || 'путешествие'} ниже`}
            disabled={!canMoveDown}
            onPress={onMoveDown}
            style={[
              asViewStyle(styles.selectedOrderActionButton),
              !canMoveDown ? asViewStyle(styles.selectedOrderActionButtonDisabled) : null,
            ]}
          >
            <Feather
              name="chevron-right"
              size={18}
              color={canMoveDown ? colors.text : colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
