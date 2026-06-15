// components/quests/QuestPointNavigator.native.tsx
// Compass arrow + live distance + arrival indicator toward the current quest step.
// Native-only: uses expo-location watchPosition/watchHeading. Web has a no-op twin.
//
// Performance: all sensor-driven state lives inside this widget. Distance is rounded
// before it hits state (so the text only re-renders on meaningful change), and the
// arrow rotation is pushed straight onto an Animated.Value (no React re-render per tick).

import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Linking, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { hapticNotification } from '@/utils/haptics'

export type QuestPointNavigatorProps = {
  targetLat: number
  targetLng: number
  colors: any
}

// expo-location is loaded lazily and only on native (this file is .native.tsx, so the
// import never reaches the web bundle). Promise.resolve wrapper per NATIVE_COMPAT_RULES.
let expoLocationModulePromise: Promise<typeof import('expo-location')> | null = null
async function loadExpoLocation() {
  if (!expoLocationModulePromise) {
    expoLocationModulePromise = Promise.resolve(import('expo-location'))
  }
  return expoLocationModulePromise
}

const ARRIVAL_THRESHOLD_M = 40
const EARTH_RADIUS_M = 6371000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Initial bearing from point 1 to point 2, degrees clockwise from true north [0..360).
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lng2 - lng1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Round to a "nice" step so the distance label doesn't re-render on every GPS tick.
function roundDistance(m: number): number {
  if (m < 100) return Math.round(m / 5) * 5
  if (m < 1000) return Math.round(m / 10) * 10
  return Math.round(m / 50) * 50
}

function formatDistance(m: number): string {
  if (m >= 1000) {
    const km = m / 1000
    return `${km >= 10 ? Math.round(km) : km.toFixed(1)} км`
  }
  return `${Math.round(m)} м`
}

// Shortest signed delta a→b in degrees, range (-180, 180].
function angleDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180
  if (d === -180) d = 180
  return d
}

type PermState = 'unknown' | 'prompt' | 'granted' | 'denied'

