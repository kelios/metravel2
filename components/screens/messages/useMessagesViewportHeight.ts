import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';

const MIN_CHAT_HEIGHT = 240;

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
        if (!Number.isFinite(top)) return;

        const visualViewport = window.visualViewport;
        const visibleBottom = visualViewport
            ? visualViewport.offsetTop + visualViewport.height
            : window.innerHeight;
        const nextHeight = Math.max(MIN_CHAT_HEIGHT, Math.floor(visibleBottom - Number(top)));

        setViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    }, [enabled]);

    useEffect(() => {
        if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') {
            setViewportHeight(null);
            return;
        }

        let frameId: number | null = null;
        let settleFrameId: number | null = null;
        const visualViewport = window.visualViewport;

        const schedule = () => {
            if (frameId != null) window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(measure);
        };

        schedule();
        // The responsive header finishes measuring immediately after hydration.
        // Re-measure on the following paint so its final height is reflected too.
        settleFrameId = window.requestAnimationFrame(schedule);

        visualViewport?.addEventListener('resize', schedule);
        visualViewport?.addEventListener('scroll', schedule);
        window.addEventListener('resize', schedule);
        window.addEventListener('orientationchange', schedule);

        return () => {
            if (frameId != null) window.cancelAnimationFrame(frameId);
            if (settleFrameId != null) window.cancelAnimationFrame(settleFrameId);
            visualViewport?.removeEventListener('resize', schedule);
            visualViewport?.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('orientationchange', schedule);
        };
    }, [enabled, measure]);

    return { screenRef, viewportHeight };
}
