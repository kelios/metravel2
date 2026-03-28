import React, { useMemo } from 'react';
import { Platform, Pressable, View } from 'react-native';
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
      borderRadius: `${MEDIA_RADIUS}px`,
      border: `1px solid ${isDropTarget ? colors.primary : colors.borderLight}`,
      backgroundColor: colors.surface,
      boxShadow: isDropTarget
        ? '0 6px 20px rgba(77, 124, 112, 0.18)'
        : '0 2px 8px rgba(0,0,0,0.08)',
      opacity: isDragging ? 0.58 : 1,
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
      border: `1px solid ${colors.borderLight}`,
      backgroundColor: colors.surface,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      fontSize: '12px',
      fontWeight: 600,
      color: colors.text,
      lineHeight: '1',
    };
    const controlsStyle: React.CSSProperties = {
      position: 'absolute',
      left: '8px',
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 4,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: '8px',
    };
    const actionButtonStyle: React.CSSProperties = {
      width: '28px',
      height: '28px',
      borderRadius: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '0',
      backgroundColor: 'rgba(255,255,255,0.95)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      backdropFilter: 'blur(8px)',
      cursor: 'pointer',
      padding: 0,
    };
    const titleOverlayStyle: React.CSSProperties = {
      position: 'absolute',
      left: '8px',
      right: '8px',
      bottom: '8px',
      zIndex: 2,
      padding: '8px 12px',
      borderRadius: '12px',
      backgroundColor: 'rgba(17, 24, 39, 0.64)',
      backdropFilter: 'blur(10px)',
      color: colors.textOnDark,
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: '1.2',
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
        styles.selectedOrderItem,
        isDragging ? styles.selectedOrderItemDragging : null,
        isDropTarget ? styles.selectedOrderItemDropTarget : null,
      ]}
      {...(Platform.OS === 'web'
        ? ({
            draggable: true,
            onDragStart: (event: any) => {
              if (event.dataTransfer) {
                event.dataTransfer.setData('text/plain', itemId);
                event.dataTransfer.effectAllowed = 'move';
              }
              onDragStart();
            },
            onDragEnter: (event: any) => {
              event.preventDefault?.();
              onDragEnter();
            },
            onDragOver: (event: any) => {
              event.preventDefault?.();
            },
            onDrop: (event: any) => {
              event.preventDefault?.();
              onDrop(event.dataTransfer?.getData?.('text/plain'));
            },
            onDragEnd: () => onDragEnd(),
          } as any)
        : null)}
    >
      <View style={styles.selectedOrderMediaWrap}>
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
            style={styles.selectedOrderMedia}
          />
        ) : (
          <View
            style={[
              styles.selectedOrderMedia,
              styles.selectedOrderMediaPlaceholder,
            ]}
          />
        )}
        <View style={styles.selectedOrderIndexBadge}>
          <Caption
            muted={false}
            style={styles.selectedOrderIndex}
          >
            {index + 1}
          </Caption>
        </View>
        <View style={styles.selectedOrderTitleOverlay}>
          <Caption
            muted={false}
            style={styles.selectedOrderOverlayTitle}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {travel.name || 'Без названия'}
          </Caption>
        </View>
        <View style={styles.selectedOrderControlsOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Поднять ${travel.name || 'путешествие'} выше`}
            disabled={!canMoveUp}
            onPress={onMoveUp}
            style={[
              styles.selectedOrderActionButton,
              !canMoveUp && styles.selectedOrderActionButtonDisabled,
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
              styles.selectedOrderActionButton,
              !canMoveDown && styles.selectedOrderActionButtonDisabled,
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