function QuestPointNavigatorImpl({ targetLat, targetLng, colors }: QuestPointNavigatorProps) {
  const [perm, setPerm] = useState<PermState>('unknown')
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [arrived, setArrived] = useState(false)

  // Animated arrow rotation, driven directly from sensor callbacks (no setState per tick).
  const rotation = useRef(new Animated.Value(0)).current
  const headingRef = useRef(0)
  const userRef = useRef<{ lat: number; lng: number } | null>(null)
  const lastRoundedRef = useRef<number | null>(null)
  const arrivedRef = useRef(false)
  const targetRef = useRef({ lat: targetLat, lng: targetLng })

  // Keep latest target in a ref so sensor callbacks always read fresh coords
  // without resubscribing on every render.
  useEffect(() => {
    targetRef.current = { lat: targetLat, lng: targetLng }
    // Reset arrival state when the step (target) changes.
    arrivedRef.current = false
    setArrived(false)
    lastRoundedRef.current = null
    setDistanceM(null)
  }, [targetLat, targetLng])

  const recompute = useCallback(() => {
    const user = userRef.current
    if (!user) return
    const { lat, lng } = targetRef.current

    const dist = haversineMeters(user.lat, user.lng, lat, lng)
    const rounded = roundDistance(dist)
    if (rounded !== lastRoundedRef.current) {
      lastRoundedRef.current = rounded
      setDistanceM(rounded)
    }

    const justArrived = dist < ARRIVAL_THRESHOLD_M
    if (justArrived !== arrivedRef.current) {
      arrivedRef.current = justArrived
      setArrived(justArrived)
      if (justArrived) hapticNotification('success')
    }

    // Arrow points along (bearingToTarget − deviceHeading): where to physically turn.
    const bearing = bearingDeg(user.lat, user.lng, lat, lng)
    const target = bearing - headingRef.current
    // Animate along the shortest path from the current animated value.
    const current = (rotation as any)._value ?? 0
    const next = current + angleDelta(((current % 360) + 360) % 360, ((target % 360) + 360) % 360)
    Animated.timing(rotation, {
      toValue: next,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [rotation])

  const startWatching = useCallback(async () => {
    let positionSub: { remove: () => void } | null = null
    let headingSub: { remove: () => void } | null = null
    let cancelled = false

    try {
      const Location = await loadExpoLocation()
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (cancelled) return () => {}
      if (status !== 'granted') {
        setPerm('denied')
        return () => {}
      }
      setPerm('granted')

      positionSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 1500,
        },
        (loc) => {
          userRef.current = { lat: loc.coords.latitude, lng: loc.coords.longitude }
          recompute()
        },
      )

      try {
        headingSub = await Location.watchHeadingAsync((h) => {
          // trueHeading is -1 when unavailable; fall back to magHeading.
          const heading = h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading
          if (heading != null && heading >= 0) {
            headingRef.current = heading
            recompute()
          }
        })
      } catch {
        // Heading sensor unavailable: arrow stays bearing-only, distance still works.
      }
    } catch {
      setPerm('denied')
    }

    return () => {
      cancelled = true
      positionSub?.remove?.()
      headingSub?.remove?.()
    }
  }, [recompute])

  const cleanupRef = useRef<null | (() => void)>(null)
  const enabledRef = useRef(false)

  const enable = useCallback(() => {
    if (enabledRef.current) return
    enabledRef.current = true
    startWatching().then((cleanup) => {
      // If unmounted before subscriptions resolved, clean up immediately.
      if (!enabledRef.current) {
        cleanup?.()
        return
      }
      cleanupRef.current = cleanup
    })
  }, [startWatching])

  // Probe current permission on mount; auto-start only if already granted so we don't
  // pop a permission dialog unprompted. Otherwise show a gentle "Показать направление".
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const Location = await loadExpoLocation()
        const { status } = await Location.getForegroundPermissionsAsync()
        if (!active) return
        if (status === 'granted') {
          setPerm('granted')
          enable()
        } else {
          setPerm('prompt')
        }
      } catch {
        if (active) setPerm('prompt')
      }
    })()
    return () => {
      active = false
      enabledRef.current = false
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [enable])

  const arrow = colors?.brandText ?? '#1d6f5c'
  const muted = colors?.textMuted ?? '#888'
  const success = colors?.success ?? '#2e9e5b'

  if (perm === 'denied') {
    // Permission refused: don't nag with the system dialog again (it won't show),
    // but keep a soft path to re-enable via OS settings instead of vanishing.
    return (
      <Pressable
        onPress={() => {
          Linking.openSettings().catch(() => {})
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Включить доступ к геолокации в настройках"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          marginTop: 4,
          minHeight: 44,
        }}
      >
        <Feather name="settings" size={13} color={muted} />
        <Text style={{ color: muted, fontSize: 12 }}>Включить геолокацию в настройках</Text>
      </Pressable>
    )
  }

  if (perm === 'prompt' || perm === 'unknown') {
    // Pre-permission priming: explain the benefit BEFORE the OS dialog so the user
    // grants location knowingly (and a denial here is far less likely than tapping
    // a bare "allow location" system prompt with no context).
    return (
      <Pressable
        onPress={enable}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Показать стрелку и расстояние до точки квеста"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          marginTop: 4,
          minHeight: 44,
        }}
      >
        <Feather name="compass" size={13} color={muted} />
        <Text style={{ color: muted, fontSize: 12 }}>
          Показать стрелку и расстояние до точки
        </Text>
      </Pressable>
    )
  }

  const rotate = rotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  })

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={
        arrived
          ? 'Вы на месте'
          : distanceM != null
            ? `До точки ${formatDistance(distanceM)}`
            : 'Определение направления'
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        marginTop: 4,
      }}
    >
      {arrived ? (
        <>
          <Feather name="check-circle" size={15} color={success} />
          <Text style={{ color: success, fontSize: 13, fontWeight: '600' }}>Вы на месте</Text>
        </>
      ) : (
        <>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Feather name="navigation" size={15} color={arrow} />
          </Animated.View>
          <Text style={{ color: arrow, fontSize: 13, fontWeight: '600' }}>
            {distanceM != null ? formatDistance(distanceM) : '…'}
          </Text>
        </>
      )}
    </View>
  )
}

const QuestPointNavigator = memo(QuestPointNavigatorImpl)
export default QuestPointNavigator
