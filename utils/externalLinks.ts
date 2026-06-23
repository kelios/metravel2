import { Linking, Platform } from 'react-native';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';

type OpenExternalUrlOptions = {
  allowRelative?: boolean;
  allowProtocolRelative?: boolean;
  baseUrl?: string;
  allowedProtocols?: string[];
  onError?: (error: unknown) => void;
};

type OpenExternalUrlInNewTabOptions = OpenExternalUrlOptions & {
  windowFeatures?: string;
};

type OpenWebWindowOptions = {
  target?: string;
  windowFeatures?: string;
  onError?: (error: unknown) => void;
};

// Картографические deep-link схемы, которые на native открывают установленное
// приложение карт/навигатора с маркером/маршрутом (см. mapLinks.ts). На web эти
// схемы бессмысленны и остаются заблокированными — там разрешён только http/https.
const NATIVE_MAP_PROTOCOLS = ['geo:', 'waze:', 'yandexnavi:', 'yandexmaps:', 'comgooglemaps:', 'om:'];

// На устройствах с Яндекс.Картами, но без Навигатора, схему `yandexnavi:` никто
// не регистрирует → `Linking.openURL` отклоняется (ActivityNotFoundException,
// result code=-91). На Android 11+ `canOpenURL` ненадёжен без декларации
// `<queries>` (возвращает false даже для установленного приложения), поэтому
// вместо проверки делаем attempt-then-fallback: пробуем открыть Навигатор, а при
// отказе перестраиваем ссылку в `yandexmaps://...rtext=...` (Яндекс.Карты тоже
// строят маршрут). На web сюда не попадаем: web-билдер отдаёт HTTPS-URL.
const yandexMapsFallbackFromNaviUrl = (naviUrl: string): string | null => {
  const match = naviUrl.match(/lat_to=([^&]+)&lon_to=([^&]+)/);
  if (!match) return null;
  return `yandexmaps://maps.yandex.ru/?rtext=~${match[1]},${match[2]}&rtt=auto`;
};

const openWithYandexFallback = async (
  normalized: string,
  onError?: (error: unknown) => void,
): Promise<boolean> => {
  const isNativeYandexNavi = Platform.OS !== 'web' && normalized.startsWith('yandexnavi:');
  try {
    await Linking.openURL(normalized);
    return true;
  } catch (error) {
    const fallback = isNativeYandexNavi ? yandexMapsFallbackFromNaviUrl(normalized) : null;
    if (!fallback) {
      onError?.(error);
      return false;
    }
    try {
      await Linking.openURL(fallback);
      return true;
    } catch (fallbackError) {
      onError?.(fallbackError);
      return false;
    }
  }
};

const resolveNormalizedUrl = (rawUrl: string, options: OpenExternalUrlOptions): string => {
  const allowedProtocols =
    options.allowedProtocols ??
    (Platform.OS !== 'web' ? ['http:', 'https:', ...NATIVE_MAP_PROTOCOLS] : undefined);
  return getSafeExternalUrl(rawUrl, {
    allowRelative: options.allowRelative ?? false,
    allowProtocolRelative: options.allowProtocolRelative ?? false,
    baseUrl: options.baseUrl ?? '',
    allowedProtocols,
  });
};

export function normalizeExternalUrl(rawUrl: string): string {
  return resolveNormalizedUrl(rawUrl, {
    allowRelative: false,
    allowProtocolRelative: false,
  });
}

export async function openExternalUrl(rawUrl: string, options: OpenExternalUrlOptions = {}): Promise<boolean> {
  const normalized = resolveNormalizedUrl(rawUrl, options);
  if (!normalized) return false;
  return openWithYandexFallback(normalized, options.onError);
}

export async function openExternalUrlInNewTab(
  rawUrl: string,
  options: OpenExternalUrlInNewTabOptions = {},
): Promise<boolean> {
  const normalized = resolveNormalizedUrl(rawUrl, options);
  if (!normalized) return false;

  if (Platform.OS === 'web') {
    const openedWindow = openWebWindow(normalized, {
      target: '_blank',
      // Keep noopener by default for security, but preserve the referrer
      // unless a caller explicitly asks for noreferrer.
      windowFeatures: options.windowFeatures ?? 'noopener',
      onError: options.onError,
    });
    return Boolean(openedWindow);
  }

  return openWithYandexFallback(normalized, options.onError);
}

export function openWebWindow(rawUrl: string, options: OpenWebWindowOptions = {}): Window | null {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return null;
  try {
    const openedWindow = window.open(rawUrl, options.target ?? '_blank', options.windowFeatures ?? 'noopener');
    if (!openedWindow) return null;
    try {
      openedWindow.opener = null;
    } catch {
      // noop
    }
    return openedWindow;
  } catch (error) {
    options.onError?.(error);
    return null;
  }
}
