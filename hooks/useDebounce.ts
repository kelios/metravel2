import { useRef, useEffect, useCallback } from 'react';

export function useDebounce<T extends unknown[]>(fn: (...args: T) => void, ms = 300) {
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fnRef = useRef(fn);
    fnRef.current = fn;

    useEffect(() => {
        return () => {
            if (timeout.current) clearTimeout(timeout.current);
        };
    }, []);

    return useCallback((...args: T) => {
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => fnRef.current(...args), ms);
    }, [ms]);
}
