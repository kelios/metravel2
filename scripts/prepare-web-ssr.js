#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { parseEnv } = require('node:util')
const { execFileSync } = require('node:child_process')
const { assertServerExport } = require('./lib/webServerArtifact')
const { packageQuestWebBuilder } = require('./package-quest-web-builder')
const { EXTERNALIZED_STYLES, externalizeHeadStyles } = require('./externalize-head-styles')
const { SHARED_CSS_URL_DIR, SSR_CRITICAL_CSS_ENV, isSharedCriticalCssFile } = require('../utils/ssr/criticalCss')

const CRITICAL_CSS_ID = 'metravel-critical-css'

function shellRoute(route) {
  const parts = route.page.split('/').filter((part) => part && !/^\([^/]+\)$/.test(part))
  if (parts.some((part) => part === '.' || part === '..' || part.includes('\\'))) throw new Error('Invalid SSR route path')
  const file = `${parts.join('/') || 'index'}.html`
  const pathname = `/${parts.join('/')}`.replace(/\/index$/, '') || '/'
  const params = {}
  for (const part of parts) {
    const match = part.match(/^\[(\.\.\.)?([^\]]+)\]$/)
    if (match) params[match[2]] = match[1] ? [part] : part
  }
  return { file, pathname, params }
}

function publicationShells(route) {
  const shells = [shellRoute(route)]
  if (route.page !== '/(tabs)/books/[slug]') return shells
  // Server export does not prerender generateStaticParams. Books are a finite,
  // local publication: render their documents from the same catalogue pointer.
  const { books } = require('../data/travelBooks/manifest.json')
  for (const { slug } of books) {
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid published book slug')
    shells.push({ file: `books/${slug}.html`, pathname: `/books/${slug}`, params: { slug } })
  }
  return shells
}

function publicConfig(envFile, env = process.env) {
  const values = { ...(envFile ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {}), ...env }
  const result = {}
  for (const [key, value] of Object.entries(values)) {
    if (/^EXPO_PUBLIC_[A-Z0-9_]+$/.test(key) && typeof value === 'string') result[key] = value
  }
  result.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
  return result
}

async function renderLegacyShells(rendererFile, { manifest, staticDir }) {
  // The caller supplies the renderer of a validated operator-selected export,
  // not an inferred edge into application source or a source-directory glob.
  const renderer = require(path.resolve(process.cwd(), rendererFile))
  if (typeof renderer.getStreamingContent !== 'function' || typeof renderer.resolveMetadata !== 'function') {
    throw new Error('Expected the installed Expo streaming renderer and metadata resolver')
  }
  const emitted = new Set()
  const shells = [...manifest.htmlRoutes, ...manifest.notFoundRoutes]
    .flatMap(route => publicationShells(route).map(shell => ({ route, shell })))
  for (const { route, shell } of shells) {
    if (emitted.has(shell.file)) continue
    const matchedRoute = { file: route.file, page: route.page, ...(route.generated ? { generated: true } : {}) }
    // No request: dynamic entities keep placeholder parameters. Only local,
    // published books have concrete parameters; no API content is prerendered.
    const metadata = route.generated ? null
      : await renderer.resolveMetadata({ route: matchedRoute, request: undefined, params: shell.params })
    const assets = {
      css: [...(manifest.assets?.css || []), ...(route.assets?.css || [])],
      js: [...(manifest.assets?.js || []), ...(route.assets?.js || [])],
      favicon: manifest.assets?.favicon,
    }
    let timeout
    try {
      const html = await Promise.race([
        renderer.getStreamingContent(new URL(shell.pathname, 'https://metravel.by'), {
          route: matchedRoute, params: shell.params, metadata, assets, output: 'static',
          ...(route.loader ? { loader: { data: null, key: route.page } } : {}),
        }),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`SSR shell render timed out: ${route.page}`)), 10_000) }),
      ])
      if (typeof html !== 'string' || !html.includes('<html') || !html.includes('id="root"')) throw new Error(`Invalid SSR shell: ${route.page}`)
      const destination = path.join(staticDir, shell.file)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.writeFileSync(destination, html)
      emitted.add(shell.file)
    } finally { clearTimeout(timeout) }
  }
  if (!emitted.has('index.html')) throw new Error('SSR export has no root route shell')
  return emitted.size
}

/**
 * Оболочки отрисованы тем же рендерером, что и серверные ответы, а
 * buildCriticalCSS() без входов: CSS корневой оболочки — ровно тот, который
 * иначе инлайнился бы в каждый ответ. Имя — тот же sha256, что даёт вынос
 * статических страниц (#2762), поэтому файл у статики и SSR один (#2768).
 */
function sharedCriticalCss(shellHtml) {
  const { prefix } = EXTERNALIZED_STYLES.find((style) => style.id === CRITICAL_CSS_ID)
  const asset = externalizeHeadStyles(shellHtml).assets.find(({ fileName }) => fileName.startsWith(`${prefix}-`))
  if (!asset || !isSharedCriticalCssFile(asset.fileName)) throw new Error('SSR root shell has no shared critical CSS block')
  return asset
}

