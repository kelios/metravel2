import { openSiteUrlInSystemBrowser } from '@/utils/externalLinks';
import { classifyIncomingAppLink } from '@/utils/incomingAppLinks';

// Холодный старт идёт через `app/+native-intent.ts`, тёплый на Android — через
// `hooks/useIncomingAppLinks.native.ts` (#1047); одна и та же ссылка может
// дойти обоими путями, поэтому открытие браузера склеивается в окне.
const DUPLICATE_EXTERNAL_WINDOW_MS = 1_000;
let lastExternalOpen: { url: string; at: number } | null = null;

/**
 * #3104: безопасная https-ссылка на сайт без экрана в приложении открывается во
 * внешнем браузере, а не теряется на главной. Возвращает, был ли запущен показ.
 */
export function openUnsupportedSiteLink(url: string): boolean {
  const now = Date.now();
  if (
    lastExternalOpen?.url === url &&
    now - lastExternalOpen.at <= DUPLICATE_EXTERNAL_WINDOW_MS
  ) {
    return false;
  }
  lastExternalOpen = { url, at: now };
  void openSiteUrlInSystemBrowser(url);
  return true;
}

/**
 * Единое решение для обоих входов ОС-ссылки: маршрут приложения → href,
 * неподдерживаемая ссылка на сайт → внешний браузер и null, всё остальное → null.
 */
export function resolveIncomingAppLink(url: unknown): string | null {
  const decision = classifyIncomingAppLink(url);
  if (decision.kind === 'route') return decision.href;
  if (decision.kind === 'external') openUnsupportedSiteLink(decision.url);
  return null;
}
