/* global module, process */
'use strict'

// #2768: серверный ответ ссылается на тот же общий файл critical CSS, что и
// статические страницы (#2762, scripts/externalize-head-styles.js), вместо
// 16 КБ инлайна в каждом ответе. Имя файла выводит сборка
// (scripts/prepare-web-ssr.js → .ssr-build.json), раннер
// (scripts/serve-web-ssr.js) проверяет, что файл лежит в клиентской раздаче,
// и только тогда публикует имя в окружении процесса.

const SSR_CRITICAL_CSS_ENV = 'METRAVEL_SSR_CRITICAL_CSS'
const SHARED_CRITICAL_CSS_FILE = /^critical-[a-f0-9]{16}\.css$/
const SHARED_CSS_URL_DIR = '/_expo/static/css'

function isSharedCriticalCssFile(fileName) {
  return typeof fileName === 'string' && SHARED_CRITICAL_CSS_FILE.test(fileName)
}

/** href общего файла или null для страниц с критическим первым экраном. */
function resolveSsrCriticalCssHref(env = process.env, pathname) {
  // Home and travel details paint their server HTML before React starts. Keep
  // the small critical sheet in that response instead of adding a blocking
  // round trip (Google PSI #3071: up to 451 ms for this stylesheet).
  if (pathname === '/' || (typeof pathname === 'string' && /^\/travels\/[^/]+\/?$/.test(pathname))) return null
  if (env.EXPO_PUBLIC_WEB_RUNTIME_SSR !== 'true') return null
  const fileName = env[SSR_CRITICAL_CSS_ENV]
  return isSharedCriticalCssFile(fileName) ? `${SHARED_CSS_URL_DIR}/${fileName}` : null
}

module.exports = {
  SHARED_CSS_URL_DIR,
  SSR_CRITICAL_CSS_ENV,
  isSharedCriticalCssFile,
  resolveSsrCriticalCssHref,
}