function writeSharedCss(clientRoot, { fileName, css }) {
  const dir = path.join(clientRoot, ...SHARED_CSS_URL_DIR.split('/').filter(Boolean))
  const target = path.join(dir, fileName)
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== css) throw new Error(`Shared CSS ${fileName} differs from the rendered shell`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(target, css)
}

// Only EXPO_PUBLIC_* strings (publicConfig, rechecked by the backend stage).
// The Django gateway reads the quest flag here under its own uid, so the file
// must be world-readable like the rest of the release: 0600 turned every
// quest and home page into 503 while articles, which skip it, rendered.
function writePublicConfig(runtimeDir, config) {
  const file = path.join(runtimeDir, '.ssr-env.json')
  fs.writeFileSync(file, `${JSON.stringify(config)}\n`)
  fs.chmodSync(file, 0o644)
  return file
}

async function prepareWebSsr({ exportDir, staticDir, runtimeDir, envFile, sha, dirty = false }) {
  const { serverDir, clientDir, manifest } = assertServerExport(exportDir)
  const config = publicConfig(envFile)
  Object.assign(process.env, config, { METRAVEL_WEB_OUTPUT: 'server' })
  // Оболочки обязаны нести инлайн: из него выводится общий файл.
  delete process.env[SSR_CRITICAL_CSS_ENV]
  fs.mkdirSync(staticDir, { recursive: true })
  fs.cpSync(clientDir, staticDir, { recursive: true })
  const shellCount = await renderLegacyShells(path.join(serverDir, manifest.rendering.file), { manifest, staticDir })
  const criticalCss = sharedCriticalCss(fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8'))
  writeSharedCss(staticDir, criticalCss)
  fs.mkdirSync(runtimeDir, { recursive: true })
  fs.cpSync(serverDir, path.join(runtimeDir, 'server'), { recursive: true })
  fs.cpSync(clientDir, path.join(runtimeDir, 'client'), { recursive: true })
  writeSharedCss(path.join(runtimeDir, 'client'), criticalCss)
  const runtime = path.join(runtimeDir, 'runtime')
  fs.mkdirSync(path.join(runtime, 'lib'), { recursive: true })
  fs.copyFileSync(path.join(__dirname, 'serve-web-ssr.js'), path.join(runtime, 'serve-web-ssr.js'))
  fs.copyFileSync(path.join(__dirname, 'deploy-expo-overlay.sh'), path.join(runtime, 'deploy-expo-overlay.sh'))
  for (const helper of ['webServerArtifact.js', 'webOutput.js', 'ssrApiTransport.js']) {
    fs.copyFileSync(path.join(__dirname, 'lib', helper), path.join(runtime, 'lib', helper))
  }
  fs.mkdirSync(path.join(runtimeDir, 'utils', 'ssr'), { recursive: true })
  for (const helper of ['ssr/requestLocale.js', 'ssr/criticalCss.js', 'questLocaleRouting.js']) {
    fs.copyFileSync(path.join(__dirname, '..', 'utils', helper), path.join(runtimeDir, 'utils', helper))
  }
  const packageRoot = path.dirname(require.resolve('expo-server/package.json'))
  fs.mkdirSync(path.join(runtime, 'node_modules'), { recursive: true })
  fs.cpSync(packageRoot, path.join(runtime, 'node_modules/expo-server'), { recursive: true })
  if (config.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true') await packageQuestWebBuilder(runtime)
  writePublicConfig(runtimeDir, config)
  fs.writeFileSync(path.join(runtimeDir, '.ssr-build.json'), `${JSON.stringify({ sha, dirty, output: 'server', criticalCss: criticalCss.fileName })}\n`)
  console.log(`[prepare-web-ssr] ${shellCount} legacy shells, one client bundle, private runtime packaged`)
  return shellCount
}

async function main() {
  const args = process.argv.slice(2)
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--export-dir': 'exportDir', '--static-dir': 'staticDir', '--runtime-dir': 'runtimeDir', '--env-file': 'envFile' }[args[i]]
    if (!key || !args[i + 1]) throw new Error('Invalid prepare-web-ssr arguments')
    options[key] = path.resolve(args[i + 1])
  }
  if (!options.exportDir || !options.staticDir || !options.runtimeDir) throw new Error('export-dir, static-dir and runtime-dir are required')
  options.sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  options.dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
  await prepareWebSsr(options)
}

module.exports = { shellRoute, publicConfig, writePublicConfig, sharedCriticalCss, writeSharedCss, renderLegacyShells, prepareWebSsr }
if (require.main === module) main().catch((error) => { console.error(`[prepare-web-ssr] ${error.message}`); process.exitCode = 1 })
