import { useRef, useEffect, useCallback, useMemo } from 'react';

export type DebouncedFn<T extends unknown[]> = ((...args: T) => void) & {
    flush: () => void;
    cancel: () => void;
};

export function useDebounce<T extends unknown[]>(fn: (...args: T) => void, ms = 300): DebouncedFn<T> {
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingArgs = useRef<T | null>(null);
    const fnRef = useRef(fn);
    fnRef.current = fn;

    useEffect(() => {
        return () => {
            if (timeout.current) clearTimeout(timeout.current);
        };
    }, []);

    const debounced = useCallback((...args: T) => {
        if (timeout.current) clearTimeout(timeout.current);
        pendingArgs.current = args;
        timeout.current = setTimeout(() => {
            timeout.current = null;
            pendingArgs.current = null;
            fnRef.current(...args);
        }, ms);
    }, [ms]);

    const flush = useCallback(() => {
        if (timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = null;
        }
        if (pendingArgs.current) {
            const args = pendingArgs.current;
            pendingArgs.current = null;
            fnRef.current(...args);
        }
    }, []);

    const cancel = useCallback(() => {
        if (timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = null;
        }
        pendingArgs.current = null;
    }, []);

    return useMemo(() => {
        const callable = ((...args: T) => debounced(...args)) as DebouncedFn<T>;
        callable.flush = flush;
        callable.cancel = cancel;
        return callable;
    }, [debounced, flush, cancel]);
}
