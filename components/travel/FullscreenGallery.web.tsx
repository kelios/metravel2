import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme';

interface FullscreenGalleryProps {
  visible: boolean;
  images: { url: string; thumbUrl?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * Web-паритет нативной FullscreenGallery (мобильный web): полноэкранный просмотр
 * фото со свайп-листанием. Свайп — нативный горизонтальный скролл с
 * scroll-snap (та же механика paging, что у FlatList на устройстве), фото —
 * тот же ImageCardMedia contain + blur-бэкдроп, что и в нативной галерее.
 */
const RENDER_WINDOW = 2;

export default function FullscreenGallery({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: FullscreenGalleryProps) {
  const colors = useThemedColors();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  // Ставим скроллер на стартовый слайд до первой отрисовки, чтобы не мигал
  // первый кадр перед прыжком на initialIndex.
  useLayoutEffect(() => {
    if (!visible) return;
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollLeft = initialIndex * node.clientWidth;
  }, [visible, initialIndex]);

  // Escape закрывает; скролл страницы под оверлеем заблокирован.
  useEffect(() => {
    if (!visible || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible, onClose]);

  const handleScroll = useCallback(() => {
    const node = scrollerRef.current;
    if (!node || node.clientWidth === 0) return;
    const idx = Math.max(
      0,
      Math.min(images.length - 1, Math.round(node.scrollLeft / node.clientWidth)),
    );
    setCurrentIndex((prev) => (prev === idx ? prev : idx));
  }, [images.length]);

  if (!visible || images.length === 0 || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      data-testid="travel-fullscreen-gallery"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фотографий во весь экран"
      style={{
        position: 'fixed',
        inset: 0,
        background: colors.overlay,
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollerRef}
        data-testid="travel-fullscreen-gallery-scroller"
        onScroll={handleScroll}
        style={
          {
            display: 'flex',
            width: '100%',
            height: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            overscrollBehavior: 'contain',
            touchAction: 'pan-x pinch-zoom',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          } as React.CSSProperties
        }
      >
        {images.map((img, index) => (
          <div
            key={`${img.url}|${index}`}
            style={{
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              scrollSnapAlign: 'center',
              scrollSnapStop: 'always',
              position: 'relative',
            }}
          >
            {Math.abs(index - currentIndex) <= RENDER_WINDOW ? (
              <ImageCardMedia
                src={img.url}
                style={{ width: '100%', height: '100%' }}
                fit="contain"
                blurBackground
                allowCriticalWebBlur
                blurRadius={18}
                loading="eager"
                priority={index === currentIndex ? 'high' : 'normal'}
                transition={200}
                alt={`Фото маршрута ${index + 1} из ${images.length}`}
              />
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Закрыть галерею"
        data-testid="travel-fullscreen-gallery-close"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          right: 16,
          width: 48,
          height: 48,
          borderRadius: 24,
          border: 'none',
          background: 'rgba(0,0,0,0.5)',
          color: colors.textOnDark,
          fontSize: 28,
          lineHeight: 1,
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        ×
      </button>

      {images.length > 1 && (
        <div
          data-testid="travel-fullscreen-gallery-counter"
          style={{
            position: 'absolute',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: 999,
            padding: '6px 16px',
            color: colors.textOnDark,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.5,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body,
  );
}
