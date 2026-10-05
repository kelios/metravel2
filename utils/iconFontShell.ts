/**
 * Оболочка шрифта иконок на web (#2170).
 *
 * Глифы Feather есть в статическом HTML каждой страницы (см.
 * `metro-stubs/FeatherHydrationSafe.web.tsx`), поэтому иконки видны задолго до
 * гидратации — на медленной сети это десятки секунд разницы. Шрифт при этом
 * НЕ объявлен в `<head>` и не идёт в `preload`: запрос шрифта браузер ставит
 * выше картинки (замер прода 04.10.2026, 1,6 Мбит/с: ранний запрос шрифта
 * сдвигал LCP главной и статьи на ~190 мс, `fetchpriority="low"` на `preload`
 * этого не менял). Поэтому шрифт регистрирует короткий скрипт после разметки
 * приложения: сразу, если на первом экране нет LCP-картинки, иначе — по её
 * `load`/`error` либо по гидратации, что наступит раньше. Таймеров нет.
 *
 * До загрузки шрифта узел иконки скрыт и не участвует в раскладке своим
 * глифом: без гарнитуры код из Private Use Area рисуется «пустым квадратом» с
 * метриками запасного шрифта. Место держат `minWidth/minHeight` самой иконки.
 */

import {
  ICON_FONT_ATTR,
  ICON_FONT_FAMILY,
  ICON_FONT_READY_CLASS,
} from '@/utils/iconFontContract'

export { ICON_FONT_ATTR, ICON_FONT_DATASET, ICON_FONT_FAMILY, ICON_FONT_READY_CLASS } from '@/utils/iconFontContract'

/** Картинки первого экрана, которым шрифт иконок уступает канал. */
export const ICON_FONT_LCP_IMAGE_SELECTOR = 'img[data-ssg-lcp],img[data-lcp],img[data-ssg-map-tile]'

/**
 * Гарнитуры иконок, которым нельзя ставить `font-display:swap`: запасной шрифт
 * рисует их коды «квадратами». Вторая — `MaterialCommunityIcons`, её по-прежнему
 * подключает expo-font в рантайме.
 */
export const ICON_FONT_FAMILIES = [ICON_FONT_FAMILY, 'material-community'] as const

/** Критический CSS: пока шрифта нет, иконка невидима и держит только свою клетку. */
export function getIconFontGuardCss(): string {
  return `html:not(.${ICON_FONT_READY_CLASS}) [${ICON_FONT_ATTR}]{visibility:hidden;font-size:0!important}`
}

/** id узла `<style>` с правилом `@font-face` шрифта иконок. */
export const ICON_FONT_STYLE_ID = 'metravel-icon-font-face'

/**
 * Скрипт регистрации шрифта. Ставится ПОСЛЕ разметки приложения: к этому
 * моменту LCP-картинка первого экрана (SSG-шелл или серверная разметка) уже в
 * DOM, и её можно дождаться.
 *
 * Гарнитуру объявляет обычное правило `@font-face` — тот же путь отрисовки,
 * которым expo-font подключал её раньше, включая Safari. `document.fonts.load`
 * здесь только сообщает о готовности; если этого API нет или он ответил раньше
 * времени, показ ведёт `font-display:block` самого правила.
 *
 * Сбой загрузки. Упавшую гарнитуру браузер сам не перезапрашивает, поэтому
 * правило снимается и объявляется заново: без сети — по `online`, в сети — один
 * раз сразу (обрыв соединения, разовый 5xx). Второй сбой в сети означает, что
 * шрифт недоступен надолго (блокировщик шрифтов, режим блокировки iOS): иконки
 * открываются как есть — тем же глифом запасного шрифта, что был до #2170, — а
 * не остаются невидимыми до перезагрузки.
 */
