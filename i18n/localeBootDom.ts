export const LOCALE_BOOT_PENDING_CLASS = 'locale-boot-pending'

declare global {
  interface Window {
    __metravelLocaleBootErrorHandler?: EventListener
    __metravelLocaleBootRecoveryOwner?: 'static' | 'react'
  }
}

/** React can now recover catalogue errors itself; never stack both panels. */
export const claimLocaleBootRecovery = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  window.__metravelLocaleBootRecoveryOwner = 'react'
  if (window.__metravelLocaleBootErrorHandler) {
    window.removeEventListener('error', window.__metravelLocaleBootErrorHandler, true)
    delete window.__metravelLocaleBootErrorHandler
  }
  document.querySelectorAll('[data-static-recovery="true"]').forEach((panel) => panel.remove())
}

export const releaseLocaleBootShell = (): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove(LOCALE_BOOT_PENDING_CLASS)
    document.querySelectorAll('[data-static-recovery="true"]').forEach((panel) => panel.remove())
  }
}
