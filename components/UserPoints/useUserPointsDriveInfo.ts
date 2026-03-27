import React from 'react'

type DriveInfoState =
  | { status: 'loading' }
  | { status: 'ok'; distanceKm: number; durationMin: number }
  | { status: 'error' }

export function useUserPointsDriveInfo(centerOverride?: { lat: number; lng: number }) {
  const [driveInfoById, setDriveInfoById] = React.useState<Record<number, DriveInfoState>>({})
  const driveAbortByIdRef = React.useRef<Map<number, AbortController>>(new Map())

  React.useEffect(() => {
    const controllersById = driveAbortByIdRef.current
    return () => {
      try {
        for (const c of controllersById.values()) c.abort()
      } catch {
        // noop
      }
      controllersById.clear()
    }
  }, [])

  const requestDriveInfo = React.useCallback(
    ({ pointId, pointLat, pointLng }: { pointId: number; pointLat: number; pointLng: number }) => {
      try {
        const userLat = Number(centerOverride?.lat)
        const userLng = Number(centerOverride?.lng)
        if (!Number.isFinite(pointId)) return
        if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return
        if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) return

        setDriveInfoById((prev) => ({ ...prev, [pointId]: { status: 'loading' } }))

        const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${pointLng},${pointLat}?overview=false`

        try {
          driveAbortByIdRef.current.get(pointId)?.abort()
        } catch {
          // noop
        }
        const controller = new AbortController()
        driveAbortByIdRef.current.set(pointId, controller)

        fetch(url, { signal: controller.signal })
          .then((r) => r.json())
          .then((data) => {
            const route = Array.isArray(data?.routes) ? data.routes[0] : null
            const distanceM = Number(route?.distance)
            const durationS = Number(route?.duration)
            if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) {
              setDriveInfoById((prev) => ({ ...prev, [pointId]: { status: 'error' } }))
              return
            }

            const distanceKm = Math.round((distanceM / 1000) * 10) / 10
            const durationMin = Math.max(1, Math.round(durationS / 60))
            setDriveInfoById((prev) => ({
              ...prev,
              [pointId]: { status: 'ok', distanceKm, durationMin },
            }))
          })
          .catch((e) => {
            if ((e as any)?.name === 'AbortError') return
            setDriveInfoById((prev) => ({ ...prev, [pointId]: { status: 'error' } }))
          })
          .finally(() => {
            try {
              if (driveAbortByIdRef.current.get(pointId) === controller) {
                driveAbortByIdRef.current.delete(pointId)
              }
            } catch {
              // noop
            }
          })
      } catch {
        // noop
      }
    },
    [centerOverride?.lat, centerOverride?.lng]
  )

  return {
    driveInfoById,
    requestDriveInfo,
  }
}
