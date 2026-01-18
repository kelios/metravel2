/**
 * useInsightsControl - Управление раскрывающимися секциями insights
 * Извлечено из TravelDetailsDeferred для чистоты
 */

import { useCallback, useEffect, useState } from 'react';
import { useResponsive } from '@/hooks/useResponsive';

export type InsightKey =
  | 'recommendation'
  | 'plus'
  | 'minus'
  | 'budget'
  | 'bestTime'
  | 'description'
  | 'points'
  | 'map'
  | 'gallery'
  | 'nearTravels'
  | 'popularTravels';

export interface InsightControl {
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

export interface UseInsightsControlOptions {
  defaultInsightKey?: InsightKey | null;
  forceOpenKey?: InsightKey | null;
}

export interface UseInsightsControlReturn {
  shouldUseMobileInsights: boolean;
  mobileInsightKey: InsightKey | null;
  buildInsightControl: (key: InsightKey) => InsightControl;
}

/**
 * Хук для управления раскрывающимися секциями на мобильных устройствах
 * На desktop все секции открыты, на mobile - по одной за раз
 */
export function useInsightsControl(
  options: UseInsightsControlOptions = {}
): UseInsightsControlReturn {
  const { defaultInsightKey = null, forceOpenKey = null } = options;
  const { isMobile } = useResponsive();
  const shouldUseMobileInsights = isMobile;

  const [mobileInsightKey, setMobileInsightKey] = useState<InsightKey | null>(
    defaultInsightKey
  );

  // Принудительно открыть секцию
  useEffect(() => {
    if (!shouldUseMobileInsights) return;

    if (forceOpenKey) {
      setMobileInsightKey(forceOpenKey);
    }

    if (!mobileInsightKey && defaultInsightKey) {
      setMobileInsightKey(defaultInsightKey);
    }
  }, [defaultInsightKey, forceOpenKey, mobileInsightKey, shouldUseMobileInsights]);

  const buildInsightControl = useCallback(
    (key: InsightKey): InsightControl =>
      shouldUseMobileInsights
        ? {
            open: mobileInsightKey === key,
            onToggle: () => setMobileInsightKey((prev) => (prev === key ? null : key)),
          }
        : {},
    [mobileInsightKey, shouldUseMobileInsights]
  );

  return {
    shouldUseMobileInsights,
    mobileInsightKey,
    buildInsightControl,
  };
}
