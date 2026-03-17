import { useMemo, useState } from 'react';
import { Platform } from 'react-native';

type PointPreviewItem = {
  id: string;
  address: string;
  coord: string;
};

type ViewMode = 'cards' | 'list';

export function usePointListDisplayModel({
  isMobile,
  points,
}: {
  isMobile: boolean;
  points: PointPreviewItem[];
}) {
  const [showList, setShowList] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const pointsCount = points.length;
  const countLabel = pointsCount > 0 ? ` (${pointsCount})` : '';
  const toggleLabel = showList
    ? `Скрыть координаты мест${countLabel}`
    : `Показать координаты мест${countLabel}`;

  const previewPoints = useMemo(() => points.slice(0, 3), [points]);
  const hiddenPreviewCount = Math.max(points.length - previewPoints.length, 0);
  const shouldShowPreview = !showList && points.length > 0;
  const shouldShowViewModeBar = showList && Platform.OS === 'web';
  const shouldRenderWebListMode = shouldShowViewModeBar && viewMode === 'list';
  const shouldRenderWebCardsMode = shouldShowViewModeBar && viewMode === 'cards';
  const shouldRenderNativeList = showList && Platform.OS !== 'web';
  const shouldShowToggleTextCompact = isMobile;

  return {
    hiddenPreviewCount,
    previewPoints,
    setShowList,
    setViewMode,
    shouldRenderNativeList,
    shouldRenderWebCardsMode,
    shouldRenderWebListMode,
    shouldShowPreview,
    shouldShowToggleTextCompact,
    shouldShowViewModeBar,
    showList,
    toggleLabel,
    viewMode,
  };
}
