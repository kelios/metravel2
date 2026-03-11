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
  const [showRuntimeEffects, setShowRuntimeEffects] = useState(!isTravelPerformanceRoute)
  const [showConsentBanner, setShowConsentBanner] = useState(false)
  const [showSkipLinks, setShowSkipLinks] = useState(false)
  const [showServiceWorkerCleanup, setShowServiceWorkerCleanup] = useState(false)

  useEffect(() => {
    if (!isTravelPerformanceRoute) {
      setShowRuntimeEffects(true)
      return
    }

    let revealed = false
    let revealTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (revealed) return
      revealed = true
      setShowRuntimeEffects(true)
    }, 5000)

    const reveal = () => {
      if (revealed) return
      revealed = true
      if (revealTimer) {
        clearTimeout(revealTimer)
        revealTimer = null
      }
      setShowRuntimeEffects(true)
    }

    window.addEventListener('pointerdown', reveal, { passive: true, once: true })
    window.addEventListener('keydown', reveal, { once: true })
    window.addEventListener('scroll', reveal, { passive: true, once: true })

    return () => {
      revealed = true
      if (revealTimer) clearTimeout(revealTimer)
      window.removeEventListener('pointerdown', reveal as EventListener)
      window.removeEventListener('keydown', reveal as EventListener)
      window.removeEventListener('scroll', reveal as EventListener)
    }
  }, [isTravelPerformanceRoute])

  useEffect(() => {
    let footerTimer: ReturnType<typeof setTimeout> | null = null
    let consentTimer: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null
    let consentCheckTimer: ReturnType<typeof setTimeout> | null = null
    let consentCheckRevealed = false

    const footerDelay = isTravelPerformanceRoute ? 6500 : 0
    footerTimer = setTimeout(() => setShowFooterChrome(true), footerDelay)

    const maybeShowConsentBanner = () => {
      if (consentCheckRevealed) return
      consentCheckRevealed = true

      void import('@/utils/consent')
        .then(({ readConsent }) => {
          if (readConsent()) return
          setShowConsentBanner(true)
        })
        .catch(() => {
          setShowConsentBanner(true)
        })
    }

    if (isTravelPerformanceRoute) {
      consentCheckTimer = setTimeout(() => {
        maybeShowConsentBanner()
      }, 9000)

      window.addEventListener('pointerdown', maybeShowConsentBanner, { passive: true, once: true })
      window.addEventListener('keydown', maybeShowConsentBanner, { once: true })
      window.addEventListener('scroll', maybeShowConsentBanner, { passive: true, once: true })
    } else {
      consentTimer = setTimeout(() => {
        maybeShowConsentBanner()
      }, 4000)
    }

    if (typeof document !== 'undefined') {
      rafId = requestAnimationFrame(() => {
        document.documentElement.classList.add('app-hydrated')
      })
    }

    return () => {
      if (footerTimer) clearTimeout(footerTimer)
      if (consentTimer) clearTimeout(consentTimer)
      if (consentCheckTimer) clearTimeout(consentCheckTimer)
      if (rafId != null) cancelAnimationFrame(rafId)
      window.removeEventListener('pointerdown', maybeShowConsentBanner as EventListener)
      window.removeEventListener('keydown', maybeShowConsentBanner as EventListener)
      window.removeEventListener('scroll', maybeShowConsentBanner as EventListener)
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

      {showRuntimeEffects && (
        <React.Suspense fallback={null}>
          <WebAppRuntimeEffectsLazy pathname={pathname} />
        </React.Suspense>
      )}

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
