import { openWebWindow } from '@/utils/externalLinks';

let pendingPreviewWindow: Window | null = null;
const GLOBAL_PREVIEW_WINDOW_KEY = '__metravelBookPreviewWindow';

function getGlobalPreviewWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  return ((window as typeof window & { [GLOBAL_PREVIEW_WINDOW_KEY]?: Window | null })[
    GLOBAL_PREVIEW_WINDOW_KEY
  ] ?? null);
}

function setGlobalPreviewWindow(nextWindow: Window | null): void {
  if (typeof window === 'undefined') return;
  (window as typeof window & { [GLOBAL_PREVIEW_WINDOW_KEY]?: Window | null })[
    GLOBAL_PREVIEW_WINDOW_KEY
  ] = nextWindow;
}

function tryFinalizeWindow(win: Window | null): Window | null {
  if (!win) return null;
  try {
    win.opener = null;
  } catch {
    // ignore
  }
  return win;
}

function writeHtmlToWindow(win: Window, html: string): boolean {
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  } catch {
    return false;
  }
}

export function openPendingBookPreviewWindow(): Window | null {
  if (typeof window === 'undefined') return null;

  const win = tryFinalizeWindow(openWebWindow('about:blank'));
  if (!win) return null;
  pendingPreviewWindow = win;
  setGlobalPreviewWindow(win);

  const loadingHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Готовим печатную версию…</title>
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: var(--color-text);
    background: var(--color-backgroundSecondary);
  }
  .card {
    border: 1px solid var(--color-borderLight);
    border-radius: 12px;
    padding: 18px 20px;
    background: var(--color-surface);
    box-shadow: 0 8px 18px rgba(20, 45, 70, 0.08);
    font-size: 15px;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="card">Готовим печатную версию карты…</div>
</body>
</html>`;

  writeHtmlToWindow(win, loadingHtml);
  return win;
}

export function openBookPreviewWindow(html: string, targetWindow?: Window | null): void {
  if (typeof window === 'undefined') return;

  const resolvedTargetWindow = targetWindow ?? pendingPreviewWindow ?? getGlobalPreviewWindow();

  // Если есть предоткрытое окно — пишем HTML прямо в него, не уводя браузер на blob:/about:blank.
  if (resolvedTargetWindow) {
    const written = writeHtmlToWindow(resolvedTargetWindow, html);
    if (written) {
      pendingPreviewWindow = null;
      setGlobalPreviewWindow(null);
      return;
    }

    try {
      resolvedTargetWindow.location.replace('about:blank');
    } catch {
      // ignore
    }

    setTimeout(() => {
      try {
        if (writeHtmlToWindow(resolvedTargetWindow, html)) {
          pendingPreviewWindow = null;
          setGlobalPreviewWindow(null);
        }
      } catch {
        // keep the original window; do not open a duplicate tab on retry failure
      }
    }, 50);
    return;
  }

  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = tryFinalizeWindow(openWebWindow(url));
    if (!win) return;

    pendingPreviewWindow = null;
    setGlobalPreviewWindow(null);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 300_000);
    return;
  } catch {
    const win = tryFinalizeWindow(openWebWindow('about:blank'));
    if (!win) return;

    pendingPreviewWindow = null;
    setGlobalPreviewWindow(null);
    writeHtmlToWindow(win, html);
  }
}
