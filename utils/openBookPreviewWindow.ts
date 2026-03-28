import { openWebWindow } from '@/utils/externalLinks';

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

  // Если есть предоткрытое окно — перенаправляем его на Blob URL
  if (targetWindow && !targetWindow.closed) {
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      targetWindow.location.href = url;

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 300_000);
      return;
    } catch {
      // Fallback: document.write в предоткрытое окно
      const written = writeHtmlToWindow(targetWindow, html);
      if (written) return;
    }
  }

  // Нет предоткрытого окна — открываем новое через Blob URL
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = tryFinalizeWindow(openWebWindow(url));

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 300_000);

    if (!win) return;
  } catch {
    // Fallback: document.write для старых браузеров
    const win = tryFinalizeWindow(openWebWindow('about:blank'));
    if (!win) return;
    writeHtmlToWindow(win, html);
  }
}
