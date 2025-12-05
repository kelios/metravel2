import React, { memo } from 'react';
import { Platform } from 'react-native';
import Head from 'expo-router/head';

export interface TravelStructuredDataProps {
  name: string;
  description: string;
  image?: string;
  url: string;
  author?: {
    name: string;
    url?: string;
  };
  datePublished?: string;
  dateModified?: string;
  duration?: string;
  distance?: string;
  location?: {
    name: string;
    latitude?: number;
    longitude?: number;
  };
}

/**
 * Компонент для добавления structured data (JSON-LD) для SEO
 * 
 * Поддерживаемые схемы:
 * - TouristTrip (основная схема для маршрутов)
 * - Place (для локаций)
 * - Person (для авторов)
 * 
 * @example
 * <TravelStructuredData
 *   name="Маршрут по Минску"
 *   description="Однодневный маршрут..."
 *   url="https://metravel.by/travel/123"
 *   author={{ name: "Иван Иванов" }}
 * />
 */
export function TravelStructuredData({
  name,
  description,
  image,
  url,
  author,
  datePublished,
  dateModified,
  duration,
  distance,
  location,
}: TravelStructuredDataProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name,
    description,
    ...(image && { image }),
    url,
    ...(author && {
      author: {
        '@type': 'Person',
        name: author.name,
        ...(author.url && { url: author.url }),
      },
    }),
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    ...(duration && { duration }),
    ...(distance && { distance: `${distance} km` }),
    ...(location && {
      touristType: 'Sightseeing',
      itinerary: {
        '@type': 'Place',
        name: location.name,
        ...(location.latitude &&
          location.longitude && {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: location.latitude,
              longitude: location.longitude,
            },
          }),
      },
    }),
  };

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    </Head>
  );
}

export interface ArticleStructuredDataProps {
  headline: string;
  description: string;
  image?: string;
  url: string;
  author?: {
    name: string;
    url?: string;
  };
  datePublished?: string;
  dateModified?: string;
}

/**
 * Structured data для статей
 */
export function ArticleStructuredData({
  headline,
  description,
  image,
  url,
  author,
  datePublished,
  dateModified,
}: ArticleStructuredDataProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    ...(image && { image }),
    url,
    ...(author && {
      author: {
        '@type': 'Person',
        name: author.name,
        ...(author.url && { url: author.url }),
      },
    }),
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    publisher: {
      '@type': 'Organization',
      name: 'MeTravel',
      url: 'https://metravel.by',
      logo: {
        '@type': 'ImageObject',
        url: 'https://metravel.by/logo.png',
      },
    },
  };

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    </Head>
  );
}

export interface BreadcrumbStructuredDataProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

/**
 * Structured data для хлебных крошек
 */
export function BreadcrumbStructuredData({ items }: BreadcrumbStructuredDataProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    </Head>
  );
}

export default memo(TravelStructuredData);
