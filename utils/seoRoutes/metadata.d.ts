export type RouteSeoInput = {
  title: string;
  description?: string | null;
  canonical?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  ogType?: 'website' | 'article' | null;
  robots?: string | null;
  ogLocale?: string | null;
  alternates?: Record<string, string> | null;
};

export type RouteMetadataImage = { url: string; secureUrl: string; width?: number; height?: number; alt?: string };

/** Подмножество `Metadata` expo-server, которое проект заполняет. */
export type RouteMetadata = {
  title: string;
  description?: string;
  robots?: string;
  alternates?: { canonical?: string; languages?: Record<string, string> };
  openGraph: {
    type: string;
    title: string;
    siteName: string;
    description?: string;
    url?: string;
    images?: RouteMetadataImage[];
    locale?: string;
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description?: string;
    images?: Array<string | { url: string; alt: string }>;
  };
};

export const SITE_NAME: string;
export function buildRouteMetadata(seo: RouteSeoInput): RouteMetadata;
