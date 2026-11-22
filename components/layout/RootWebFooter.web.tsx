import { Suspense, useRef } from 'react'
import { View, type ViewInstance } from 'react-native'
import FooterDesktop from '@/components/layout/FooterDesktop'
import WebMobileDockShell from '@/components/layout/WebMobileDockShell'
import { useWebFooterHeightPublisher } from '@/components/layout/bottomChromeInset'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { WEB_DESKTOP_FOOTER_LAYOUT } from '@/components/layout/webMobileDockLayout'

// Real footer content owns its intrinsic height in SSR, before any route/map
// mounts. CSS selects the same desktop/dock boundary without a hydration swap.
// Its rendered height anchors floating notices above it (#2788).
// #3467: док и desktop-подвал — каждый в своей Suspense-границе. В SSR это только
// маркеры <!--$-->, разметка та же; на клиенте они гидратируются отдельно, и тап
// по статье или шапке в окне гидратации не дорисовывает ~430 файберов подвала
// синхронно (без границ подвал входил в путь КАЖДОГО тапа на любом маршруте).
export default function RootWebFooter() {
  const shellRef = useRef<ViewInstance>(null)
  useWebFooterHeightPublisher(shellRef)
  return (
    <>
      <Suspense fallback={null}>
        <WebMobileDockShell />
      </Suspense>
      <View
        ref={shellRef}
        style={breakpointStyle(WEB_DESKTOP_FOOTER_LAYOUT, 'shell', false)}
        {...breakpointLayoutProps(WEB_DESKTOP_FOOTER_LAYOUT, 'shell')}
      >
        <Suspense fallback={null}>
          <FooterDesktop />
        </Suspense>
      </View>
    </>
  )
}
