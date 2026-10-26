import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, writeTextFile } from './cli-test-utils'

const {
  MIN_EXTERNAL_BYTES,
  externalizeDist,
  externalizeHeadStyles,
} = require('@/scripts/externalize-head-styles')

const css = (marker: string) => `.${marker}{color:red}`.repeat(Math.ceil(MIN_EXTERNAL_BYTES / 10) + 1)
const page = (body: string, rnw = css('r'), skeleton = css('s'), critical = css('c')) =>
  '<html><head><meta charset="utf-8"/>' +
  `<style id="metravel-critical-css">${critical}</style>` +
  `<style id="ssg-skeleton-css">${skeleton}</style>` +
  '<script>window.a=1</script>' +
  `<style id="react-native-stylesheet">${rnw}</style>` +
  `</head><body>${body}</body></html>`

describe('externalize-head-styles (#2762)', () => {
  let distDir: string

  beforeEach(() => {
    distDir = makeTempDir('externalize-head-styles-')
  })

  afterEach(() => {
    removeDir(distDir)
  })

  it('replaces each shared style with a render-blocking link that keeps the id and position', () => {
    const { html, assets } = externalizeHeadStyles(page('<div>A</div>'))

    expect(assets.map((asset: { fileName: string }) => asset.fileName)).toEqual([
      expect.stringMatching(/^rnw-[0-9a-f]{16}\.css$/),
      expect.stringMatching(/^critical-[0-9a-f]{16}\.css$/),
      expect.stringMatching(/^ssg-skeleton-[0-9a-f]{16}\.css$/),
    ])
    expect(html).not.toContain('<style id=')
    const order = [...html.matchAll(/<(link|script)\b([^>]*)>/g)].map((m) => /id="([^"]+)"/.exec(m[2])?.[1] ?? m[1])
    expect(order).toEqual(['metravel-critical-css', 'ssg-skeleton-css', 'script', 'react-native-stylesheet'])
    expect(html).toMatch(/<link rel="stylesheet" id="react-native-stylesheet" href="\/_expo\/static\/css\/rnw-[0-9a-f]{16}\.css" onerror="[^"]+">/)
    expect(html).not.toMatch(/media="print"/)
  })

  it('leaves small blocks inline and is a no-op on an already processed page', () => {
    const small = page('<div>B</div>', '.x{}')
    const first = externalizeHeadStyles(small)
    expect(first.html).toContain('<style id="react-native-stylesheet">.x{}</style>')
    expect(first.assets).toHaveLength(2)

    const second = externalizeHeadStyles(first.html)
    expect(second.html).toBe(first.html)
    expect(second.assets).toHaveLength(0)
  })

  it('keeps `$&`-like sequences in CSS out of the replacement', () => {
    const tricky = css('t') + ".q::after{content:\"$&$'$`\"}"
    const { html, assets } = externalizeHeadStyles(page('<div>C</div>', tricky))
    expect(html.match(/<html>/g)).toHaveLength(1)
    expect(assets[0].css).toBe(tricky)
  })

  it('writes one file per distinct content for the whole dist, keeps hardlinked page pairs linked', () => {
    const flat = path.join(distDir, 'quest.html')
    const index = path.join(distDir, 'quest', 'index.html')
    writeTextFile(flat, page('<div>quest</div>'))
    fs.mkdirSync(path.dirname(index))
    fs.linkSync(flat, index)
    writeTextFile(path.join(distDir, 'travels', 'a', 'index.html'), page('<div>travel</div>'))
    writeTextFile(path.join(distDir, '_expo', 'static', 'js', 'chunk.html'), page('<div>asset</div>'))

    const { pages, files, savedBytes } = externalizeDist(distDir)

    expect(pages).toBe(2)
    expect(files).toHaveLength(3)
    expect(savedBytes).toBeGreaterThan(3 * MIN_EXTERNAL_BYTES)
    expect(fs.statSync(flat).ino).toBe(fs.statSync(index).ino)
    expect(fs.readFileSync(index, 'utf8')).not.toContain('<style id=')
    expect(fs.readFileSync(path.join(distDir, '_expo', 'static', 'js', 'chunk.html'), 'utf8')).toContain('<style id=')
    for (const file of files) {
      expect(fs.readFileSync(path.join(distDir, '_expo', 'static', 'css', file), 'utf8')).toMatch(/^\.[rcs]\{color:red\}/)
    }
  })

  it('refuses a page that carries the same style id twice', () => {
    const doubled = page('<div>D</div>').replace('</head>', `<style id="react-native-stylesheet">${css('r')}</style></head>`)
    expect(() => externalizeHeadStyles(doubled)).toThrow(/react-native-stylesheet/)
  })
})
