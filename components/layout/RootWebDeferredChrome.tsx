import React, { useEffect, useState } from 'react'
import { View } from 'react-native'

const EmptyFallback = () => null
const safeLazy = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  name?: string
) =>
  React.lazy(() =>
    loader().catch((err) => {
      if (__DEV__) console.error(`[safeLazy] Failed to load ${name || 'component'}:`, err)
      return { default: EmptyFallback as unknown as T }
    })
  )

const SkipLinksLazy = safeLazy(() => import('@/components/layout/SkipLinks'), 'SkipLinks')
const NetworkStatusLazy = safeLazy(
  () =>
    import('@/components/ui/NetworkStatus').then((m) => {
      const Component = m.NetworkStatus ?? (m as any).default
      if (!Component) throw new Error('NetworkStatus export not found')
      return { default: Component }
    }),
  'NetworkStatus'
)
const FooterLazy = safeLazy(() => import('@/components/layout/Footer'), 'Footer')
const ConsentBannerLazy = safeLazy(() => import('@/components/layout/ConsentBanner'), 'ConsentBanner')
const WebAppRuntimeEffectsLazy = safeLazy(
  () => import('@/components/layout/WebAppRuntimeEffects'),
  'WebAppRuntimeEffects'
)
const WebServiceWorkerCleanupLazy = safeLazy(
  () => import('@/components/layout/WebServiceWorkerCleanup'),
  'WebServiceWorkerCleanup'
)

interface RootWebDeferredChromeProps {
  isMobile: boolean
  pathname?: string
  showFooter: boolean
  isTravelPerformanceRoute: boolean
  setDockHeight: (height: number) => void
}

const WEB_FOOTER_RESERVE_HEIGHT = 56

export default function RootWebDeferredChrome({
  isMobile,
  pathname,
  showFooter,
  isTravelPerformanceRoute,
  setDockHeight,
}: RootWebDeferredChromeProps) {
  const [showFooterChrome, setShowFooterChrome] = useState(!isTravelPerformanceRoute)
  const [showNetworkStatusChrome, setShowNetworkStatusChrome] = useState(!isTravelPerformanceRoute)
  const [showConsentBanner, setShowConsentBanner] = useState(false)
  const [showSkipLinks, setShowSkipLinks] = useState(false)
  const [showServiceWorkerCleanup, setShowServiceWorkerCleanup] = useState(false)

  useEffect(() => {
    let footerTimer: ReturnType<typeof setTimeout> | null = null
    let consentTimer: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null

    const footerDelay = isTravelPerformanceRoute ? 6500 : 0
    footerTimer = setTimeout(() => setShowFooterChrome(true), footerDelay)

    void import('@/utils/consent')
      .then(({ readConsent }) => {
        if (readConsent()) return
        const consentDelay = isTravelPerformanceRoute ? 9000 : 4000
        consentTimer = setTimeout(() => setShowConsentBanner(true), consentDelay)
      })
      .catch(() => {
        const consentDelay = isTravelPerformanceRoute ? 9000 : 4000
        consentTimer = setTimeout(() => setShowConsentBanner(true), consentDelay)
      })

    if (typeof document !== 'undefined') {
      rafId = requestAnimationFrame(() => {
        document.documentElement.classList.add('app-hydrated')
      })
    }

    return () => {
      if (footerTimer) clearTimeout(footerTimer)
      if (consentTimer) clearTimeout(consentTimer)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [isTravelPerformanceRoute])

  useEffect(() => {
    const revealSkipLinks = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey) return
      setShowSkipLinks(true)
    }

    window.addEventListener('keydown', revealSkipLinks, { passive: true, once: true })
    return () => {
      window.removeEventListener('keydown', revealSkipLinks)
    }
  }, [])

  useEffect(() => {
    if (!isTravelPerformanceRoute) return

    const revealNetworkStatus = () => {
      setShowNetworkStatusChrome(true)
    }

    if (navigator.onLine === false) {
      revealNetworkStatus()
    }

    window.addEventListener('offline', revealNetworkStatus)
    return () => {
      window.removeEventListener('offline', revealNetworkStatus)
    }
  }, [isTravelPerformanceRoute])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null
    const delay = isTravelPerformanceRoute ? 15000 : 6000

    timeoutId = setTimeout(() => {
      setShowServiceWorkerCleanup(true)
    }, delay)

    if ('requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(
        () => {
          setShowServiceWorkerCleanup(true)
        },
        { timeout: isTravelPerformanceRoute ? 12000 : 5000 }
      )
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (idleId !== null) {
        try {
          ;(window as any).cancelIdleCallback(idleId)
        } catch {
          // noop
        }
      }
    }
  }, [isTravelPerformanceRoute])

  return (
    <>
      {showSkipLinks && (
        <React.Suspense fallback={null}>
          <SkipLinksLazy initiallyVisible />
        </React.Suspense>
      )}

      {showNetworkStatusChrome && (
        <React.Suspense fallback={null}>
          <NetworkStatusLazy position="top" />
        </React.Suspense>
      )}

      <React.Suspense fallback={null}>
        <WebAppRuntimeEffectsLazy pathname={pathname} />
      </React.Suspense>

      {showServiceWorkerCleanup && (
        <React.Suspense fallback={null}>
          <WebServiceWorkerCleanupLazy />
        </React.Suspense>
      )}

      {showConsentBanner && (
        <React.Suspense fallback={null}>
          <ConsentBannerLazy />
        </React.Suspense>
      )}

      {showFooter && showFooterChrome && (
        <View
          style={
            isMobile
              ? ({ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100 } as any)
              : undefined
          }
        >
          <React.Suspense
            fallback={
              isMobile ? <View style={{ height: WEB_FOOTER_RESERVE_HEIGHT, width: '100%' }} /> : null
            }
          >
            <FooterLazy onDockHeight={(height) => setDockHeight(height)} />
          </React.Suspense>
        </View>
      )}
    </>
  )
}
