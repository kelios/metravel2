export function openBookPreviewWindow(html: string): void {
  if (typeof window === 'undefined') return;

  // Используем Blob URL вместо document.write(), чтобы изолировать PDF-превью
  // от service worker и manifest родительского окна (предотвращает ошибки icon.svg)
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');

    // Освобождаем Blob URL после открытия (с задержкой, чтобы браузер успел загрузить)
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);

    if (!win) return;
    try {
      win.opener = null;
    } catch {
      // ignore
    }
  } catch {
    // Fallback: document.write для старых браузеров
    const win = window.open('about:blank', '_blank');
    if (!win) return;
    try {
      win.opener = null;
    } catch {
      // ignore
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      // ignore
    }
  }
}
