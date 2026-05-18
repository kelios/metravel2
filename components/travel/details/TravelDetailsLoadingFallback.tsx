import React from 'react'
import { View, useWindowDimensions } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { METRICS } from '@/constants/layout'

const ROOT_TEST_ID = 'travel-details-loading'

export default function TravelDetailsLoadingFallback() {
  const { width, height } = useWindowDimensions()
  const isMobile = width < METRICS.breakpoints.tablet
  const isTablet = width >= METRICS.breakpoints.tablet && width < METRICS.breakpoints.desktop
  const isDesktop = width >= METRICS.breakpoints.desktop
  const desktopSidebarWidth = Math.max(320, Math.min(Math.round(width * 0.24), 360))
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
      {isDesktop ? (
        <View
          style={{
            width: '100%',
            maxWidth: 1600,
            alignSelf: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.lg,
            paddingTop: DESIGN_TOKENS.spacing.md,
            paddingBottom: DESIGN_TOKENS.spacing.xl,
            flexDirection: 'row',
            gap: DESIGN_TOKENS.spacing.md,
            alignItems: 'flex-start',
          }}
        >
          <View style={{ width: desktopSidebarWidth, flexShrink: 0, gap: DESIGN_TOKENS.spacing.md }}>
            <View
              style={{
                borderRadius: DESIGN_TOKENS.radii.xl,
                backgroundColor: 'transparent',
                padding: DESIGN_TOKENS.spacing.lg,
                gap: DESIGN_TOKENS.spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.md }}>
                <SkeletonLoader width={48} height={48} borderRadius={24} />
                <View style={{ flex: 1, gap: DESIGN_TOKENS.spacing.sm }}>
                  <SkeletonLoader width="50%" height={20} borderRadius={8} />
                  <SkeletonLoader width="70%" height={14} borderRadius={6} />
                </View>
                <SkeletonLoader width={34} height={34} borderRadius={10} />
                <SkeletonLoader width={34} height={34} borderRadius={10} />
              </View>
              <SkeletonLoader width="82%" height={42} borderRadius={21} />
            </View>

            <View style={{ gap: DESIGN_TOKENS.spacing.sm }}>
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonLoader
                  key={`travel-sidebar-line-${index}`}
                  width="100%"
                  height={index === 0 ? 38 : 18}
                  borderRadius={index === 0 ? 16 : 8}
                />
              ))}
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: DESIGN_TOKENS.spacing.lg }}>
            <SkeletonLoader width="100%" height={heroHeight} borderRadius={DESIGN_TOKENS.radii.xl} />

            <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm }}>
                <SkeletonLoader width={110} height={20} borderRadius={12} />
                <SkeletonLoader width={110} height={20} borderRadius={12} />
                <SkeletonLoader width={240} height={20} borderRadius={12} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm }}>
                <SkeletonLoader width={120} height={18} borderRadius={12} />
                <SkeletonLoader width={96} height={18} borderRadius={12} />
                <SkeletonLoader width={150} height={18} borderRadius={12} />
                <SkeletonLoader width={116} height={18} borderRadius={12} />
              </View>
            </View>

            <View style={{ gap: DESIGN_TOKENS.spacing.sm }}>
              <SkeletonLoader width="42%" height={22} borderRadius={8} />
              <SkeletonLoader width="100%" height={18} borderRadius={6} />
              <SkeletonLoader width="96%" height={18} borderRadius={6} />
              <SkeletonLoader width="92%" height={18} borderRadius={6} />
              <SkeletonLoader width="84%" height={18} borderRadius={6} />
            </View>

            <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
              <SkeletonLoader width={200} height={24} borderRadius={8} />
              <SkeletonLoader width="100%" height={220} borderRadius={DESIGN_TOKENS.radii.lg} />
            </View>
            <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
              <SkeletonLoader width={200} height={24} borderRadius={8} />
              <SkeletonLoader width="100%" height={220} borderRadius={DESIGN_TOKENS.radii.lg} />
            </View>
          </View>
        </View>
      ) : (
        <>
          <SkeletonLoader width="100%" height={heroHeight} borderRadius={0} />

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
              <SkeletonLoader width={isMobile ? '82%' : '68%'} height={isMobile ? 30 : 36} borderRadius={10} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm }}>
                <SkeletonLoader width={100} height={20} borderRadius={12} />
                <SkeletonLoader width={88} height={20} borderRadius={12} />
                <SkeletonLoader width={140} height={20} borderRadius={12} />
              </View>
              {!isMobile && isTablet ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm }}>
                  <SkeletonLoader width={110} height={18} borderRadius={12} />
                  <SkeletonLoader width={96} height={18} borderRadius={12} />
                  <SkeletonLoader width={150} height={18} borderRadius={12} />
                </View>
              ) : null}
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

            <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
              <SkeletonLoader width={180} height={22} borderRadius={8} />
              <SkeletonLoader width="100%" height={220} borderRadius={DESIGN_TOKENS.radii.lg} />
            </View>
            <View style={{ gap: DESIGN_TOKENS.spacing.md }}>
              <SkeletonLoader width={180} height={22} borderRadius={8} />
              <SkeletonLoader width="100%" height={220} borderRadius={DESIGN_TOKENS.radii.lg} />
            </View>
          </View>
        </>
      )}
    </View>
  )
}
