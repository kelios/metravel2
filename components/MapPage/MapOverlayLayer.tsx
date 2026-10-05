import React from 'react'
import { StyleSheet, View } from 'react-native'

/**
 * #2219 (device QA, Android) — the one place for controls that sit OVER the
 * map inside the map area (`MapCanvas`): «Искать в этой области», «Моё
 * местоположение», the location-quality pill, the geo banner.
 *
 * Why a layer and not «a zIndex on the button». Android hands one touch to two
 * receivers when they disagree: React picks the JS target by `zIndex`
 * (`TouchTargetHelper`), while the native `MotionEvent` goes to the sibling the
 * framework dispatches to first — `ViewGroup.buildTouchDispatchChildList()`
 * orders siblings by elevation (Z) and only then by index. A button with
 * `zIndex: 1001` and the shadow elevation 2 next to a map surface with
 * elevation 8 pressed in JS AND let the WebView place a route point under it.
 *
 * The invariant this layer owns: it is the LAST child of the map area, has no
 * elevation of its own and the map surface carries none either
 * (`MapPanel` native `mapContainer`), so for every point the layer's children
 * are dispatched first — by construction, whatever shadow a control draws.
 * `box-none`: the layer itself never takes a touch, the map keeps the rest.
 * Kept unflattened (`collapsable={false}`) so the native order is the JSX one.
 * Control: `__tests__/components/MapPage/mapOverlayLayer.native.test.tsx`.
 */
export function MapOverlayLayer({ children }: { children: React.ReactNode }) {
  return (
    <View testID="map-overlay-layer" pointerEvents="box-none" collapsable={false} style={StyleSheet.absoluteFill}>
      {children}
    </View>
  )
}
