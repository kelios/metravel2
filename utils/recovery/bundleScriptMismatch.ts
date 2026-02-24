const CORE_BUNDLE_SCRIPT_RE =
  /\/(_expo\/static\/js\/web\/(?:__expo-metro-runtime-|__common-|entry-|_layout-|index-)[^"'\s>]+\.js)/i;

function normalizeBundleScriptSrc(src: string, origin: string): string {
  if (!src) return '';
  try {
    const url = new URL(src, origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}

function extractCoreBundleScriptsFromDocument(doc: Document, origin: string): string[] {
  const scripts = Array.from(doc.querySelectorAll('script[src]'))
    .map((el) => normalizeBundleScriptSrc(el.getAttribute('src') || '', origin))
    .filter((src) => CORE_BUNDLE_SCRIPT_RE.test(src));
  return Array.from(new Set(scripts)).sort();
}

function extractCoreBundleScriptsFromHtml(html: string, origin: string): string[] {
  const scripts: string[] = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(html)) != null) {
    const src = normalizeBundleScriptSrc(match[1] || '', origin);
    if (src && CORE_BUNDLE_SCRIPT_RE.test(src)) {
      scripts.push(src);
    }
  }

  return Array.from(new Set(scripts)).sort();
}

export async function hasFreshHtmlBundleMismatch(currentUrl?: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof fetch === 'undefined') {
    return false;
  }

  const href = currentUrl || window.location.href;
  const origin = window.location.origin;
  const currentScripts = extractCoreBundleScriptsFromDocument(document, origin);
  if (currentScripts.length === 0) return false;

  const response = await fetch(href, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'text/html' },
  });

  if (!response.ok) return false;

  const freshHtml = await response.text();
  const freshScripts = extractCoreBundleScriptsFromHtml(freshHtml, origin);
  if (freshScripts.length === 0) return false;

  if (currentScripts.length !== freshScripts.length) return true;

  const currentSet = new Set(currentScripts);
  for (const src of freshScripts) {
    if (!currentSet.has(src)) return true;
  }

  return false;
}
