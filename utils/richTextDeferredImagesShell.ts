/**
 * #3316: оболочка документа возвращает адреса картинок серверного острова тела
 * статьи (`toInertHtml(html, { deferImages: true })`, `utils/inertHtmlDeferredImages.ts`). Правило то же, что у шрифта иконок
 * (#2170, `utils/iconFontShell.ts`): сразу, если на первом экране нет
 * LCP-картинки, иначе по её `load`/`error` либо по гидратации, что наступит
 * раньше. Таймеров нет. Скрипт стоит после разметки приложения: остров и
 * LCP-картинка к этому моменту уже в DOM.
 */

import { ICON_FONT_LCP_IMAGE_SELECTOR } from '@/utils/iconFontShell'
import { DEFERRED_IMAGE_ATTRIBUTES, DEFERRED_IMAGE_SELECTOR } from '@/utils/inertHtmlDeferredImages'

const ISLAND_IMAGE_SELECTOR = DEFERRED_IMAGE_SELECTOR.split(',')
  .map((selector) => `[data-ssr-html-island] ${selector}`)
  .join(',')

export function buildDeferredRichTextImagesScript(): string {
  const selector = JSON.stringify(ISLAND_IMAGE_SELECTOR)
  const lcpSelector = JSON.stringify(ICON_FONT_LCP_IMAGE_SELECTOR)
  const pairs = JSON.stringify(DEFERRED_IMAGE_ATTRIBUTES)
  return (
    '(function(){' +
    `var d=document,h=d.documentElement,s=${selector},p=${pairs},done=false,o=null;` +
    'function release(){if(done)return;done=true;if(o){try{o.disconnect()}catch(_){}o=null}' +
    'var list=d.querySelectorAll(s);for(var i=0;i<list.length;i++){var img=list[i];' +
    'for(var j=0;j<p.length;j++){var v=img.getAttribute(p[j][1]);if(v===null)continue;img.removeAttribute(p[j][1]);img.setAttribute(p[j][0],v)}}}' +
    'try{if(!d.querySelector(s))return;' +
    `var img=d.querySelector(${lcpSelector});` +
    "if(!img||img.complete||h.classList.contains('app-hydrated')){release();return}" +
    "img.addEventListener('load',release,{once:true});img.addEventListener('error',release,{once:true});" +
    "if(typeof MutationObserver==='function'){o=new MutationObserver(function(){if(h.classList.contains('app-hydrated'))release()});o.observe(h,{attributes:true,attributeFilter:['class']})}" +
    '}catch(_){try{release()}catch(e){}}' +
    '})();'
  )
}
