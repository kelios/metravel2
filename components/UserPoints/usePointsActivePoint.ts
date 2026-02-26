import { useCallback, useEffect, useRef, useState } from 'react';

type PointLike = Record<string, unknown>;

export const usePointsActivePoint = () => {
  const [activePointId, setActivePointId] = useState<number | null>(null);
  const showPointTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (!showPointTimeoutRef.current) return;
      clearTimeout(showPointTimeoutRef.current);
      showPointTimeoutRef.current = null;
    };
  }, []);

  const handleShowPointOnMap = useCallback((point: unknown) => {
    const item = (point ?? {}) as PointLike;
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const id = Number(item.id);
    if (!Number.isFinite(id)) return;

    // Re-trigger map focus even for repeated clicks on the same point.
    setActivePointId(null);
    if (showPointTimeoutRef.current) {
      clearTimeout(showPointTimeoutRef.current);
    }
    showPointTimeoutRef.current = setTimeout(() => {
      setActivePointId(id);
    }, 0);
  }, []);

  return {
    activePointId,
    setActivePointId,
    handleShowPointOnMap,
  };
};
