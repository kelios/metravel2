import { useRef } from 'react'
import { View, type ViewInstance } from 'react-native'
import FooterDesktop from '@/components/layout/FooterDesktop'
import WebMobileDockShell from '@/components/layout/WebMobileDockShell'
import { useWebFooterHeightPublisher } from '@/components/layout/bottomChromeInset'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { WEB_DESKTOP_FOOTER_LAYOUT } from '@/components/layout/webMobileDockLayout'

// Real footer content owns its intrinsic height in SSR, before any route/map
// mounts. CSS selects the same desktop/dock boundary without a hydration swap.
// Its rendered height anchors floating notices above it (#2788).
export default function RootWebFooter() {
  const shellRef = useRef<ViewInstance>(null)
  useWebFooterHeightPublisher(shellRef)
  return (
    <>
      <WebMobileDockShell />
      <View
        ref={shellRef}
        style={breakpointStyle(WEB_DESKTOP_FOOTER_LAYOUT, 'shell', false)}
        {...breakpointLayoutProps(WEB_DESKTOP_FOOTER_LAYOUT, 'shell')}
      >
        <FooterDesktop />
      </View>
    </>
  )
}
