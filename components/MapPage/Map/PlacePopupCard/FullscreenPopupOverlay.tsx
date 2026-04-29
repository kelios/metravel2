import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const webCreatePortal: ((node: React.ReactNode, container: Element) => any) | null =
  Platform.OS === 'web'
    ? (() => {
        try {
          return (require('react-dom') as any)?.createPortal ?? null;
        } catch {
          return null;
        }
      })()
    : null;

const FullscreenPopupOverlay: React.FC<{
  visible: boolean;
  onClose: () => void;
  colors: ThemedColors;
  imageUrl?: string | null;
  imageAlt?: string;
  topInfoSlot: React.ReactNode;
  footerSlot: React.ReactNode;
  onOpenFullscreenImage?: (event?: any) => void;
}> = ({ visible, onClose, colors, imageUrl, imageAlt, topInfoSlot, footerSlot, onOpenFullscreenImage }) => {
  const [localHidden, setLocalHidden] = useState(false);

  // Keep the overlay visible on first open, then hide it instantly on close
  // so Leaflet does not leave a stale fullscreen layer behind.
  const effectiveVisible = visible && !localHidden;

  useEffect(() => {
    if (visible) {
      setLocalHidden(false);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    // Immediately hide the portal, then notify parent (which calls map.closePopup)
    setLocalHidden(true);
    // Use microtask to let React flush the hide before Leaflet tears down DOM
    Promise.resolve().then(() => {
      onClose();
    });
  }, [onClose]);

  const handleOpenFullscreenImage = useCallback((event?: any) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onOpenFullscreenImage?.(event);
  }, [onOpenFullscreenImage]);

  const stopOverlayEvent = useCallback((event?: any) => {
    event?.stopPropagation?.();
  }, []);

  if (Platform.OS !== 'web' || !effectiveVisible) return null;

  const hasImage = !!imageUrl;

  const overlay = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        backgroundColor: colors.surface,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={stopOverlayEvent}
      onMouseDown={stopOverlayEvent}
      onPointerDown={stopOverlayEvent}
      onTouchStart={stopOverlayEvent}
      onTouchEnd={stopOverlayEvent}
    >
      {/* Hero image — 50% of screen */}
      <div
        style={{
          position: 'relative',
          flex: '0 0 50%',
          maxHeight: '50vh',
          minHeight: '40vh',
          backgroundColor: String(colors.backgroundSecondary ?? DESIGN_TOKENS.colors.backgroundSecondary),
          overflow: 'hidden',
        }}
      >
        {hasImage ? (
          <div
            role={onOpenFullscreenImage ? 'button' : undefined}
            tabIndex={onOpenFullscreenImage ? 0 : undefined}
            title={onOpenFullscreenImage ? 'Открыть фото на весь экран' : undefined}
            aria-label={onOpenFullscreenImage ? 'Открыть фото на весь экран' : undefined}
            data-card-action="true"
            onClick={handleOpenFullscreenImage}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                handleOpenFullscreenImage(event);
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              cursor: onOpenFullscreenImage ? 'pointer' : 'default',
            }}
          >
            <ImageCardMedia
              src={imageUrl}
              alt={imageAlt || ''}
              fit="contain"
              height={undefined}
              width="100%"
              style={{ width: '100%', height: '100%' }}
              loading="eager"
              priority="high"
              allowCriticalWebBlur
              blurBackground
            />
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: String(colors.backgroundSecondary ?? DESIGN_TOKENS.colors.backgroundSecondary),
            }}
          />
        )}

        {/* Close button over image */}
        <button
          onClick={handleClose}
          onTouchEnd={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleClose()
          }}
          aria-label="Закрыть"
          title="Закрыть"
          style={{
            position: 'absolute',
            top: 'max(12px, env(safe-area-inset-top, 12px))',
            right: 12,
            width: 44,
            height: 44,
            borderRadius: DESIGN_TOKENS.radii.full,
            border: 'none',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: colors.textOnDark,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            touchAction: 'manipulation',
          }}
        >
          <Feather name="x" size={22} color={colors.textOnDark} />
        </button>

        {/* Expand image button */}
        {hasImage && onOpenFullscreenImage && (
          <button
            onClick={(e) => {
              handleOpenFullscreenImage(e)
            }}
            onTouchEnd={(e) => {
              handleOpenFullscreenImage(e)
            }}
            aria-label="Открыть фото на весь экран"
            title="Открыть фото на весь экран"
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 40,
              height: 40,
              borderRadius: DESIGN_TOKENS.radii.full,
              border: 'none',
              backgroundColor: 'rgba(15,23,42,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: colors.textOnDark,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              touchAction: 'manipulation',
              transition: 'background-color 0.15s ease, transform 0.15s ease',
            }}
          >
            <Feather name="maximize-2" size={18} color={colors.textOnDark} />
          </button>
        )}
      </div>

      {/* Content — remaining 50% with scroll */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 16,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          {topInfoSlot}
          <div style={{ marginTop: 16 }}>
            {footerSlot}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && webCreatePortal) {
    return webCreatePortal(overlay, document.body);
  }

  return overlay;
};

export default FullscreenPopupOverlay;
