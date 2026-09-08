#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Exact public/ paths, including files copied by Expo itself. No directory
// wildcards: a new file must be reviewed even inside an existing asset folder.
// When adding/removing public assets, update this registry in the same change.
const PUBLIC_FILES = Object.freeze({
  '.well-known/assetlinks.json': 'Android App Links verification',
  'apple-touch-icon.png': 'Browser touch icon',
  'assets/data/lasy-zanocuj.json': 'Polish forest camping map data',
  'assets/icons/apple-touch-icon-180x180.png': 'PWA touch icon',
  'assets/icons/end.ico': 'Route end marker',
  'assets/icons/logo_yellow.ico': 'Legacy logo icon asset',
  'assets/icons/logo_yellow.png': 'Logo asset',
  'assets/icons/logo_yellow_192x192.png': 'PWA icon',
  'assets/icons/logo_yellow_512x512.png': 'PWA icon',
  'assets/icons/logo_yellow_60x60.png': 'Small logo asset',
  'assets/icons/marker.ico': 'Map marker',
  'assets/icons/start.ico': 'Route start marker',
  'assets/icons/user_location.ico': 'User location marker',
  'assets/images/open-book-bg-dark.jpg': 'Dark book background, JPEG variant',
  'assets/images/open-book-bg-dark.webp': 'Dark book background, WebP variant',
  'assets/images/open-book-bg.png': 'Book background, PNG variant',
  'assets/images/open-book-bg.webp': 'Book background, WebP variant',
  'eb1c0d4b6f120c68a79525b7fe86581b.txt': 'External site ownership verification',
  'favicon-16x16.png': 'Browser favicon',
  'favicon-32x32.png': 'Browser favicon',
  'favicon.ico': 'Browser favicon',
  'icon.svg': 'SVG app icon',
  'manifest.json': 'Web app manifest',
  'og-default.png': 'Default social preview',
  'og-home.jpg': 'Home social preview',
  'og-map.png': 'Map social preview',
  'og/quests.jpg': 'Quests social preview',
  'quill.snow.css': 'Editor stylesheet',
  'robots.txt': 'Crawler directives',
  'static/quests/quest-default-cover.svg': 'Quest fallback cover',
  'travel-hero-preload-v2.js': 'Active travel hero preload script',
  'trips/fallbacks/trip-fallback-autumn.jpg': 'Autumn trip fallback cover',
  'trips/fallbacks/trip-fallback-spring.jpg': 'Spring trip fallback cover',
  'trips/fallbacks/trip-fallback-summer.jpg': 'Summer trip fallback cover',
  'trips/fallbacks/trip-fallback-winter.jpg': 'Winter trip fallback cover',
  'vendor/MarkerCluster.css': 'Map clustering stylesheet',
  'vendor/leaflet.css': 'Leaflet stylesheet',
})

const evaluateGuard = (publicDir = path.resolve(__dirname, '../public')) => {
  const files = []
  const violations = []
  const walk = (relativeDir) => {
    const directory = path.join(publicDir, relativeDir)
    // Do not follow symlinks, including public/ itself, into another checkout.
    if (!fs.lstatSync(directory).isDirectory()) {
      throw new Error(`public/${relativeDir} must be a real directory`)
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(relativePath)
      } else if (entry.isFile()) {
        files.push(relativePath)
        if (!Object.hasOwn(PUBLIC_FILES, relativePath)) {
          violations.push(`Undeclared file: public/${relativePath}`)
        }
      } else {
        violations.push(`Unsupported entry (symlink or special file): public/${relativePath}`)
      }
    }
  }
  walk('')
  const present = new Set(files)
  for (const file of Object.keys(PUBLIC_FILES)) {
    if (!present.has(file)) violations.push(`Registered file missing: public/${file}`)
  }
  return { ok: violations.length === 0, files: files.sort(), violations: violations.sort() }
}

const main = () => {
  try {
    const result = evaluateGuard()
    if (!result.ok) {
      console.error(`guard:public-files failed:\n${result.violations.join('\n')}`)
      console.error('The asset author must remove accidental files or declare intentional assets with their purpose in PUBLIC_FILES (scripts/guard-public-files.js). Remove obsolete registry entries when deleting assets.')
      process.exitCode = 1
      return
    }
    console.log(`guard:public-files passed (${result.files.length} registered files).`)
  } catch (error) {
    console.error(`guard:public-files failed: ${error.message}`)
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = { PUBLIC_FILES, evaluateGuard }
