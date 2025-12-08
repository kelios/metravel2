// ✅ B4.1: CSS анимация для web shimmer эффекта
// Этот файл автоматически загружается только на web платформе

if (typeof document !== 'undefined') {
  const styleId = 'shimmer-animation-style';
  
  // Проверяем, не добавлена ли уже анимация
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export {};
