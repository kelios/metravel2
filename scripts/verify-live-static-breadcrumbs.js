#!/usr/bin/env node
'use strict'

const assert = require('node:assert/strict')
const { parseDocument, DomUtils } = require('htmlparser2')
const { STATIC_PAGES } = require('./postprocess-route-shells')
const { parseCliArgs, requireNonEmptySelection, runCli } = require('./lib/cli-contract')

const SITE_URL = 'https://metravel.by'
const LOCALES = ['be', 'uk', 'pl', 'en']
const CLI_SPEC = {
  name: 'verify-live-static-breadcrumbs',
  usage: 'node scripts/verify-live-static-breadcrumbs.js',
}

async function readDocument(path, locale) {
  const response = await fetch(new URL(path, SITE_URL), {
    headers: { 'Accept-Language': locale },
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
  })
  const context = `${path} (Accept-Language: ${locale})`
  assert.match(response.headers.get('content-type') ?? '', /text\/html/i, context)
  const { children } = parseDocument(await response.text())
  const find = (predicate) => DomUtils.findAll(predicate, children)
  const breadcrumbs = find((node) => node.name === 'script' && node.attribs.type === 'application/ld+json')
    .flatMap((node) => {
      const payload = JSON.parse(DomUtils.textContent(node))
      return payload?.['@graph'] ?? payload
    })
    .filter((node) => node?.['@type'] === 'BreadcrumbList')
  return { response, context, find, breadcrumbs }
}

async function readCanonicalBreadcrumbs(page, locale) {
  const { response, context, find, breadcrumbs } = await readDocument(page.route, locale)
  assert.equal(response.status, 200, context)
  assert.equal(find((node) => node.name === 'html')[0]?.attribs.lang, 'ru', context)
  const canonical = new URL(page.canonicalRoute, SITE_URL).href
  assert.deepEqual(find((node) => node.name === 'link' && node.attribs.rel === 'canonical')
    .map((node) => node.attribs.href), [canonical], context)
  assert.equal(breadcrumbs.length, 1, context)
  const items = breadcrumbs[0].itemListElement
  assert.ok(Array.isArray(items) && items.length >= 2
    && items.every((item) => typeof item?.name === 'string' && item.name.trim()), context)
  assert.equal(items.at(-1).name, page.breadcrumb, context)
  assert.equal(items.at(-1).item, canonical, context)
  return items
}

if (require.main === module) runCli(async () => {
  parseCliArgs(process.argv, CLI_SPEC)
  const pages = STATIC_PAGES.filter((entry) => entry.breadcrumb && entry.canonicalRoute !== '/')
  requireNonEmptySelection(pages, { what: 'static routes with breadcrumbs' })
  for (const page of pages) {
    const base = await readCanonicalBreadcrumbs(page, 'ru')
    for (const locale of LOCALES) {
      assert.deepEqual(await readCanonicalBreadcrumbs(page, locale), base, `${page.route} (${locale})`)
      // The locale-prefixed public URL contract covers quest details only.
      const { response, context, breadcrumbs } = await readDocument(`/${locale}${page.route}`, locale)
      assert.equal(response.status, 404, context)
      assert.equal(breadcrumbs.length, 0, context)
    }
    console.log(`${page.route} | RU: ${base.map((item) => item.name).join(' › ')} | BE/UK/PL/EN prefixes: 404`)
  }
}, CLI_SPEC)
