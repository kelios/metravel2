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

    it('creates one async deferred script with the requested attributes', () => {
        renderHook(() => useExternalScript({
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

    it('reuses the same node for concurrent consumers and notifies both', () => {
        const firstReady = jest.fn();
        const secondReady = jest.fn();
        const first = renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: firstReady,
            onError: jest.fn(),
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        const second = renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: secondReady,
            onError: jest.fn(),
        }));

        expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
        expect(document.getElementById(SCRIPT_ID)).toBe(script);

        act(() => script.dispatchEvent(new Event('load')));

        expect(firstReady).toHaveBeenCalledTimes(1);
        expect(secondReady).toHaveBeenCalledTimes(1);
        first.unmount();
        second.unmount();
    });

    it('keeps the loaded node across unmount/remount and reports readiness', () => {
        const firstReady = jest.fn();
        const first = renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: firstReady,
            onError: jest.fn(),
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        act(() => script.dispatchEvent(new Event('load')));
        first.unmount();

        const remountReady = jest.fn();
        renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: remountReady,
            onError: jest.fn(),
        }));

        expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
        expect(document.getElementById(SCRIPT_ID)).toBe(script);
        expect(remountReady).toHaveBeenCalledTimes(1);
    });

    it('records completion after every consumer unmounts so a remount still becomes ready', () => {
        const first = renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: jest.fn(),
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        first.unmount();
        act(() => script.dispatchEvent(new Event('load')));

        const remountReady = jest.fn();
        renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: remountReady,
            onError: jest.fn(),
        }));

        expect(remountReady).toHaveBeenCalledTimes(1);
    });

    it('removes listeners on unmount without removing the reusable node', () => {
        const onReady = jest.fn();
        const onError = jest.fn();
        const hook = renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady,
            onError,
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        hook.unmount();
        act(() => {
            script.dispatchEvent(new Event('load'));
            script.dispatchEvent(new Event('error'));
        });

        expect(onReady).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(document.getElementById(SCRIPT_ID)).toBe(script);
    });

    it('reports a load failure once and preserves it for a remount', () => {
        const firstError = jest.fn();
        const first = renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: firstError,
        }));
        const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

        act(() => script.dispatchEvent(new Event('error')));
        expect(firstError).toHaveBeenCalledTimes(1);
        first.unmount();

        const remountError = jest.fn();
        renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: remountError,
        }));

        expect(remountError).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
    });

    it('does not touch the DOM while disabled', () => {
        renderHook(() => useExternalScript({
            id: SCRIPT_ID,
            src: SCRIPT_SRC,
            onReady: jest.fn(),
            onError: jest.fn(),
            enabled: false,
        }));

        expect(document.getElementById(SCRIPT_ID)).toBeNull();
    });
});
