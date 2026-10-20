import type { AppStorePlatform } from '../constants/appStore';

export function getMobileAppUrl(siteUrl: string): string;
export function getMobileAppOpenUrl(platform: AppStorePlatform, siteUrl: string): string;
export function getSmartAppBannerContent(siteUrl?: string): string;
