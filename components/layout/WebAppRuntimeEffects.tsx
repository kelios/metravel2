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

  return null
}
