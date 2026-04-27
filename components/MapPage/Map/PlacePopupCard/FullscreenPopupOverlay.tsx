import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';

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
  onOpenFullscreenImage?: () => void;
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

  if (Platform.OS !== 'web' || !effectiveVisible) return null;

  const hasImage = !!imageUrl;

  const overlay = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: colors.surface,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Hero image — 50% of screen */}
      <div
        style={{
          position: 'relative',
          flex: '0 0 50%',
          maxHeight: '50vh',
          minHeight: '40vh',
          backgroundColor: String(colors.backgroundSecondary ?? '#eee'),
          overflow: 'hidden',
        }}
      >
        {hasImage ? (
          <div
            onClick={onOpenFullscreenImage}
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
              backgroundColor: String(colors.backgroundSecondary ?? '#eee'),
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
          style={{
            position: 'absolute',
            top: 'max(12px, env(safe-area-inset-top, 12px))',
            right: 12,
            width: 44,
            height: 44,
            borderRadius: 22,
            border: 'none',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            touchAction: 'manipulation',
          }}
        >
          <Feather name="x" size={22} color="#fff" />
        </button>

        {/* Expand image button */}
        {hasImage && onOpenFullscreenImage && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenFullscreenImage()
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenFullscreenImage()
            }}
            aria-label="Открыть фото на весь экран"
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 40,
              height: 40,
              borderRadius: 20,
              border: 'none',
              backgroundColor: 'rgba(15,23,42,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              touchAction: 'manipulation',
              transition: 'background-color 0.15s ease, transform 0.15s ease',
            }}
          >
            <Feather name="maximize-2" size={18} color="#fff" />
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
