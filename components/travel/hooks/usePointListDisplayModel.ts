import { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { translate as i18nT } from '@/i18n'


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
  const [showList, setShowList] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const pointsCount = points.length;
  const countLabel = pointsCount > 0 ? ` (${pointsCount})` : '';
  const toggleLabel = showList
    ? i18nT('travel:components.travel.hooks.usePointListDisplayModel.skryt_kartochki_tochek_value1_ee6511c3', { value1: countLabel })
    : i18nT('travel:components.travel.hooks.usePointListDisplayModel.pokazat_kartochki_tochek_value1_5784d364', { value1: countLabel });

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
