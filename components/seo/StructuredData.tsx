import React, { useMemo } from 'react';
import Head from 'expo-router/head';
import { stripHtml } from '@/utils/travelDetailsSecure';
import { getSiteBaseUrl } from '@/utils/seo';
import type { Travel } from '@/types/types';

/* ─────────────────────────────────────────────────────────
 * Structured data (JSON-LD) components for SEO Rich Results.
 *
 * Supported schemas:
 *   - TouristTrip (for travel route pages)
 *   - Article (for blog/article pages)
 *   - Place (for locations referenced in travels)
 * ────────────────────────────────────────────────────────── */

const BASE = getSiteBaseUrl(); // "https://metravel.by"

/* ──── helpers ──── */

function safeText(raw?: string | null, maxLen = 200): string | null {
  if (!raw) return null;
  const clean = stripHtml(raw).trim();
  return clean.length > 0 ? clean.slice(0, maxLen) : null;
}

function safeImageUrl(gallery?: Travel['gallery']): string | null {
  if (!Array.isArray(gallery) || gallery.length === 0) return null;
  const first = gallery[0];
  const url = typeof first === 'string' ? first : first?.url;
  if (!url) return null;
  try {
    new URL(url.startsWith('http') ? url : `${BASE}${url}`);
    return url.startsWith('http') ? url.replace(/^http:\/\//, 'https://') : `${BASE}${url}`;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────
 * TravelStructuredData — TouristTrip schema
 * Used on /travels/[slug] pages
 * ──────────────────────────────────────────────── */

type TravelStructuredDataProps = {
  travel: Travel | null | undefined;
  /** Override canonical URL if needed */
  url?: string;
};

export function TravelStructuredData({ travel, url }: TravelStructuredDataProps) {
  const jsonLd = useMemo(() => {
    if (!travel) return null;

    const name = safeText(travel.name, 200);
    if (!name) return null;

    const description = safeText(travel.description, 500);
    const image = safeImageUrl(travel.gallery);

    const travelUrl =
      url ??
      (travel.slug && /^[a-z0-9-]+$/.test(travel.slug)
        ? `${BASE}/travels/${travel.slug}`
        : `${BASE}/travels/${travel.id}`);

    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name,
      ...(description && { description }),
      ...(image && { image: [image] }),
      url: travelUrl,
      touristType: 'Путешественники',
      inLanguage: 'ru',
    };

    // Author
    const authorName = travel.user?.name || travel.user?.first_name;
    if (authorName) {
      data.provider = {
        '@type': 'Person',
        name: stripHtml(authorName).slice(0, 100),
      };
    }

    // Location / itinerary from travelAddress
    if (Array.isArray(travel.travelAddress) && travel.travelAddress.length > 0) {
      const places = travel.travelAddress
        .map((addr) => {
          const addrName = typeof addr === 'string' ? addr : addr?.name;
          if (!addrName) return null;
          const place: Record<string, unknown> = {
            '@type': 'Place',
            name: stripHtml(addrName).slice(0, 200),
          };
          if (typeof addr === 'object' && addr.lat && addr.lng) {
            place.geo = {
              '@type': 'GeoCoordinates',
              latitude: addr.lat,
              longitude: addr.lng,
            };
          }
          return place;
        })
        .filter(Boolean);

      if (places.length > 0) {
        data.itinerary = {
          '@type': 'ItemList',
          itemListElement: places.map((place, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: place,
          })),
        };
      }
    }

    // Duration
    if (travel.number_days && travel.number_days > 0) {
      data.duration = `P${travel.number_days}D`;
    }

    // Country
    if (travel.countryName) {
      data.touristDestination = {
        '@type': 'Place',
        name: stripHtml(travel.countryName).slice(0, 100),
      };
    }

    // Dates
    if (travel.created_at) {
      const dateStr = String(travel.created_at);
      if (!isNaN(Date.parse(dateStr))) {
        data.startDate = dateStr;
      }
    }

    return data;
  }, [travel, url]);

  if (!jsonLd) return null;

  return (
    <Head key="structured-tourist-trip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Head>
  );
}

/* ────────────────────────────────────────────────
 * ArticleStructuredData — Article schema
 * Used on /article/[id] pages
 * ──────────────────────────────────────────────── */

type ArticleStructuredDataProps = {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  authorName?: string;
  datePublished?: string;
  dateModified?: string;
};

export function ArticleStructuredData({
  title,
  description,
  url,
  image,
  authorName,
  datePublished,
  dateModified,
}: ArticleStructuredDataProps) {
  const jsonLd = useMemo(() => {
    const cleanTitle = safeText(title, 200);
    if (!cleanTitle) return null;

    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: cleanTitle,
      ...(description && { description: safeText(description, 500) }),
      ...(url && { url }),
      ...(image && { image: [image] }),
      publisher: {
        '@type': 'Organization',
        name: 'MeTravel',
        url: BASE,
      },
      inLanguage: 'ru',
    };

    if (authorName) {
      data.author = {
        '@type': 'Person',
        name: stripHtml(authorName).slice(0, 100),
      };
    }

    if (datePublished && !isNaN(Date.parse(datePublished))) {
      data.datePublished = datePublished;
    }
    if (dateModified && !isNaN(Date.parse(dateModified))) {
      data.dateModified = dateModified;
    }

    return data;
  }, [title, description, url, image, authorName, datePublished, dateModified]);

  if (!jsonLd) return null;

  return (
    <Head key="structured-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Head>
  );
}

/* ────────────────────────────────────────────────
 * PlaceStructuredData — Place schema
 * Can be used standalone or embedded
 * ──────────────────────────────────────────────── */

type PlaceStructuredDataProps = {
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  url?: string;
  image?: string;
};

export function PlaceStructuredData({
  name,
  description,
  lat,
  lng,
  url,
  image,
}: PlaceStructuredDataProps) {
  const jsonLd = useMemo(() => {
    const cleanName = safeText(name, 200);
    if (!cleanName) return null;

    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: cleanName,
      ...(description && { description: safeText(description, 500) }),
      ...(url && { url }),
      ...(image && { image }),
    };

    if (lat != null && lng != null && isFinite(lat) && isFinite(lng)) {
      data.geo = {
        '@type': 'GeoCoordinates',
        latitude: lat,
        longitude: lng,
      };
    }

    return data;
  }, [name, description, lat, lng, url, image]);

  if (!jsonLd) return null;

  return (
    <Head key="structured-place">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Head>
  );
}
