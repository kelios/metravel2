export type AndroidAppLinkPath =
  | { readonly path: string; readonly pathPrefix?: undefined }
  | { readonly pathPrefix: string; readonly path?: undefined };

export type IncomingAppLinkDecision =
  | { readonly kind: 'route'; readonly href: string }
  | { readonly kind: 'external'; readonly url: string }
  | { readonly kind: 'ignore' };

export const ANDROID_APP_LINK_PATHS: readonly AndroidAppLinkPath[];
export function isAndroidAppLinkPath(pathname: string): boolean;
export function classifyIncomingAppLink(url: unknown): IncomingAppLinkDecision;
export function mapIncomingAppLinkToHref(url: unknown): string | null;
export function mapNotificationPayloadToHref(payload: Record<string, unknown>): string | null;
