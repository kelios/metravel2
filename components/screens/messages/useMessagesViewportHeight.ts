import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';

/**
 * Bounds the mobile web chat to the actually visible browser viewport.
 *
 * iOS Safari and in-app browsers may keep the layout viewport taller than the
 * visible viewport while their bottom chrome or soft keyboard is open. A plain
 * `flex: 1` then puts the composer below the visible edge and makes the whole
 * document scroll. Measuring from the screen's real top keeps the app chrome and
 * composer fixed while the FlatList remains the only scroll container.
 */
export function useMessagesViewportHeight(enabled: boolean) {
    const screenRef = useRef<View>(null);
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);

    const measure = useCallback(() => {
        if (!enabled || Platform.OS !== 'web') return;
        if (typeof window === 'undefined') return;

        const node = screenRef.current as unknown as HTMLElement | null;
        const top = node?.getBoundingClientRect?.().top;
        if (typeof top !== 'number' || !Number.isFinite(top)) return;

        const visualViewport = window.visualViewport;
        const visibleBottom = visualViewport
            ? visualViewport.offsetTop + visualViewport.height
            : window.innerHeight;
        const nextHeight = Math.max(0, Math.floor(visibleBottom - top));

        setViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    }, [enabled]);

    useEffect(() => {
        if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;

        let frameId: number | null = null;
        let settleFrameId: number | null = null;
        const visualViewport = window.visualViewport;

        const schedule = () => {
            if (frameId != null) window.cancelAnimationFrame(frameId);
            if (settleFrameId != null) window.cancelAnimationFrame(settleFrameId);
            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                measure();
                // Applying the first height can move the screen's top edge in a
                // flex layout (notably the tablet/desktop messages shell).
                // Re-measure after that layout commits so the bottom converges
                // on the visible viewport instead of stopping a few pixels short.
                settleFrameId = window.requestAnimationFrame(() => {
                    settleFrameId = null;
                    measure();
                });
            });
        };

        schedule();

        try {
            visualViewport?.addEventListener('resize', schedule);
            visualViewport?.addEventListener('scroll', schedule);
        } catch {
            // Older in-app WebViews can expose visualViewport without EventTarget methods.
        }
        window.addEventListener('resize', schedule);
        window.addEventListener('orientationchange', schedule);

        return () => {
            if (frameId != null) window.cancelAnimationFrame(frameId);
            if (settleFrameId != null) window.cancelAnimationFrame(settleFrameId);
            try {
                visualViewport?.removeEventListener('resize', schedule);
                visualViewport?.removeEventListener('scroll', schedule);
            } catch {
                // noop
            }
            window.removeEventListener('resize', schedule);
            window.removeEventListener('orientationchange', schedule);
        };
    }, [enabled, measure]);

    return { screenRef, viewportHeight };
}
