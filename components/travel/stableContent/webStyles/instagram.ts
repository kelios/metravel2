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
  /* Не отрисовывать эмбеды вне вьюпорта: на статьях с десятками
     Instagram-iframe это убирает многосекундный фриз главного потока при скролле */
  content-visibility: auto;
  contain-intrinsic-size: auto 540px;
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

/* Instagram facade — плейсхолдер до ленивого монтирования iframe.
   Совпадает по размеру с эмбедом (4/5, max 430px), чтобы своп не давал CLS. */
.${cls} .ig-lite {
  width: min(100%, 430px);
  max-width: 430px;
  aspect-ratio: 4 / 5;
  margin: ${DESIGN_TOKENS.spacing.md}px auto ${DESIGN_TOKENS.spacing.lg}px;
  border-radius: 22px;
  border: 1px solid ${colors.borderLight};
  background: linear-gradient(180deg, ${colors.surface} 0%, ${colors.surfaceMuted} 100%);
  box-shadow: ${colors.boxShadows?.light || 'none'};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.${cls} .ig-lite.ig-lite--mounted {
  aspect-ratio: auto;
  display: block;
  border: none;
  background: ${colors.surface};
}
.${cls} .ig-lite__inner {
  padding: 18px;
  text-align: center;
}
.${cls} .ig-lite__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.35;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${colors.textMuted};
}
.${cls} .ig-lite__title {
  display: inline-block;
  margin: 0;
  color: ${colors.primaryText || colors.primary || colors.text};
  font-size: 18px;
  line-height: 1.35;
  font-weight: 600;
  text-decoration: none;
}
.${cls} .ig-lite__title:hover,
.${cls} .ig-lite__title:focus-visible {
  text-decoration: underline;
}
.${cls} .ig-lite__hint {
  margin: 10px 0 0;
  color: ${colors.textMuted};
  font-size: 13px;
  line-height: 1.45;
}
`
