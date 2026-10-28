/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native';

import { useExternalScript } from '@/hooks/useExternalScript';

const SCRIPT_ID = 'test-external-sdk';
const SCRIPT_SRC = 'https://sdk.example.com/client.js';

describe('useExternalScript', () => {
    afterEach(() => {
        document.getElementById(SCRIPT_ID)?.remove();
        jest.clearAllMocks();
    });

    it('creates one async deferred script with the requested attributes', async () => {
        await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: jest.fn(),
            crossOrigin: 'anonymous',
        }));

        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        expect(script?.src).toBe(SCRIPT_SRC);
        expect(script?.async).toBe(true);
        expect(script?.defer).toBe(true);
        expect(script?.crossOrigin).toBe('anonymous');
    });

    it('reuses the same node for concurrent consumers and notifies both', async () => {
        const firstReady = jest.fn();
        const secondReady = jest.fn();
        const first = await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: firstReady,
            onError: jest.fn(),
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        const second = await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: secondReady,
            onError: jest.fn(),
        }));

        expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
        expect(document.getElementById(SCRIPT_ID)).toBe(script);

        await act(() => script.dispatchEvent(new Event('load')));

        expect(firstReady).toHaveBeenCalledTimes(1);
        expect(secondReady).toHaveBeenCalledTimes(1);
        await first.unmount();
        await second.unmount();
    });

    it('keeps the loaded node across unmount/remount and reports readiness', async () => {
        const firstReady = jest.fn();
        const first = await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: firstReady,
            onError: jest.fn(),
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        await act(() => script.dispatchEvent(new Event('load')));
        await first.unmount();

        const remountReady = jest.fn();
        await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: remountReady,
            onError: jest.fn(),
        }));

        expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
        expect(document.getElementById(SCRIPT_ID)).toBe(script);
        expect(remountReady).toHaveBeenCalledTimes(1);
    });

    it('records completion after every consumer unmounts so a remount still becomes ready', async () => {
        const first = await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: jest.fn(),
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        await first.unmount();
        await act(() => script.dispatchEvent(new Event('load')));

        const remountReady = jest.fn();
        await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: remountReady,
            onError: jest.fn(),
        }));

        expect(remountReady).toHaveBeenCalledTimes(1);
    });

    it('removes listeners on unmount without removing the reusable node', async () => {
        const onReady = jest.fn();
        const onError = jest.fn();
        const hook = await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady,
            onError,
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        await hook.unmount();
        await act(() => {
            script.dispatchEvent(new Event('load'));
            script.dispatchEvent(new Event('error'));
        });

        expect(onReady).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(document.getElementById(SCRIPT_ID)).toBe(script);
    });

    it('reports a load failure once and preserves it for a remount', async () => {
        const firstError = jest.fn();
        const first = await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: firstError,
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        await act(() => script.dispatchEvent(new Event('error')));
        expect(firstError).toHaveBeenCalledTimes(1);
        await first.unmount();

        const remountError = jest.fn();
        await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: remountError,
        }));

        expect(remountError).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
    });

    it('does not touch the DOM while disabled', async () => {
        await renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: jest.fn(),
            enabled: false,
        }));

        expect(document.getElementById(SCRIPT_ID)).toBeNull();
    });

    it('replaces the existing node when src changes after the first insert', async () => {
        const { rerender } = await renderHook(
            ({ src }: { src: string }) => useExternalScript({
                id: SCRIPT_ID,
                src,
                onReady: jest.fn(),
                onError: jest.fn(),
            }),
            { initialProps: { src: SCRIPT_SRC } },
        );
        const first = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        expect(first.src).toBe(SCRIPT_SRC);

        const nextSrc = 'https://sdk.example.com/client-en.js';
        await rerender({ src: nextSrc });

        const second = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
        expect(second).not.toBe(first);
        expect(second.src).toBe(nextSrc);
    });

    it('keeps the same node when src is unchanged', async () => {
        const { rerender } = await renderHook(
            ({ src }: { src: string }) => useExternalScript({
                id: SCRIPT_ID,
                src,
                onReady: jest.fn(),
                onError: jest.fn(),
            }),
            { initialProps: { src: SCRIPT_SRC } },
        );
        const first = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        await rerender({ src: SCRIPT_SRC });
        expect(document.getElementById(SCRIPT_ID)).toBe(first);
    });

    it('notifies onReady after the replacement script loads', async () => {
        const onReady = jest.fn();
        const { rerender } = await renderHook(
            ({ src }: { src: string }) => useExternalScript({
                id: SCRIPT_ID,
                src,
                onReady,
                onError: jest.fn(),
            }),
            { initialProps: { src: SCRIPT_SRC } },
        );
        const first = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        await act(() => first.dispatchEvent(new Event('load')));
        expect(onReady).toHaveBeenCalledTimes(1);

        await rerender({ src: 'https://sdk.example.com/client-en.js' });
        const second = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        await act(() => second.dispatchEvent(new Event('load')));
        expect(onReady).toHaveBeenCalledTimes(2);
    });
});
