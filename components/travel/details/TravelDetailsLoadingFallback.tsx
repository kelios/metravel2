import React from 'react'
import { View, useWindowDimensions } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { METRICS } from '@/constants/layout'

const ROOT_TEST_ID = 'travel-details-loading'

export default function TravelDetailsLoadingFallback() {
  const { width, height } = useWindowDimensions()
  const isMobile = width < METRICS.breakpoints.tablet
  const isDesktop = width >= METRICS.breakpoints.desktop
  const heroHeight = isMobile
    ? Math.max(260, Math.min(Math.round(height * 0.56), 420))
    : Math.max(360, Math.min(Math.round(height * 0.7), 750))

  return (
    <View
      testID={ROOT_TEST_ID}
      {...(typeof document !== 'undefined' ? ({ 'data-testid': ROOT_TEST_ID } as any) : null)}
      accessibilityRole="progressbar"
      accessibilityLabel="Загрузка путешествия"
      style={{ flex: 1 }}
    >
      <SkeletonLoader width="100%" height={heroHeight} borderRadius={isDesktop ? DESIGN_TOKENS.radii.xl : 0} />

      <View
        style={{
          width: '100%',
          maxWidth: 1600,
          alignSelf: 'center',
          paddingHorizontal: isMobile ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
          paddingTop: DESIGN_TOKENS.spacing.lg,
          paddingBottom: DESIGN_TOKENS.spacing.xl,
          gap: DESIGN_TOKENS.spacing.lg,
        }}
      >
        <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
          <SkeletonLoader width={isMobile ? '82%' : '56%'} height={isMobile ? 30 : 40} borderRadius={10} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm }}>
            <SkeletonLoader width={96} height={20} borderRadius={12} />
            <SkeletonLoader width={88} height={20} borderRadius={12} />
            <SkeletonLoader width={140} height={20} borderRadius={12} />
          </View>
        </View>

        <View style={{ gap: DESIGN_TOKENS.spacing.sm }}>
          <SkeletonLoader width="100%" height={18} borderRadius={6} />
          <SkeletonLoader width="96%" height={18} borderRadius={6} />
          <SkeletonLoader width="92%" height={18} borderRadius={6} />
          <SkeletonLoader width="80%" height={18} borderRadius={6} />
        </View>

        <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
          <SkeletonLoader width={180} height={24} borderRadius={8} />
          <SkeletonLoader width="100%" height={320} borderRadius={DESIGN_TOKENS.radii.lg} />
        </View>
      </View>
    </View>
  )
}

