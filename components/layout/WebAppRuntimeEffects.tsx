import { useEffect } from 'react'

interface WebAppRuntimeEffectsProps {
  pathname?: string
}

export default function WebAppRuntimeEffects({ pathname }: WebAppRuntimeEffectsProps) {
  useEffect(() => {
    const onUnhandled = (e: PromiseRejectionEvent) => {
      const reason = (e as any)?.reason
      const msg = String(reason?.message ?? reason ?? '')
      const stack = typeof reason?.stack === 'string' ? reason.stack : ''

      const isFontTimeout =
        msg.includes('timeout exceeded') &&
        (String(msg).toLowerCase().includes('fontfaceobserver') ||
          String(stack).toLowerCase().includes('fontfaceobserver') ||
          msg.includes('6000ms timeout exceeded'))

      if (isFontTimeout) {
        e.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', onUnhandled)
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [])

  useEffect(() => {
    const active = document.activeElement as HTMLElement | null
    if (active && typeof active.blur === 'function') {
      active.blur()
    }

    const main = document.getElementById('main-content')
    if (!main) return

    const hadTabIndex = main.hasAttribute('tabindex')
    if (!hadTabIndex) {
      main.setAttribute('tabindex', '-1')
    }
    main.focus()
    if (!hadTabIndex) {
      main.removeAttribute('tabindex')
    }
  }, [pathname])

  useEffect(() => {
    const originalReplace = window.history.replaceState.bind(window.history)
    const originalPush = window.history.pushState.bind(window.history)

    window.history.replaceState = function patchedReplaceState(
      data: any,
      unused: string,
      url?: string | URL | null,
    ) {
      if (url != null) {
        const currentPath = window.location.pathname + window.location.search
        let newPath: string
        try {
          const resolved = new URL(String(url), window.location.href)
          newPath = resolved.pathname + resolved.search
        } catch {
          newPath = String(url)
        }
        if (newPath !== currentPath) {
          return originalPush(data, unused, url)
        }
      }
      return originalReplace(data, unused, url)
    }

    return () => {
      window.history.replaceState = originalReplace
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const MIGRATION_KEY = '__metravel_sw_disabled_migration_v1'

    const runMigration = async () => {
      try {
        try {
          if (window.localStorage.getItem(MIGRATION_KEY) === '1') return
        } catch {
          // localStorage may be unavailable in some private modes
        }

        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))

        if (typeof caches !== 'undefined') {
          const keys = await caches.keys()
          const legacyKeys = keys.filter(
            (key) => key.startsWith('metravel-') || key.startsWith('workbox-')
          )
          await Promise.all(legacyKeys.map((key) => caches.delete(key)))
        }

        try {
          window.localStorage.setItem(MIGRATION_KEY, '1')
        } catch {
          // noop
        }
      } catch {
        // noop
      }
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      void runMigration()
    }, 2000)
    let idleId: number | null = null

    if ('requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(
        () => {
          void runMigration()
        },
        { timeout: 3000 }
      )
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = null
      if (idleId !== null) {
        try {
          ;(window as any).cancelIdleCallback(idleId)
        } catch {
          // noop
        }
      }
    }
  }, [])

  return null
}
