const fs = require('fs');
const path = require('path');
const { makeTempDir } = require('./cli-test-utils');

const {
  STATIC_ROUTES,
  buildSitemapXml,
  buildStaticEntries,
  buildTravelEntries,
  escapeXml,
  extractItems,
  extractTotal,
  normalizeRoute,
  toAbsoluteUrl,
  toIsoDate,
  writeSitemap,
} = require('@/scripts/generate-sitemap');

describe('generate-sitemap helpers', () => {
  it('keeps the public indexable route allowlist stable', () => {
    expect(STATIC_ROUTES).toEqual([
      '/',
      '/search',
      '/map',
      '/travelsby',
      '/about',
      '/contact',
      '/roulette',
    ]);
  });

  it('normalizes routes and converts them to absolute URLs', () => {
    expect(normalizeRoute('search/')).toBe('/search');
    expect(normalizeRoute('/')).toBe('/');
    expect(toAbsoluteUrl('/')).toBe('https://metravel.by/');
    expect(toAbsoluteUrl('map')).toBe('https://metravel.by/map');
  });

  it('extracts list items and totals from common API payload shapes', () => {
    expect(extractItems({ results: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(extractItems({ data: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(extractTotal({ count: 24 }, 1)).toBe(24);
    expect(extractTotal({ total: 12 }, 1)).toBe(12);
    expect(extractTotal({}, 3)).toBe(3);
  });

  it('builds travel entries with dedupe and lastmod', () => {
    const entries = buildTravelEntries([
      { slug: 'first-route', updated_at: '2026-04-10T11:22:33.000Z' },
      { slug: 'first-route', updated_at: '2026-04-11T11:22:33.000Z' },
      { id: 42, created_at: '2026-04-09T09:00:00.000Z' },
      { id: null },
    ]);

    expect(entries).toEqual([
      {
        loc: 'https://metravel.by/travels/first-route',
        lastmod: '2026-04-10T11:22:33.000Z',
      },
      {
        loc: 'https://metravel.by/travels/42',
        lastmod: '2026-04-09T09:00:00.000Z',
      },
    ]);
  });

  it('builds valid sitemap XML with escaped entities', () => {
    const xml = buildSitemapXml([
      { loc: 'https://metravel.by/' },
      { loc: 'https://metravel.by/travels/minsk?x=1&y=2', lastmod: '2026-04-10T11:22:33.000Z' },
    ]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://metravel.by/</loc>');
    expect(xml).toContain('<loc>https://metravel.by/travels/minsk?x=1&amp;y=2</loc>');
    expect(xml).toContain('<lastmod>2026-04-10T11:22:33.000Z</lastmod>');
  });

  it('escapes xml-special characters and parses ISO dates safely', () => {
    expect(escapeXml(`Tom & "Jerry" <Trip>`)).toBe('Tom &amp; &quot;Jerry&quot; &lt;Trip&gt;');
    expect(toIsoDate('invalid-date')).toBeNull();
    expect(toIsoDate('2026-04-10')).toBe('2026-04-10T00:00:00.000Z');
  });

  it('writes sitemap.xml to the requested dist directory', () => {
    const tempDir = makeTempDir('metravel-sitemap-');

    try {
      const target = writeSitemap(tempDir, buildSitemapXml(buildStaticEntries()));
      expect(target).toBe(path.join(tempDir, 'sitemap.xml'));
      expect(fs.readFileSync(target, 'utf8')).toContain('<loc>https://metravel.by/search</loc>');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
