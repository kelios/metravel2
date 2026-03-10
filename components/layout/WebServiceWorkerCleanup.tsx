import { useEffect } from 'react'

const MIGRATION_KEY = '__metravel_sw_disabled_migration_v1'

export default function WebServiceWorkerCleanup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

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

    void runMigration()
  }, [])

  return null
}