export function buildIconFontLoaderScript(fontUrl: string): string {
  const url = JSON.stringify(fontUrl)
  const family = JSON.stringify(ICON_FONT_FAMILY)
  const readyClass = JSON.stringify(ICON_FONT_READY_CLASS)
  const styleId = JSON.stringify(ICON_FONT_STYLE_ID)
  const lcpSelector = JSON.stringify(ICON_FONT_LCP_IMAGE_SELECTOR)
  return (
    '(function(){' +
    `var d=document,h=d.documentElement,u=${url},started=false,attempts=0,o=null,rule=null;` +
    `function ready(){h.classList.add(${readyClass})}` +
    'function start(){if(started)return;started=true;attempts++;if(o){try{o.disconnect()}catch(_){}o=null}' +
    `rule=d.createElement('style');rule.id=${styleId};` +
    `rule.textContent='@font-face{font-family:'+${family}+';src:url("'+u+'");font-display:block}';d.head.appendChild(rule);` +
    "var fs=d.fonts;if(!fs||typeof fs.load!=='function'){ready();return}" +
    `fs.load('1em '+${family}).then(ready,failed)}` +
    // Последняя попытка оставляет правило на месте: открытые иконки дорисуются
    // сами, если шрифт всё-таки дойдёт.
    'function failed(){if(navigator.onLine!==false&&attempts>=2){ready();return}' +
    'try{d.head.removeChild(rule)}catch(_){}rule=null;started=false;' +
    "if(navigator.onLine===false){window.addEventListener('online',start,{once:true});return}" +
    'start()}' +
    'try{' +
    `var img=d.querySelector(${lcpSelector});` +
    "if(!img||img.complete||h.classList.contains('app-hydrated')){start();return}" +
    "img.addEventListener('load',start,{once:true});img.addEventListener('error',start,{once:true});" +
    // Приложение гидратировано — картинка своё окно уже получила.
    "if(typeof MutationObserver==='function'){o=new MutationObserver(function(){if(h.classList.contains('app-hydrated'))start()});o.observe(h,{attributes:true,attributeFilter:['class']})}" +
    '}catch(_){try{start()}catch(e){}}' +
    '})();'
  )
}

/**
 * `font-display` для `@font-face`, который expo-font дописывает в рантайме:
 * текстовым гарнитурам — `swap`, иконочным — `block`.
 */
export function buildFontDisplayPolicyScript(): string {
  const iconFamilies = JSON.stringify(ICON_FONT_FAMILIES.join('|'))
  return (
    '(function(){try{' +
    `var iconRe=new RegExp('font-family\\\\s*:\\\\s*["\\']?(?:'+${iconFamilies}+')["\\']?\\\\s*(?:;|$)','i');` +
    'function patch(css){return css.replace(/@font-face\\s*\\{([^}]*)\\}/g,function(match,body){' +
    "var want=iconRe.test(body)?'block':'swap';" +
    "if(body.indexOf('font-display:'+want)!==-1)return match;" +
    "if(body.indexOf('font-display')!==-1)return match.replace(/font-display\\s*:\\s*[^;}\"']+/g,'font-display:'+want);" +
    "return match.replace(/\\}\\s*$/,';font-display:'+want+';}')})}" +
    // 1. Правила, вставленные через CSSStyleSheet.insertRule.
    'if(window.CSSStyleSheet){var proto=window.CSSStyleSheet.prototype;' +
    "if(proto&&!proto.__metravelFontSwapPatched&&typeof proto.insertRule==='function'){var original=proto.insertRule;" +
    "proto.insertRule=function(rule,index){try{if(typeof rule==='string'&&rule.indexOf('@font-face')!==-1)rule=patch(rule)}catch(_e){}return original.call(this,rule,index)};" +
    'proto.__metravelFontSwapPatched=true}}' +
    // 2. <style> и текстовые узлы, которые expo-font дописывает в существующий <style>.
    "function patchStyle(el){if(!el||!el.textContent||el.textContent.indexOf('@font-face')===-1)return;var next=patch(el.textContent);if(next!==el.textContent)el.textContent=next}" +
    "if(typeof MutationObserver!=='undefined'){new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i],ns=m.addedNodes;for(var j=0;j<ns.length;j++){var n=ns[j];" +
    "if(n.tagName==='STYLE')patchStyle(n);" +
    "if(n.nodeType===3&&m.target&&m.target.tagName==='STYLE')patchStyle(m.target)}}}).observe(document.head||document.documentElement,{childList:true,subtree:true})}" +
    '}catch(_e){}})();'
  )
}
