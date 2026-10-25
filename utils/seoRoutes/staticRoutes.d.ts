export type StaticRouteSeoEntry = {
  route: string;
  canonicalRoute?: string;
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  robots?: string;
  imagePath?: string;
  imageWidth?: number;
  imageHeight?: number;
  breadcrumb?: string;
  breadcrumbKey?: string;
  h1?: string;
};

export type ResolvedStaticRouteSeo = {
  route: string;
  canonicalRoute: string;
  title: string;
  description: string;
  robots?: string;
  imagePath: string;
  imageWidth?: number;
  imageHeight?: number;
  breadcrumb?: string;
  h1?: string;
};

export type RouteTranslator = (key: string) => string;

export const DEFAULT_OG_IMAGE_PATH: string;
export const HOME_OG_IMAGE_PATH: string;
export const MAP_OG_IMAGE_PATH: string;
export const SOCIAL_IMAGE_WIDTH: number;
export const SOCIAL_IMAGE_HEIGHT: number;
export const STATIC_ROUTE_SEO: readonly StaticRouteSeoEntry[];
export function resolveStaticRouteSeo(route: string, t: RouteTranslator): ResolvedStaticRouteSeo | null;
export function listStaticRouteSeo(t: RouteTranslator): ResolvedStaticRouteSeo[];
export function listStaticRoutes(): string[];
