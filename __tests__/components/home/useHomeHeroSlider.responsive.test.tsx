import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useHomeHeroSlider } from '@/components/home/useHomeHeroSlider';

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true, default: { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
}));
jest.mock('@/components/ui/ImageCardMedia', () => ({ isIOSSafariUserAgent: () => false }));

const slides = [{ title: 'First' }, { title: 'Second' }];
const getSlideSource = () => null;

it('keeps the first mobile feature static and restores it after a desktop autoplay session', async () => {
  jest.useFakeTimers();
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const intervals = jest.spyOn(global, 'setInterval');
  const { result, rerender, unmount } = await renderHook(({ enabled }) => useHomeHeroSlider({
    slides, showSideSlider: enabled, resetWhenInactive: true,
    sliderMediaWidth: 480, sliderHeight: 320, prefersReducedMotion: false, getSlideSource,
  }), { initialProps: { enabled: false } });
  try {
    await act(() => jest.advanceTimersByTime(16000));
    expect(result.current.currentSlide).toBe(slides[0]);
    expect(intervals).not.toHaveBeenCalled();
    expect(loop).not.toHaveBeenCalled();
    await rerender({ enabled: true });
    await act(() => jest.advanceTimersByTime(8000));
    expect(result.current.currentSlide).toBe(slides[1]);
    expect(loop).toHaveBeenCalledTimes(1);
    await rerender({ enabled: false });
    expect(result.current.currentSlide).toBe(slides[0]);
    expect(result.current.renderedSlideIndices).toEqual([0]);
    await act(() => jest.advanceTimersByTime(16000));
    expect(result.current.currentSlide).toBe(slides[0]);
  } finally {
    await unmount();
    intervals.mockRestore(); loop.mockRestore(); jest.useRealTimers();
  }
});
