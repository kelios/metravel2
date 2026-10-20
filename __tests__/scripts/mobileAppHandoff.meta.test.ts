/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { getSmartAppBannerContent } from '@/utils/mobileAppHandoff';

const { injectMeta, escapeAttr } = require('@/scripts/generate-seo-pages');

describe('exported Safari Smart App Banner', () => {
  const metadata = {
    title: 'MeTravel',
    description: 'Travel',
    canonical: 'https://metravel.by/travels/walk?source=share&name=%22quoted%22#photos',
    image: '',
  };

  it('includes the default iOS banner in the Expo document shell', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/+html.tsx'), 'utf8');
    const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
    expect(head).toContain('<meta name="apple-itunes-app" content={getSmartAppBannerContent()} />');
  });

  it('replaces every existing banner with one escaped route-specific tag', () => {
    const shell = '<html><head><title>App</title><meta name="apple-itunes-app" content="old"/><meta content="older" name=\'apple-itunes-app\'></head><body></body></html>';
    const html = injectMeta(shell, metadata);
    expect(html.match(/name=["']apple-itunes-app["']/g)).toHaveLength(1);
    expect(html).toContain(`<meta name="apple-itunes-app" content="${escapeAttr(getSmartAppBannerContent(metadata.canonical))}"/>`);
    expect(html).toContain('app-argument=metravel://travels/walk?source=share&amp;name=%22quoted%22');
    expect(html.match(/<meta name="apple-itunes-app"[^>]*>/)?.[0]).not.toContain('#photos');
    expect(injectMeta(html, metadata).match(/name=["']apple-itunes-app["']/g)).toHaveLength(1);
  });

  it('does not turn page text into HTML or replacement tokens in the banner', () => {
    const canonical = 'https://metravel.by/travels/$&?title=%22%3E%3Cscript%3E&x=$&';
    const html = injectMeta('<head><title>App</title></head>', { ...metadata, canonical });
    expect(html).toContain(`<meta name="apple-itunes-app" content="${escapeAttr(getSmartAppBannerContent(canonical))}"/>`);
    expect(html).not.toContain('<script>');
    expect(html.match(/name="apple-itunes-app"/g)).toHaveLength(1);
  });

  it('falls back safely when an SSG route has no native destination', () => {
    const html = injectMeta('<head><title>App</title></head>', { ...metadata, canonical: 'https://metravel.by/app' });
    expect(html).toContain('app-argument=metravel://map');
  });
});
