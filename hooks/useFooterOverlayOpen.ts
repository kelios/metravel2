import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

/**
 * Открыт ли оверлей «Ещё» нижнего дока (web).
 *
 * Док помечает `body[data-footer-more-open]` и шлёт `metravel:footer-more`.
 * Плавающие нижние плашки (cookie-баннер, подсказка про приложение) обязаны на
 * это время прятаться, иначе перекрывают пункты меню.
 */
export function useFooterOverlayOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const body = document.body
    if (!body) return

    const update = () => {
      setOpen(body.getAttribute('data-footer-more-open') === 'true')
    }
    update()

    const observer = new MutationObserver(update)
    observer.observe(body, { attributes: true, attributeFilter: ['data-footer-more-open'] })

    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      if (detail && typeof detail.open === 'boolean') {
        setOpen(detail.open)
      }
    }
    window.addEventListener('metravel:footer-more', handle)

    return () => {
      observer.disconnect()
      window.removeEventListener('metravel:footer-more', handle)
    }
  }, [])

  return open
}

export default useFooterOverlayOpen
