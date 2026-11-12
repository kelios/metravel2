/**
 * #3316: возврат адресов картинкам, которые инертный проход отложил
 * (`toInertHtml(html, { deferImages: true })`, `utils/inertHtmlDeferredImages.ts`).
 * В документе это делает оболочка (`richTextDeferredImagesShell.ts`) — по
 * `load`/`error` LCP-картинки первого экрана либо по гидратации, тем же правилом,
 * что шрифт иконок (#2170); остров, смонтированный клиентом, — сам, этой функцией.
 * Дальше работает `loading="lazy"`.
 */

import { DEFERRED_IMAGE_ATTRIBUTES, DEFERRED_IMAGE_SELECTOR } from '@/utils/inertHtmlDeferredImages'

/** Возвращает адреса отложенных картинок внутри `root`. */
export function releaseDeferredRichTextImages(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>(DEFERRED_IMAGE_SELECTOR).forEach((img) => {
    for (const [live, deferred] of DEFERRED_IMAGE_ATTRIBUTES) {
      const value = img.getAttribute(deferred)
      if (value === null) continue
      img.removeAttribute(deferred)
      img.setAttribute(live, value)
    }
  })
}
