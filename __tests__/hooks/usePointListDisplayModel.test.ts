import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { usePointListDisplayModel } from '@/components/travel/hooks/usePointListDisplayModel';

describe('usePointListDisplayModel', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    (Platform as any).OS = originalPlatformOS;
  });

  afterAll(() => {
    (Platform as any).OS = originalPlatformOS;
  });

  it('derives preview and toggle state for collapsed web list', () => {
    (Platform as any).OS = 'web';

    const { result } = renderHook(() =>
      usePointListDisplayModel({
        isMobile: false,
        points: [
          { id: '1', address: 'A', coord: '1,1' },
          { id: '2', address: 'B', coord: '2,2' },
          { id: '3', address: 'C', coord: '3,3' },
          { id: '4', address: 'D', coord: '4,4' },
        ],
      })
    );

    expect(result.current.showList).toBe(false);
    expect(result.current.toggleLabel).toBe('Показать координаты мест (4)');
    expect(result.current.previewPoints).toEqual([
      { id: '1', address: 'A', coord: '1,1' },
      { id: '2', address: 'B', coord: '2,2' },
      { id: '3', address: 'C', coord: '3,3' },
    ]);
    expect(result.current.hiddenPreviewCount).toBe(1);
    expect(result.current.shouldShowPreview).toBe(true);
    expect(result.current.shouldShowViewModeBar).toBe(false);
    expect(result.current.shouldShowToggleTextCompact).toBe(false);
  });

  it('switches to web list mode when opened and view mode changes', () => {
    (Platform as any).OS = 'web';

    const { result } = renderHook(() =>
      usePointListDisplayModel({
        isMobile: false,
        points: [{ id: '1', address: 'A', coord: '1,1' }],
      })
    );

    act(() => {
      result.current.setShowList(true);
    });

    expect(result.current.toggleLabel).toBe('Скрыть координаты мест (1)');
    expect(result.current.shouldShowPreview).toBe(false);
    expect(result.current.shouldShowViewModeBar).toBe(true);
    expect(result.current.shouldRenderWebCardsMode).toBe(true);

    act(() => {
      result.current.setViewMode('list');
    });

    expect(result.current.viewMode).toBe('list');
    expect(result.current.shouldRenderWebListMode).toBe(true);
    expect(result.current.shouldRenderWebCardsMode).toBe(false);
  });

  it('enables compact toggle text and native list rendering on mobile native', () => {
    (Platform as any).OS = 'ios';

    const { result } = renderHook(() =>
      usePointListDisplayModel({
        isMobile: true,
        points: [{ id: '1', address: 'A', coord: '1,1' }],
      })
    );

    act(() => {
      result.current.setShowList(true);
    });

    expect(result.current.shouldShowToggleTextCompact).toBe(true);
    expect(result.current.shouldRenderNativeList).toBe(true);
    expect(result.current.shouldShowViewModeBar).toBe(false);
    expect(result.current.shouldRenderWebListMode).toBe(false);
    expect(result.current.shouldRenderWebCardsMode).toBe(false);
  });
});
