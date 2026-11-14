/**
 * #3316: возврат адресов картинкам, которые инертный проход отложил
 * (`toInertHtml(html, { deferImages: true })`, `utils/inertHtmlDeferredImages.ts`).
 * В документе это делает оболочка (`richTextDeferredImagesShell.ts`) — по
 * `load`/`error` LCP-картинки первого экрана либо по гидратации, тем же правилом,
 * что шрифт иконок (#2170); остров, смонтированный клиентом, — сам, этой функцией.
 * Дальше работает `loading="lazy"`.
 */

import { isArticleBodyMobileViewport } from '@/components/travel/stableContent/articleBodySlots'
import {
  DEFERRED_IMAGE_ATTRIBUTES,
  DEFERRED_IMAGE_SELECTOR,
  DEFERRED_MOBILE_SRCSET_ATTRIBUTE,
} from '@/utils/inertHtmlDeferredImages'

/**
 * #3408: на мобильном вьюпорте вместо десктопной лестницы встаёт мобильная —
 * тот же набор, что полный рендер выдаст на этом вьюпорте. Пустая мобильная
 * лестница снимает `srcset`/`sizes`: картинка остаётся на `src`.
 */
function applyMobileSrcset(img: Element, mobile: boolean): void {
  const value = img.getAttribute(DEFERRED_MOBILE_SRCSET_ATTRIBUTE)
  if (value === null) return
  img.removeAttribute(DEFERRED_MOBILE_SRCSET_ATTRIBUTE)
  if (!mobile) return
  if (value) {
    img.setAttribute('data-deferred-srcset', value)
    return
  }
  img.removeAttribute('data-deferred-srcset')
  img.removeAttribute('data-deferred-sizes')
}

/** Возвращает адреса отложенных картинок внутри `root`. */
export function releaseDeferredRichTextImages(root: ParentNode): void {
  const mobile = typeof window !== 'undefined' && isArticleBodyMobileViewport(window.innerWidth || 0)
  root.querySelectorAll<HTMLImageElement>(DEFERRED_IMAGE_SELECTOR).forEach((img) => {
    applyMobileSrcset(img, mobile)
    // #3414: заглушка снимается до выдачи адресов — см. `DEFERRED_IMAGE_ATTRIBUTES`.
    img.removeAttribute('src')
    for (const [live, deferred] of DEFERRED_IMAGE_ATTRIBUTES) {
      const value = img.getAttribute(deferred)
      if (value === null) continue
      img.removeAttribute(deferred)
      img.setAttribute(live, value)
    }
  })
}
