import { useMemo } from 'react'
import { useTravelDetailsData } from '@/hooks/useTravelDetailsData'
import { useTravelDetailsLayout } from '@/hooks/useTravelDetailsLayout'
import { useTravelDetailsMenu } from '@/hooks/useTravelDetailsMenu'
import { useTravelDetailsNavigation } from '@/hooks/useTravelDetailsNavigation'
import { useTravelDetailsPerformance } from '@/hooks/useTravelDetailsPerformance'
import { useTravelDetailsScrollState } from '@/hooks/useTravelDetailsScrollState'

export function useTravelDetails(args: {
  isMobile: boolean
  screenWidth: number
  startTransition: Parameters<typeof useTravelDetailsNavigation>[0]['startTransition']
}) {
  const data = useTravelDetailsData()

  const layout = useTravelDetailsLayout({
    isMobile: args.isMobile,
    screenWidth: args.screenWidth,
  })

  const navigation = useTravelDetailsNavigation({
    headerOffset: layout.headerOffset,
    slug: data.slug,
    startTransition: args.startTransition,
  })

  const performance = useTravelDetailsPerformance({
    travel: data.travel,
    isMobile: args.isMobile,
    isLoading: data.isLoading,
  })

  const menu = useTravelDetailsMenu(args.isMobile, performance.deferAllowed)

  const scroll = useTravelDetailsScrollState()

  return useMemo(() => ({
    data,
    layout,
    navigation,
    performance,
    menu,
    scroll,
  }), [data, layout, navigation, performance, menu, scroll])
}
