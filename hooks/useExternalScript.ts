import { useEffect, useRef } from 'react';

export type UseExternalScriptOptions = {
    id: string;
    src: string;
    onReady: () => void;
    onError: () => void;
    enabled?: boolean;
    crossOrigin?: HTMLScriptElement['crossOrigin'];
};

const SCRIPT_STATUS_ATTRIBUTE = 'data-metravel-script-status';
const SCRIPT_STATUS_LOADING = 'loading';
const SCRIPT_STATUS_LOADED = 'loaded';
const SCRIPT_STATUS_ERROR = 'error';

const trackScriptStatus = (script: HTMLScriptElement): void => {
    if (script.hasAttribute(SCRIPT_STATUS_ATTRIBUTE)) return;

    script.setAttribute(SCRIPT_STATUS_ATTRIBUTE, SCRIPT_STATUS_LOADING);
    const markLoaded = () => {
        script.setAttribute(SCRIPT_STATUS_ATTRIBUTE, SCRIPT_STATUS_LOADED);
        script.removeEventListener('error', markError);
    };
    const markError = () => {
        script.setAttribute(SCRIPT_STATUS_ATTRIBUTE, SCRIPT_STATUS_ERROR);
        script.removeEventListener('load', markLoaded);
    };
    script.addEventListener('load', markLoaded, { once: true });
    script.addEventListener('error', markError, { once: true });
};

const scriptSrcMatches = (script: HTMLScriptElement, src: string): boolean => {
    if (script.getAttribute('src') === src || script.src === src) return true;
    try {
        return script.src === new URL(src, document.baseURI).href;
    } catch {
        return false;
    }
};

/**
 * Подключает внешний browser SDK один раз и переиспользует его между формами.
 * Provider readiness и OAuth callbacks намеренно остаются у потребителей.
 */
export function useExternalScript({
    id,
    src,
    onReady,
    onError,
    enabled = true,
    crossOrigin,
}: UseExternalScriptOptions): void {
    const onReadyRef = useRef(onReady);
    const onErrorRef = useRef(onError);
    onReadyRef.current = onReady;
    onErrorRef.current = onError;

    useEffect(() => {
        if (!enabled || !id || !src || typeof document === 'undefined') return undefined;

        let script = document.getElementById(id) as HTMLScriptElement | null;
        const handleLoad = () => {
            onReadyRef.current();
        };
        const handleError = () => {
            onErrorRef.current();
        };

        // #1975: locale-specific SDK URLs (Facebook JS SDK) must not stay
        // pinned to the first inserted src after LocaleProvider resolves.
        if (script && !scriptSrcMatches(script, src)) {
            script.remove();
            script = null;
        }

        if (!script) {
            script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.async = true;
            script.defer = true;
            if (crossOrigin) script.crossOrigin = crossOrigin;
            trackScriptStatus(script);
            script.addEventListener('load', handleLoad, { once: true });
            script.addEventListener('error', handleError, { once: true });
            document.body.appendChild(script);
        } else {
            const status = script.getAttribute(SCRIPT_STATUS_ATTRIBUTE);
            if (status === SCRIPT_STATUS_LOADED) {
                onReadyRef.current();
            } else if (status === SCRIPT_STATUS_ERROR) {
                onErrorRef.current();
            } else {
                trackScriptStatus(script);
                script.addEventListener('load', handleLoad, { once: true });
                script.addEventListener('error', handleError, { once: true });
            }
        }

        return () => {
            script?.removeEventListener('load', handleLoad);
            script?.removeEventListener('error', handleError);
        };
    }, [crossOrigin, enabled, id, src]);
}
