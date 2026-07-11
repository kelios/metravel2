import React, { useEffect, useState } from 'react'
import { View } from 'react-native'

import { safeLazy } from '@/components/layout/safeLazy'

const NetworkStatusLazy = safeLazy(
  () =>
    Promise.resolve(import('@/components/ui/NetworkStatus')).then((m) => {
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
const NewVersionPromptLazy = safeLazy(
  () => import('@/components/layout/NewVersionPrompt'),
  'NewVersionPrompt'
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
  const [showFooterChrome, setShowFooterChrome] = useState(true)
  const [showNetworkStatusChrome, setShowNetworkStatusChrome] = useState(true)
  const [showRuntimeEffects, setShowRuntimeEffects] = useState(true)
  const [showConsentBanner, setShowConsentBanner] = useState(false)
  const [showServiceWorkerCleanup, setShowServiceWorkerCleanup] = useState(false)

  useEffect(() => {
    setShowRuntimeEffects(true)
    setShowFooterChrome(true)
  }, [isTravelPerformanceRoute])

  useEffect(() => {
    let consentTimer: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null
    let consentCheckRevealed = false

    const maybeShowConsentBanner = () => {
      if (consentCheckRevealed) return
      consentCheckRevealed = true

      void Promise.resolve(import('@/utils/consent'))
        .then(({ readConsent }) => {
          if (readConsent()) return
          setShowConsentBanner(true)
        })
        .catch(() => {
          setShowConsentBanner(true)
        })
    }

    if (typeof document !== 'undefined') {
      rafId = requestAnimationFrame(() => {
        document.documentElement.classList.add('app-hydrated')
      })
    }

    consentTimer = setTimeout(() => {
      maybeShowConsentBanner()
    }, 1000)

    return () => {
      if (consentTimer) clearTimeout(consentTimer)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [isTravelPerformanceRoute])

  useEffect(() => {
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
    const delay = 1000

    timeoutId = setTimeout(() => {
      setShowServiceWorkerCleanup(true)
    }, delay)

    if ('requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(
        () => {
          setShowServiceWorkerCleanup(true)
        },
        { timeout: 1000 }
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

      {showServiceWorkerCleanup && (
        <React.Suspense fallback={null}>
          <NewVersionPromptLazy />
        </React.Suspense>
      )}

      {showConsentBanner && (
        <React.Suspense fallback={null}>
          <ConsentBannerLazy />
        </React.Suspense>
      )}

      {showFooter && showFooterChrome && (
        <React.Suspense
          fallback={
            isMobile ? <View style={{ height: WEB_FOOTER_RESERVE_HEIGHT, width: '100%' }} /> : null
          }
        >
          <FooterLazy onDockHeight={(height) => setDockHeight(height)} />
        </React.Suspense>
      )}
    </>
  )
}
