import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useWebKeyboardInset } from '@/hooks/useWebKeyboardInset';

// Мини-имитация visualViewport: клавиатура на mobile web не сжимает layout
// viewport, поэтому реальное перекрытие = innerHeight - vv.height - vv.offsetTop.
class FakeVisualViewport extends EventTarget {
    height = 800;
    offsetTop = 0;

    resizeTo(height: number, offsetTop = 0) {
        this.height = height;
        this.offsetTop = offsetTop;
        this.dispatchEvent(new Event('resize'));
    }
}

describe('useWebKeyboardInset', () => {
    const originalOS = Platform.OS;
    let vv: FakeVisualViewport;

    beforeEach(() => {
        Platform.OS = 'web';
        vv = new FakeVisualViewport();
        Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(((cb: any) => {
            cb(0);
            return 1;
        }) as any);
    });

    afterEach(() => {
        Platform.OS = originalOS;
        jest.restoreAllMocks();
    });

    it('reports no inset while the keyboard is closed', () => {
        const { result } = renderHook(() => useWebKeyboardInset());
        expect(result.current).toBe(0);
    });

    it('reports the keyboard overlap when the visual viewport shrinks', () => {
        const { result } = renderHook(() => useWebKeyboardInset());

        act(() => {
            vv.resizeTo(480);
        });

        expect(result.current).toBe(320);
    });

    it('accounts for a panned visual viewport', () => {
        const { result } = renderHook(() => useWebKeyboardInset());

        act(() => {
            vv.resizeTo(480, 40);
        });

        expect(result.current).toBe(280);
    });

    // Сворачивание адресной строки браузера тоже уменьшает visual viewport —
    // на такое реагировать нельзя, иначе композер прыгает при скролле.
    it('ignores a small shrink such as the browser URL bar', () => {
        const { result } = renderHook(() => useWebKeyboardInset());

        act(() => {
            vv.resizeTo(744);
        });

        expect(result.current).toBe(0);
    });

    it('drops back to zero when the keyboard closes', () => {
        const { result } = renderHook(() => useWebKeyboardInset());

        act(() => {
            vv.resizeTo(480);
        });
        act(() => {
            vv.resizeTo(800);
        });

        expect(result.current).toBe(0);
    });

    it('stays inert on native', () => {
        Platform.OS = 'android';
        const { result } = renderHook(() => useWebKeyboardInset());

        act(() => {
            vv.resizeTo(480);
        });

        expect(result.current).toBe(0);
    });
});
