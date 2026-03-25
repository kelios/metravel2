import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSliderTransitionOverlayOptions {
  images: { id: number | string; url: string }[];
  getUri: (idx: number) => string;
  indexRef: React.MutableRefObject<number>;
  currentIndex: number;
  firstImagePreloaded?: boolean;
}

export interface UseSliderTransitionOverlayResult {
  /** URI for the transition overlay (null when not needed). */
  overlayUri: string | null;
  /** Whether the overlay is visible (controls CSS opacity). */
  overlayVisible: boolean;
  handleSlideLoad: (index: number) => void;
  /** Call from animateToIndex's onBeforeNavigate to manage overlay state. */
  onBeforeNavigate: (fromIdx: number, toIdx: number) => void;
  loadedSlideIndicesRef: React.MutableRefObject<Set<number>>;
  loadedSlidesVersion: number;
}

// ---------------------------------------------------------------------------
// Hook
//
// Backdrop blur is no longer managed here — blur slides live inside the same
// track element as photo slides, so they share the identical CSS transform and
// are always perfectly synchronised.
//
// This hook only manages the transition overlay that covers the viewport while
// a target slide's image has not loaded yet.
// ---------------------------------------------------------------------------

export function useSliderTransitionOverlay(
  options: UseSliderTransitionOverlayOptions,
): UseSliderTransitionOverlayResult {
  const { images, getUri, indexRef, firstImagePreloaded } = options;

  // Transition overlay (always mounted in DOM, visibility via CSS opacity)
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [loadedSlidesVersion, setLoadedSlidesVersion] = useState(0);

  const loadedSlideIndicesRef = useRef<Set<number>>(new Set(firstImagePreloaded ? [0] : []));
  const overlayUriRef = useRef<string | null>(null);
  const overlayRevealFrameRef = useRef<number | null>(null);
  const overlayFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const clearOverlayRevealFrame = useCallback(() => {
    if (overlayRevealFrameRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(overlayRevealFrameRef.current);
      overlayRevealFrameRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Reset on images change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadedSlideIndicesRef.current = new Set<number>(firstImagePreloaded ? [0] : []);
    setLoadedSlidesVersion(0);
    setOverlayUri(null);
    setOverlayVisible(false);
    overlayUriRef.current = null;
    clearOverlayRevealFrame();
    if (overlayFadeTimerRef.current) {
      clearTimeout(overlayFadeTimerRef.current);
      overlayFadeTimerRef.current = null;
    }
  }, [clearOverlayRevealFrame, firstImagePreloaded, images]);

  // Keep ref in sync
  useEffect(() => {
    overlayUriRef.current = overlayUri;
  }, [overlayUri]);

  // ---------------------------------------------------------------------------
  // onBeforeNavigate
  // ---------------------------------------------------------------------------

  const onBeforeNavigate = useCallback(
    (fromIdx: number, toIdx: number) => {
      const fromLoaded = loadedSlideIndicesRef.current.has(fromIdx);
      const toLoaded = loadedSlideIndicesRef.current.has(toIdx);

      if (fromLoaded && !toLoaded) {
        // Target not loaded: show overlay with current slide's full image
        setOverlayUri(getUri(fromIdx));
        setOverlayVisible(true);
        overlayUriRef.current = getUri(fromIdx);
        if (overlayFadeTimerRef.current) {
          clearTimeout(overlayFadeTimerRef.current);
          overlayFadeTimerRef.current = null;
        }
      }
      // If target is already loaded — no overlay needed; backdrop blur scrolls
      // in sync via the shared track transform.
    },
    [clearOverlayRevealFrame, getUri],
  );

  // ---------------------------------------------------------------------------
  // handleSlideLoad
  // ---------------------------------------------------------------------------

  const handleSlideLoad = useCallback(
    (index: number) => {
      if (!loadedSlideIndicesRef.current.has(index)) {
        const next = new Set(loadedSlideIndicesRef.current);
        next.add(index);
        loadedSlideIndicesRef.current = next;
        setLoadedSlidesVersion((value) => value + 1);
      }

      if (index === indexRef.current && overlayUriRef.current) {
        if (overlayFadeTimerRef.current) {
          clearTimeout(overlayFadeTimerRef.current);
        }
        clearOverlayRevealFrame();

        const startOverlayFade = () => {
          setOverlayVisible(false);
          overlayFadeTimerRef.current = setTimeout(() => {
            setOverlayUri(null);
            overlayUriRef.current = null;
            overlayFadeTimerRef.current = null;
          }, 300);
        };

        if (typeof window === 'undefined') {
          startOverlayFade();
        } else {
          overlayRevealFrameRef.current = window.requestAnimationFrame(() => {
            overlayRevealFrameRef.current = window.requestAnimationFrame(() => {
              overlayRevealFrameRef.current = null;
              startOverlayFade();
            });
          });
        }
      }
    },
    [clearOverlayRevealFrame, indexRef],
  );

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      clearOverlayRevealFrame();
      if (overlayFadeTimerRef.current) clearTimeout(overlayFadeTimerRef.current);
    };
  }, [clearOverlayRevealFrame]);

  return {
    overlayUri,
    overlayVisible,
    handleSlideLoad,
    onBeforeNavigate,
    loadedSlideIndicesRef,
    loadedSlidesVersion,
  };
}
