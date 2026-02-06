export function openBookPreviewWindow(html: string): void {
  if (typeof window === 'undefined') return;

  // Открываем about:blank в той же origin, без noopener/noreferrer, чтобы иметь доступ к document
  const win = window.open('about:blank', '_blank');
  if (!win) {
    return;
  }
  try {
    win.opener = null;
  } catch {
    // ignore
  }

  // Небольшая задержка, чтобы браузер успел инициализировать документ вкладки
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    // fallback: пробуем записать ещё раз после небольшого таймаута
    setTimeout(() => {
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch {
        // если и это не удалось, просто оставляем вкладку пустой
      }
    }, 50);
  }
}
