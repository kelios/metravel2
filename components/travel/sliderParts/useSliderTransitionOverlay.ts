import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSliderTransitionOverlayOptions {
  images: { id: number | string; url: string }[];
  getUri: (idx: number) => string;
  indexRef: React.MutableRefObject<number>;
  currentIndex: number;
  blurBackground: boolean;
  firstImagePreloaded?: boolean;
}

export interface BackdropLayer {
  uri: string | null;
  active: boolean;
}

export interface UseSliderTransitionOverlayResult {
  /** Backdrop layer A — always mounted, opacity controlled by `active`. */
  backdropA: BackdropLayer;
  /** Backdrop layer B — always mounted, opacity controlled by `active`. */
  backdropB: BackdropLayer;
  /** URI for the transition overlay (null when not needed). */
  overlayUri: string | null;
  /** Whether the overlay is visible (controls CSS opacity). */
  overlayVisible: boolean;
  handleSlideLoad: (index: number) => void;
  /** Call from animateToIndex's onBeforeNavigate to manage overlay state. */
  onBeforeNavigate: (fromIdx: number, toIdx: number) => void;
  loadedSlideIndicesRef: React.MutableRefObject<Set<number>>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSliderTransitionOverlay(
  options: UseSliderTransitionOverlayOptions,
): UseSliderTransitionOverlayResult {
  const { images, getUri, indexRef, currentIndex, blurBackground, firstImagePreloaded } = options;

  const initialUri = images.length ? getUri(0) : null;

  // Dual-layer backdrop: two layers alternate so the src swap happens on the
  // HIDDEN layer (opacity 0). A rAF gap lets the browser decode the new image
  // before the CSS opacity transition crossfades the layers.
  const [layerAUri, setLayerAUri] = useState<string | null>(initialUri);
  const [layerBUri, setLayerBUri] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  const activeLayerRef = useRef<'A' | 'B'>('A');

  // Transition overlay (always mounted in DOM, visibility via CSS opacity)
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const loadedSlideIndicesRef = useRef<Set<number>>(new Set(firstImagePreloaded ? [0] : []));
  const overlayUriRef = useRef<string | null>(null);
  const crossfadeFrameRef = useRef<number | null>(null);
  const overlayRevealFrameRef = useRef<number | null>(null);
  const overlayFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropDeferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimatingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const cancelCrossfadeFrame = useCallback(() => {
    if (crossfadeFrameRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(crossfadeFrameRef.current);
      crossfadeFrameRef.current = null;
    }
  }, []);

  const clearOverlayRevealFrame = useCallback(() => {
    if (overlayRevealFrameRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(overlayRevealFrameRef.current);
      overlayRevealFrameRef.current = null;
    }
  }, []);

  // Crossfade backdrop to a new URI.
  // Sets the URI on the currently-HIDDEN layer, then after a double-rAF flips
  // the active layer so the CSS opacity transition produces a smooth crossfade.
  const crossfadeBackdrop = useCallback(
    (newUri: string | null) => {
      cancelCrossfadeFrame();

      const setInactive = activeLayerRef.current === 'A' ? setLayerBUri : setLayerAUri;
      const nextActive: 'A' | 'B' = activeLayerRef.current === 'A' ? 'B' : 'A';

      // Put the new image on the hidden layer
      setInactive(newUri);

      if (typeof window === 'undefined') {
        // SSR / test: flip immediately
        setActiveLayer(nextActive);
        activeLayerRef.current = nextActive;
        return;
      }

      // Double rAF: first frame commits the new <img> src to DOM,
      // second frame flips opacity so the browser has decoded the image.
      crossfadeFrameRef.current = window.requestAnimationFrame(() => {
        crossfadeFrameRef.current = window.requestAnimationFrame(() => {
          crossfadeFrameRef.current = null;
          setActiveLayer(nextActive);
          activeLayerRef.current = nextActive;
        });
      });
    },
    [cancelCrossfadeFrame],
  );

  // ---------------------------------------------------------------------------
  // Reset on images change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const nextLoaded = new Set<number>(firstImagePreloaded ? [0] : []);
    loadedSlideIndicesRef.current = nextLoaded;
    const uri = images.length ? getUri(0) : null;
    setLayerAUri(uri);
    setLayerBUri(null);
    setActiveLayer('A');
    activeLayerRef.current = 'A';
    setOverlayUri(null);
    setOverlayVisible(false);
    overlayUriRef.current = null;
    cancelCrossfadeFrame();
    clearOverlayRevealFrame();
    if (overlayFadeTimerRef.current) {
      clearTimeout(overlayFadeTimerRef.current);
      overlayFadeTimerRef.current = null;
    }
    if (backdropDeferTimerRef.current) {
      clearTimeout(backdropDeferTimerRef.current);
      backdropDeferTimerRef.current = null;
    }
    isAnimatingRef.current = false;
  }, [cancelCrossfadeFrame, clearOverlayRevealFrame, firstImagePreloaded, getUri, images]);

  // Keep ref in sync
  useEffect(() => {
    overlayUriRef.current = overlayUri;
  }, [overlayUri]);

  // Update backdrop when current slide is loaded (skip during animation)
  useEffect(() => {
    if (!blurBackground) return;
    if (isAnimatingRef.current) return;
    if (!loadedSlideIndicesRef.current.has(currentIndex)) return;
    crossfadeBackdrop(getUri(currentIndex));
  }, [blurBackground, crossfadeBackdrop, currentIndex, getUri]);

  // ---------------------------------------------------------------------------
  // onBeforeNavigate
  // ---------------------------------------------------------------------------

  const onBeforeNavigate = useCallback(
    (fromIdx: number, toIdx: number) => {
      isAnimatingRef.current = true;

      if (backdropDeferTimerRef.current) {
        clearTimeout(backdropDeferTimerRef.current);
        backdropDeferTimerRef.current = null;
      }

      const fromLoaded = loadedSlideIndicesRef.current.has(fromIdx);
      const toLoaded = loadedSlideIndicesRef.current.has(toIdx);

      if (fromLoaded && !toLoaded) {
        // Target not loaded: show overlay with current image
        setOverlayUri(getUri(fromIdx));
        setOverlayVisible(true);
        overlayUriRef.current = getUri(fromIdx);
        if (overlayFadeTimerRef.current) {
          clearTimeout(overlayFadeTimerRef.current);
          overlayFadeTimerRef.current = null;
        }
        // Reset animating flag after animation so currentIndex effect can
        // serve as a fallback if handleSlideLoad fires late.
        backdropDeferTimerRef.current = setTimeout(() => {
          isAnimatingRef.current = false;
          backdropDeferTimerRef.current = null;
        }, 320);
      } else if (toLoaded) {
        // Target loaded: defer backdrop crossfade until after the CSS
        // transform animation completes (~280ms).
        setOverlayVisible(false);
        backdropDeferTimerRef.current = setTimeout(() => {
          isAnimatingRef.current = false;
          crossfadeBackdrop(getUri(toIdx));
          backdropDeferTimerRef.current = null;
        }, 300);
      }
    },
    [crossfadeBackdrop, getUri],
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
      }

      if (index === indexRef.current && overlayUriRef.current) {
        if (overlayFadeTimerRef.current) {
          clearTimeout(overlayFadeTimerRef.current);
        }
        if (backdropDeferTimerRef.current) {
          clearTimeout(backdropDeferTimerRef.current);
          backdropDeferTimerRef.current = null;
        }
        isAnimatingRef.current = false;
        clearOverlayRevealFrame();
        crossfadeBackdrop(getUri(index));

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
    [clearOverlayRevealFrame, crossfadeBackdrop, getUri, indexRef],
  );

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      cancelCrossfadeFrame();
      clearOverlayRevealFrame();
      if (overlayFadeTimerRef.current) clearTimeout(overlayFadeTimerRef.current);
      if (backdropDeferTimerRef.current) clearTimeout(backdropDeferTimerRef.current);
    };
  }, [cancelCrossfadeFrame, clearOverlayRevealFrame]);

  return {
    backdropA: { uri: layerAUri, active: activeLayer === 'A' },
    backdropB: { uri: layerBUri, active: activeLayer === 'B' },
    overlayUri,
    overlayVisible,
    handleSlideLoad,
    onBeforeNavigate,
    loadedSlideIndicesRef,
  };
}
