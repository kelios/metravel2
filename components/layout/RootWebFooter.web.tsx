import { View } from 'react-native'
import FooterDesktop from '@/components/layout/FooterDesktop'
import WebMobileDockShell from '@/components/layout/WebMobileDockShell'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { WEB_DESKTOP_FOOTER_LAYOUT } from '@/components/layout/webMobileDockLayout'

// Real footer content owns its intrinsic height in SSR, before any route/map
// mounts. CSS selects the same desktop/dock boundary without a hydration swap.
export default function RootWebFooter() {
  return (
    <>
      <WebMobileDockShell />
      <View
        style={breakpointStyle(WEB_DESKTOP_FOOTER_LAYOUT, 'shell', false)}
        {...breakpointLayoutProps(WEB_DESKTOP_FOOTER_LAYOUT, 'shell')}
      >
        <FooterDesktop />
      </View>
    </>
  )
}
