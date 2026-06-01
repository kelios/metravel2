import React from 'react'
import { Circle, Line, Path, Polyline, Rect } from 'react-native-svg'

import { CHART_HEIGHT, CHART_PADDING } from '../RouteElevationProfile.utils'

export type ChartStaticLayersProps = {
  width: number
  yAxisGuides: Array<{ key: string; y: number; x1: number; x2: number }>
  areaPath: string
  polylinePoints: string
  chartAreaColor: string
  chartLineColor: string
  borderLightColor: string
  infoColor: string
  primaryDarkColor: string
  keyPoints: {
    start: { x: number; y: number } | null
    peak: { x: number; y: number } | null
    finish: { x: number; y: number } | null
  } | null
}

export const ChartStaticLayers = React.memo(function ChartStaticLayers({
  width,
  yAxisGuides,
  areaPath,
  polylinePoints,
  chartAreaColor,
  chartLineColor,
  borderLightColor,
  infoColor,
  primaryDarkColor,
  keyPoints,
}: ChartStaticLayersProps) {
  return (
    <>
      {yAxisGuides.map((guide) => (
        <Line
          key={guide.key}
          x1={guide.x1}
          y1={guide.y}
          x2={guide.x2}
          y2={guide.y}
          stroke={borderLightColor}
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={0.75}
        />
      ))}
      <Rect x={0} y={0} width={width} height={CHART_HEIGHT} fill="transparent" />
      {keyPoints?.peak ? (
        <Line
          x1={keyPoints.peak.x}
          y1={CHART_PADDING}
          x2={keyPoints.peak.x}
          y2={CHART_HEIGHT - CHART_PADDING}
          stroke={infoColor}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />
      ) : null}
      {areaPath ? (
        <Path d={areaPath} fill={chartAreaColor} opacity={0.7} />
      ) : null}
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={chartLineColor}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {keyPoints?.start ? (
        <Circle
          cx={keyPoints.start.x}
          cy={keyPoints.start.y}
          r={3.5}
          fill={chartLineColor}
        />
      ) : null}
      {keyPoints?.peak ? (
        <Circle
          cx={keyPoints.peak.x}
          cy={keyPoints.peak.y}
          r={4}
          fill={infoColor}
        />
      ) : null}
      {keyPoints?.finish ? (
        <Circle
          cx={keyPoints.finish.x}
          cy={keyPoints.finish.y}
          r={3.5}
          fill={primaryDarkColor}
        />
      ) : null}
    </>
  )
})
