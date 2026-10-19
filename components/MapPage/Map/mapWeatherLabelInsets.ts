import { getMapToolbarBottom } from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles';
import { useBottomSheetStore } from '@/stores/bottomSheetStore';
import { resolveWeatherLabelInsets, type WeatherLabelInsets } from '@/utils/mapWeatherLabels';

/**
 * #2661 — зоны поверх карты, куда подпись погоды не ставится: верхний ряд
 * кнопок (`getMapToolbarBottom`) и низ карты: отступ контролов от шторки
 * (`getControlsBottomOffset`, свёрнутая — 120) плюс полоса «Искать в этой
 * области» / легенда температуры.
 * Один расчёт для web (`useMapInstance`) и native (`useNativeWeatherLabels`).
 */
export const readMapWeatherLabelInsets = (topSafeInset: number): WeatherLabelInsets =>
  resolveWeatherLabelInsets({
    toolbarBottomPx: getMapToolbarBottom(topSafeInset),
    bottomOverlayPx: useBottomSheetStore.getState().getControlsBottomOffset(),
  });
