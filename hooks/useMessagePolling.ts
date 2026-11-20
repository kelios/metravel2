import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { focusManager } from '@tanstack/react-query';

const subscribeFocus = (listener: () => void) => focusManager.subscribe(listener);
const isFocused = () => focusManager.isFocused();

export function useMessagePolling(
    enabled: boolean,
    poll: (resuming: boolean, signal: AbortSignal) => Promise<boolean>,
    baseDelay: number,
    maxDelay: number,
) {
    const foreground = useSyncExternalStore(subscribeFocus, isFocused, isFocused);
    const active = enabled && foreground;
    const pausedPoll = useRef<typeof poll | null>(null);
    const restart = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!active) {
            pausedPoll.current = poll;
            return;
        }
        const activePeriod = new AbortController();
        let delay = baseDelay;
        let generation = 0;
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            timer = setTimeout(() => void tick(false), delay);
        };
        const tick = async (resuming: boolean) => {
            const current = generation;
            const changed = await poll(resuming, activePeriod.signal);
            if (current !== generation) return;
            delay = changed || resuming ? baseDelay : Math.min(delay * 2, maxDelay);
            schedule();
        };
        restart.current = () => {
            generation++;
            clearTimeout(timer);
            delay = baseDelay;
            schedule();
        };
        if (pausedPoll.current === poll) void tick(true);
        else schedule();
        pausedPoll.current = null;
        return () => {
            activePeriod.abort();
            generation++;
            restart.current = null;
            clearTimeout(timer);
        };
    }, [active, poll, baseDelay, maxDelay]);

    return useCallback(() => restart.current?.(), []);
}
