/* global module, require, process */
'use strict'

const { QUEST_LOCALES, parseQuestLocaleRoute } = require('../questLocaleRouting')

const REQUEST_LOCALE = Symbol.for('metravel.ssr.locale')
const SERVER_CATALOGS = Symbol.for('metravel.ssr.localeCatalogs')

function isServerSsrRuntime() {
  return typeof window === 'undefined' && process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR === 'true'
}

// Reserved TLD: this module ships in the browser bundle, where a loopback URL
// literal fails the production config guard (scripts/verify-prod-config.js).
const URL_BASE = 'http://ssr.invalid'

function resolveRequestLocale(url) {
  const pathname = new URL(url || '/', URL_BASE).pathname
  const routePath = pathname.startsWith('/_expo/loaders/') ? pathname.slice('/_expo/loaders'.length) : pathname
  return parseQuestLocaleRoute(routePath)?.locale || 'ru'
}

function getRequestLocaleStore() {
  return globalThis[REQUEST_LOCALE]
}

function installRequestLocaleStore(store) {
  if (typeof store?.run !== 'function' || typeof store?.getStore !== 'function') {
    throw new Error('Invalid SSR locale store')
  }
  return globalThis[REQUEST_LOCALE] || (globalThis[REQUEST_LOCALE] = store)
}

function readRequestLocale() {
  if (!isServerSsrRuntime()) return null
  const locale = getRequestLocaleStore()?.getStore()?.locale
  return QUEST_LOCALES.includes(locale) ? locale : null
}

// Only immutable locale catalogues and their finite loading resources belong
// here. Request data stays in ALS and is never retained by this registry.
function getServerLocaleCatalogState() {
  if (!isServerSsrRuntime()) return null
  return globalThis[SERVER_CATALOGS] || (globalThis[SERVER_CATALOGS] = {
    loadedCatalogs: new Map(), loadPromises: new Map(), readyPromises: new Map(),
  })
}

module.exports = {
  isServerSsrRuntime, resolveRequestLocale, getRequestLocaleStore,
  installRequestLocaleStore, readRequestLocale, getServerLocaleCatalogState,
}
