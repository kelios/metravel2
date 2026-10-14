import { act, renderHook } from '@testing-library/react-native';
import { useWindowDimensions, type View } from 'react-native';
import { useNativeBottomOverlayInset } from '@/components/layout/useNativeBottomOverlayInset';

let mockDock = 89;
let mockTop: number | null = 650;
let mockSafeBottom = 34;

jest.mock('@/components/layout/bottomChromeInset', () => ({
  useDockReservePx: () => mockDock,
  useNativeBottomChromeOcclusion: () => ({ top: mockTop }),
}));
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ bottom: mockSafeBottom }),
}));

type Measurement = Parameters<View['measureInWindow']>[0];

describe('native bottom overlay placement', () => {
  beforeEach(() => { mockDock = 89; mockTop = 650; mockSafeBottom = 34; });

  it('reserves the sticky footer in host coordinates, then follows chrome removal', () => {
    const { result, rerender } = renderHook(() => useNativeBottomOverlayInset());
    expect(result.current.reserve).toBe(89);
    result.current.layerRef.current = { measureInWindow: (done: Measurement) => done(0, 100, 390, 700) } as View;
    act(() => result.current.measureLayer());
    expect(result.current.reserve).toBe(150); // host bottom 800 - footer top 650
    mockTop = null;
    rerender({});
    expect(result.current.reserve).toBe(89);
    mockDock = 0;
    rerender({});
    expect(result.current.reserve).toBe(34);
  });

  it('ignores dock and parent sticky chrome inside a fullscreen modal', () => {
    const { result } = renderHook(() => useNativeBottomOverlayInset(false));
    result.current.layerRef.current = { measureInWindow: (done: Measurement) => done(0, 0, 390, 800) } as View;
    act(() => result.current.measureLayer());
    expect(result.current.reserve).toBe(34);
  });

  it('rejects stale and invalid native callbacks after a fresh layout', () => {
    const callbacks: Measurement[] = [];
    const { result } = renderHook(() => useNativeBottomOverlayInset());
    result.current.layerRef.current = { measureInWindow: (done: Measurement) => callbacks.push(done) } as View;
    act(() => { result.current.measureLayer(); result.current.measureLayer(); });
    act(() => callbacks[1](0, 0, 390, 900));
    expect(result.current.reserve).toBe(250);
    act(() => callbacks[0](0, 0, 390, 1200));
    expect(result.current.reserve).toBe(250);
    act(() => result.current.measureLayer());
    act(() => callbacks[2](0, Number.NaN, 390, 900));
    expect(result.current.reserve).toBe(250);
  });

  it('remeasures host bounds when orientation or a resizable window changes', () => {
    const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions') as jest.SpyInstance<ReturnType<typeof useWindowDimensions>>;
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    let height = 800;
    try {
      const { result, rerender } = renderHook(() => useNativeBottomOverlayInset());
      result.current.layerRef.current = { measureInWindow: (done: Measurement) => done(0, 0, 390, height) } as View;
      act(() => result.current.measureLayer());
      expect(result.current.reserve).toBe(150);
      height = 700;
      dimensions.mockReturnValue({ width: 800, height: 700, scale: 1, fontScale: 1 });
      rerender({});
      expect(result.current.reserve).toBe(89);
    } finally { dimensions.mockRestore(); }
  });
});
