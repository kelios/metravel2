import { useEffect, useState } from 'react';

type DriveInfo =
  | null
  | { status: 'loading' }
  | { status: 'ok'; distanceKm: number; durationMin: number }
  | { status: 'error' };

type PointLike = Record<string, unknown>;

type LocationLike = { lat?: number | null; lng?: number | null } | null;

type Params = {
  activePointId: number | null;
  currentLocation: LocationLike;
  visibleFilteredPoints: PointLike[];
};

export const usePointsDriveInfo = ({
  activePointId,
  currentLocation,
  visibleFilteredPoints,
}: Params): DriveInfo => {
  const [activeDriveInfo, setActiveDriveInfo] = useState<DriveInfo>(null);

  useEffect(() => {
    const id = Number(activePointId);
    const userLat = Number(currentLocation?.lat);
    const userLng = Number(currentLocation?.lng);
    if (!Number.isFinite(id)) {
      setActiveDriveInfo(null);
      return;
    }
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      setActiveDriveInfo(null);
      return;
    }

    const target = visibleFilteredPoints.find((p) => Number(p?.id) === id);
    const toLat = Number(target?.latitude);
    const toLng = Number(target?.longitude);
    if (!Number.isFinite(toLat) || !Number.isFinite(toLng)) {
      setActiveDriveInfo(null);
      return;
    }

    const controller = new AbortController();
    setActiveDriveInfo({ status: 'loading' });

    const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${toLng},${toLat}?overview=false`;

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        const route = Array.isArray(data?.routes) ? data.routes[0] : null;
        const distanceM = Number(route?.distance);
        const durationS = Number(route?.duration);
        if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) {
          setActiveDriveInfo({ status: 'error' });
          return;
        }
        const distanceKm = Math.round((distanceM / 1000) * 10) / 10;
        const durationMin = Math.max(1, Math.round(durationS / 60));
        setActiveDriveInfo({ status: 'ok', distanceKm, durationMin });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setActiveDriveInfo({ status: 'error' });
      });

    return () => {
      controller.abort();
    };
  }, [activePointId, currentLocation?.lat, currentLocation?.lng, visibleFilteredPoints]);

  return activeDriveInfo;
};
