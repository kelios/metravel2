import { renderHook } from '@testing-library/react-native';

import { usePointListResponsiveModel } from '@/components/travel/hooks/usePointListResponsiveModel';

describe('usePointListResponsiveModel', () => {
  it('returns compact mobile sizing and single column on small widths', () => {
    const { result } = renderHook(() =>
      usePointListResponsiveModel({
        isLargeDesktop: false,
        isMobile: true,
        isTablet: false,
        width: 390,
      })
    );

    expect(result.current.numColumns).toBe(1);
    expect(result.current.responsive).toEqual({
      aspectRatio: 4 / 3,
      coordSize: 12,
      imageMinHeight: 240,
      titleSize: 14,
    });
  });

  it('returns tablet/desktop sizing and two columns on medium widths', () => {
    const { result } = renderHook(() =>
      usePointListResponsiveModel({
        isLargeDesktop: false,
        isMobile: false,
        isTablet: true,
        width: 900,
      })
    );

    expect(result.current.numColumns).toBe(2);
    expect(result.current.responsive).toEqual({
      aspectRatio: 4 / 3,
      coordSize: 13,
      imageMinHeight: 280,
      titleSize: 16,
    });
  });

  it('uses large desktop sizing when large desktop flag is enabled', () => {
    const { result } = renderHook(() =>
      usePointListResponsiveModel({
        isLargeDesktop: true,
        isMobile: false,
        isTablet: false,
        width: 1600,
      })
    );

    expect(result.current.numColumns).toBe(3);
    expect(result.current.responsive).toEqual({
      aspectRatio: 4 / 3,
      coordSize: 14,
      imageMinHeight: 400,
      titleSize: 19,
    });
  });
});
