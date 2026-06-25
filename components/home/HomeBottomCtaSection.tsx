
import HomeFinalCTA from './HomeFinalCTA'

type HomeBottomCtaSectionProps = {
  travelsCount: number
}

export default function HomeBottomCtaSection({ travelsCount }: HomeBottomCtaSectionProps) {
  return <HomeFinalCTA travelsCount={travelsCount} />
}

