import React from 'react'

import ContributionBanner from '@/components/common/ContributionBanner'

import HomeFinalCTA from './HomeFinalCTA'

type HomeBottomCtaSectionProps = {
  travelsCount: number
}

export default function HomeBottomCtaSection({ travelsCount }: HomeBottomCtaSectionProps) {
  return (
    <>
      <ContributionBanner variant="home" />
      <HomeFinalCTA travelsCount={travelsCount} />
    </>
  )
}

