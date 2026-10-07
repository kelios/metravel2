import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import ZoomableGalleryImage from '@/components/travel/ZoomableGalleryImage.web';
import { useThemedColors } from '@/hooks/useTheme';
import { makeContentRef } from '@/types/contentSafety';
import { translate as i18nT } from '@/i18n'


// Меню жалобы грузится с открытием галереи, а не с чанком слайдера героя.
const ContentSafetyActions = lazy(() => import('@/components/safety/ContentSafetyActions'));

interface FullscreenGalleryProps {
  visible: boolean;
  /** `id` — id фото галереи на бэке; индекс слайда сюда не кладётся. */
  images: { id?: number; url: string; thumbUrl?: string; alt?: string; caption?: string }[];
  initialIndex?: number;
  onClose: () => void;
  /** Cap the photo viewport while keeping full-screen navigation and gestures. */
  maxImageSize?: number;
  /** Автор фото для жалобы (#2133); жалоба доступна только у фото с настоящим `id`. */
  safetyAuthorId?: number | string | null;
  authorName?: string | null;
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
  maxImageSize,
  safetyAuthorId = null,
  authorName,
}: FullscreenGalleryProps) {
  const colors = useThemedColors();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const imageWidth = Math.min(viewportWidth, maxImageSize ?? viewportWidth);
  const imageHeight = Math.min(viewportHeight, maxImageSize ?? viewportHeight);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const navigate = useCallback((direction: number) => {
    const node = scrollerRef.current;
    if (!node || images.length < 2) return;
    const nextIndex = (currentIndex + direction + images.length) % images.length;
    node.scrollTo({ left: nextIndex * node.clientWidth, behavior: 'smooth' });
    setZoomedIndex(null);
    setCurrentIndex(nextIndex);
  }, [currentIndex, images.length]);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setZoomedIndex(null);
    }
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
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.focus();
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Escape над открытым листом жалобы (#2133) закрывает лист, а не галерею:
      // активный RN-web Modal — свой `[role=dialog][aria-modal]` вне корня галереи,
      // и он сам закрывается по keyup.
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
      if (dialogs.some((node) => node !== rootRef.current && !rootRef.current?.contains(node))) return;
      onCloseRef.current();
    };
    // RN-web modals also close on keyup. Closing here avoids passing the release
    // of a held Escape to the reviews sheet that is mounted when we close.
    window.addEventListener('keyup', onKeyUp);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keyup', onKeyUp);
      document.body.style.overflow = prevOverflow;
      previousFocus?.focus();
    };
  }, [visible]);

  const handleScroll = useCallback(() => {
    const node = scrollerRef.current;
    if (!node || node.clientWidth === 0) return;
    const idx = Math.max(
      0,
      Math.min(images.length - 1, Math.round(node.scrollLeft / node.clientWidth)),
    );
    setCurrentIndex((prev) => (prev === idx ? prev : idx));
  }, [images.length]);

  const currentPhotoId = images[currentIndex]?.id;
  const safetyRef = useMemo(
    () => makeContentRef('photo', currentPhotoId, safetyAuthorId),
    [currentPhotoId, safetyAuthorId],
  );

  if (!visible || images.length === 0 || typeof document === 'undefined') {
    return null;
  }

  const currentCaption = String(images[currentIndex]?.caption ?? '').trim();

  return createPortal(
    <div
      ref={rootRef}
      data-testid="travel-fullscreen-gallery"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={(event) => {
        const root = rootRef.current;
        const target = event.target;
        // React portal events bubble through the gallery from safety dialogs.
        if (event.defaultPrevented || !root || !(target instanceof HTMLElement) || !root.contains(target)) return;
        if (event.key === 'Tab') {
          const controls = Array.from(root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
          ));
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (!first || (event.shiftKey && (target === first || target === root)) || (!event.shiftKey && target === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
          }
          return;
        }
        if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        navigate(event.key === 'ArrowLeft' ? -1 : 1);
      }}
      aria-label={i18nT('travel:components.travel.FullscreenGallery.prosmotr_fotografiy_vo_ves_ekran_63f790d9')}
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
            overflowX: zoomedIndex == null ? 'auto' : 'hidden',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            overscrollBehavior: 'contain',
            touchAction: 'pan-x',
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {Math.abs(index - currentIndex) <= RENDER_WINDOW ? (
              <ZoomableGalleryImage
                src={img.url}
                width={imageWidth}
                height={imageHeight}
                priority={index === currentIndex ? 'high' : 'normal'}
                alt={img.alt || i18nT('travel:components.travel.FullscreenGalleryWeb.routePhotoAlt', { value1: index + 1, value2: images.length })}
                resetKey={`${visible}-${index}-${currentIndex}`}
                onInteractionChange={(active) => {
                  setZoomedIndex((current) => {
                    if (active) return index;
                    return current === index ? null : current;
                  });
                }}
              />
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label={i18nT('travel:components.travel.FullscreenGallery.zakryt_galereyu_9e4ee562')}
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

      {images.length > 1 && (['previous', 'next'] as const).map((direction) => (
        <button
          key={direction}
          type="button"
          data-testid={`travel-fullscreen-gallery-${direction}`}
          aria-label={i18nT(direction === 'previous'
            ? 'travel:components.travel.NavigationArrows.predyduschee_93e3f9c1'
            : 'travel:components.travel.NavigationArrows.sleduyuschee_8a76bd06')}
          onClick={() => navigate(direction === 'previous' ? -1 : 1)}
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            ...(direction === 'previous' ? { left: 16 } : { right: 16 }),
            width: 48,
            height: 48,
            borderRadius: 24,
            border: 'none',
            background: colors.overlay,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={direction === 'previous' ? 'chevron-left' : 'chevron-right'} size={24} color={colors.textOnDark} />
        </button>
      ))}

      {safetyRef ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
            left: 16,
            zIndex: 10,
          }}
        >
          <Suspense fallback={null}>
            <ContentSafetyActions
              contentRef={safetyRef}
              authorName={authorName}
              appearance="surface"
              testIDPrefix="travel-fullscreen-gallery-safety"
            />
          </Suspense>
        </div>
      ) : null}

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

      {currentCaption ? (
        <div
          data-testid="travel-fullscreen-gallery-caption"
          style={{
            position: 'absolute',
            bottom: images.length > 1
              ? 'calc(env(safe-area-inset-bottom, 0px) + 60px)'
              : 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',
            maxWidth: '88%',
            boxSizing: 'border-box',
            background: colors.overlay,
            borderRadius: 16,
            padding: '10px 16px',
            color: colors.textOnDark,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: '22px',
            letterSpacing: '-0.1px',
            textAlign: 'center',
            boxShadow: colors.boxShadows?.medium,
            backdropFilter: 'blur(16px) saturate(1.25)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.25)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {currentCaption}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
