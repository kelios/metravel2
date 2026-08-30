import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Head from 'expo-router/head';
import {
  normalizeOgImageUrl,
  removeOwnedWebSeoMetadata,
  syncWebSeoMetadata,
} from '@/utils/seo';
import { getActiveLocaleDefinition } from '@/i18n/format';

type Props = {
  headKey?: string | null;
  title: string;
  description?: string;
  syncHydratedMetadataForPath?: string;
  canonical?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  ogType?: 'website' | 'article';
  robots?: string;
  additionalTags?: React.ReactNode;
  children?: React.ReactNode;
};

function StaticHead({
  headKey,
  title,
  description,
  syncHydratedMetadataForPath,
  canonical,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  ogType = 'website',
  robots,
  additionalTags,
  children,
}: Props) {
  const normalizedImage = normalizeOgImageUrl(image);
  const locale = getActiveLocaleDefinition();
  const twitterCard = normalizedImage ? 'summary_large_image' : 'summary';

  useEffect(() => {
    if (!syncHydratedMetadataForPath || typeof document === 'undefined' || !title) return;

    const normalizePath = (value: string) => {
      const raw = String(value || '/').split(/[?#]/, 1)[0].trim();
      const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
      const normalized = withLeadingSlash.length > 1
        ? withLeadingSlash.replace(/\/+$/, '')
        : withLeadingSlash;
      return normalized === '/index' ? '/' : normalized;
    };
    const expectedPath = normalizePath(syncHydratedMetadataForPath);
    const isExpectedPathActive = () =>
      typeof window !== 'undefined' && normalizePath(window.location.pathname) === expectedPath;
    let ownedMetadataNodes: ReadonlySet<Element> = new Set();

    const syncMetadata = () => {
      if (isExpectedPathActive()) {
        ownedMetadataNodes = syncWebSeoMetadata({ title, description });
        return;
      }
      removeOwnedWebSeoMetadata({ title, description }, ownedMetadataNodes);
    };

    syncMetadata();

    // While home is active, keep the latest Expo-managed tag authoritative.
    // After the path changes, the same observer removes only values still owned
    // by home and leaves every destination tag untouched.
    const observer = new MutationObserver(syncMetadata);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['content'],
    });
    const timeout = window.setTimeout(() => observer.disconnect(), 5000);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      if (!isExpectedPathActive()) {
        removeOwnedWebSeoMetadata({ title, description }, ownedMetadataNodes);
      }
    };
  }, [description, syncHydratedMetadataForPath, title]);

  useEffect(() => {
    if (typeof document === 'undefined' || !robots) return;
    const upsertMeta = (name: string, content: string) => {
      const nodes = Array.from(document.querySelectorAll(`meta[name="${name}"]`)) as HTMLMetaElement[];
      nodes.slice(1).forEach((node) => node.parentNode?.removeChild(node));
      let el = nodes[0] ?? null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    const syncRobots = () => upsertMeta('robots', robots);
    syncRobots();

    const observer = new MutationObserver(syncRobots);
    observer.observe(document.head, { childList: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 5000);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [robots]);

  useEffect(() => {
    if (typeof document === 'undefined' || !canonical) return;

    const syncCanonical = () => {
      const canonicalLinks = Array.from(document.querySelectorAll('link[rel="canonical"]')) as HTMLLinkElement[];
      const canonicalLink = canonicalLinks[0] ?? document.createElement('link');
      if (canonicalLink.getAttribute('rel') !== 'canonical') {
        canonicalLink.setAttribute('rel', 'canonical');
      }
      if (canonicalLink.getAttribute('href') !== canonical) {
        canonicalLink.setAttribute('href', canonical);
      }

      if (!canonicalLink.parentNode) {
        document.head.appendChild(canonicalLink);
      }

      canonicalLinks.slice(1).forEach((link) => link.parentNode?.removeChild(link));

      let ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      if (ogUrl.getAttribute('content') !== canonical) {
        ogUrl.setAttribute('content', canonical);
      }
    };

    syncCanonical();

    // Expo Head can reconcile its static route tags after client navigation.
    // Keep the focused screen authoritative during that short transition.
    const observer = new MutationObserver(syncCanonical);
    observer.observe(document.head, {
      childList: true,
      attributes: true,
      attributeFilter: ['href', 'content'],
    });
    const timeout = window.setTimeout(() => observer.disconnect(), 5000);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [canonical]);

  return (
    <Head key={headKey ?? 'instant-seo'}>
      <title key="title">{title}</title>
      {description && <meta key="description" name="description" content={description} />}
      {robots && <meta key="robots" name="robots" content={robots} />}
      {canonical && <link key="canonical" rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta key="og:type" property="og:type" content={ogType} />
      <meta key="og:title" property="og:title" content={title} />
      {description && <meta key="og:description" property="og:description" content={description} />}
      {canonical && <meta key="og:url" property="og:url" content={canonical} />}
      {normalizedImage && <meta key="og:image" property="og:image" content={normalizedImage} />}
      {normalizedImage && <meta key="og:image:secure_url" property="og:image:secure_url" content={normalizedImage} />}
      {normalizedImage && imageWidth && <meta key="og:image:width" property="og:image:width" content={String(imageWidth)} />}
      {normalizedImage && imageHeight && <meta key="og:image:height" property="og:image:height" content={String(imageHeight)} />}
      {normalizedImage && imageAlt && <meta key="og:image:alt" property="og:image:alt" content={imageAlt} />}
      <meta key="og:site_name" property="og:site_name" content="MeTravel" />
      <meta key="og:locale" property="og:locale" content={locale.ogLocale} />

      {/* Twitter */}
      <meta key="twitter:card" name="twitter:card" content={twitterCard} />
      <meta key="twitter:title" name="twitter:title" content={title} />
      {description && <meta key="twitter:description" name="twitter:description" content={description} />}
      {normalizedImage && <meta key="twitter:image" name="twitter:image" content={normalizedImage} />}
      {normalizedImage && imageAlt && <meta key="twitter:image:alt" name="twitter:image:alt" content={imageAlt} />}
      {additionalTags}
      {children}
    </Head>
  );
}

export default function LazyInstantSEO(props: Props) {
  const isWeb = Platform.OS === 'web';

  if (!isWeb) return null;

  return <StaticHead {...props} />;
}
