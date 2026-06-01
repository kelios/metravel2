import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

export const instagramStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => `
/* ===== CLEARFIX ===== */
.${cls}::after {
  content: "";
  display: block;
  clear: both;
}
/* Instagram wrapper - обёртка для всех Instagram embed'ов */
.${cls} .instagram-wrapper,
.${cls} .instagram-media {
  width: min(100%, 430px) !important;
  max-width: 430px !important;
  min-width: 0 !important;
  margin: ${DESIGN_TOKENS.spacing.md}px auto ${DESIGN_TOKENS.spacing.lg}px !important;
  border-radius: 22px !important;
  overflow: hidden !important;
  position: relative;
  display: block;
  border: 1px solid ${colors.borderLight};
  background: ${colors.surfaceMuted};
  box-shadow: ${colors.boxShadows?.light || 'none'};
}

/* Instagram iframe - занимает всю ширину, пропорциональная высота */
.${cls} .instagram-wrapper iframe,
.${cls} .instagram-embed,
.${cls} .instagram-media iframe,
.${cls} iframe.ql-video[src*="instagram.com"],
.${cls} iframe[src*="instagram.com"] {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  aspect-ratio: 4 / 5 !important;
  border: none !important;
  border-radius: 18px !important;
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

/* Скрытие лишних элементов внутри Instagram embed через CSS */
/* Примечание: из-за CORS мы не можем напрямую изменять содержимое iframe,
   но можем использовать CSS для скрытия элементов, которые рендерятся поверх iframe */
.${cls} .instagram-wrapper::before,
.${cls} .instagram-wrapper::after {
  display: none !important;
}

/* Попытка скрыть элементы, которые могут рендериться поверх iframe */
/* Эти стили применяются к элементам, которые Instagram может добавить в DOM */
.${cls} .instagram-wrapper + *,
.${cls} .instagram-wrapper ~ * {
  /* Скрываем элементы после wrapper, которые могут быть добавлены Instagram скриптом */
}

/* Убираем лишние отступы и границы */
.${cls} .instagram-wrapper {
  background: ${colors.surface} !important;
  padding: 0 !important;
}
`
