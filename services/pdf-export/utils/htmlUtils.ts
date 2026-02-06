/**
 * HTML-утилиты для PDF-генераторов.
 * Единая реализация вместо дублирования в каждом генераторе.
 */

export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Строит безопасный URL изображения с проксированием через weserv.nl.
 * Обрабатывает: data:, blob:, относительные пути, localhost, приватные IP.
 */
export function buildSafeImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:')) return trimmed;
  if (isLocalResource(trimmed)) return trimmed;
  if (/^https?:\/\/images\.weserv\.nl\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return buildSafeImageUrl(`https:${trimmed}`);

  // Относительные пути
  if (trimmed.startsWith('/')) {
    if (typeof window !== 'undefined' && (window as any).location?.origin) {
      return `${(window as any).location.origin}${trimmed}`;
    }
    return `https://metravel.by${trimmed}`;
  }

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes('://')) {
    return buildSafeImageUrl(`https://metravel.by/${trimmed.replace(/^\/+/, '')}`);
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isPrivateV4 =
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

    if (isLocalhost || isPrivateV4) {
      parsed.protocol = 'https:';
      parsed.host = 'metravel.by';
      return buildSafeImageUrl(parsed.toString());
    }
  } catch {
    // ignore URL parse errors
  }

  try {
    const normalized = trimmed.replace(/^https?:\/\//i, '');
    const delimiter = encodeURIComponent(normalized);
    // Разрешение 2400px для печати 300 DPI; q=90, il — прогрессивная загрузка
    return `https://images.weserv.nl/?url=${delimiter}&w=2400&q=90&il&fit=inside`;
  } catch {
    return trimmed;
  }
}

function isLocalResource(url: string): boolean {
  return url.toLowerCase().startsWith('blob:');
}
