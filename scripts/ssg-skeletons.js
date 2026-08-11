#!/usr/bin/env node
/**
 * SSG Skeleton Shells for P3.5 — pre-rendered HTML visible before JS loads.
 *
 * Generates lightweight HTML skeletons for `/` (home) and `/search` pages,
 * injected by generate-seo-pages.js into the static HTML output.
 *
 * Colors from MODERN_MATTE_PALETTE / MODERN_MATTE_PALETTE_DARK (hardcoded
 * to avoid importing TS modules at build time).
 */

// Hardcoded color tokens from modernMattePalette.ts
const COLORS = {
  light: {
    bg: '#fdfcfb',
    bgSecondary: '#f9f8f6',
    surface: '#ffffff',
    text: '#3a3a3a',
    textMuted: '#636363',
    border: '#e8e6e1',
    shimmerFrom: '#f5f4f2',
    shimmerTo: '#e8e6e1',
    // primary / brandText из MODERN_MATTE_PALETTE: реальный hero рисует зелёный
    // CTA и терракотовый акцент заголовка — оранжевый #f5842c в шелле давал
    // цветовой скачок на гидрации.
    primary: '#7a9d8f',
    accent: '#a95000',
  },
  dark: {
    bg: '#1a1a1a',
    bgSecondary: '#202020',
    surface: '#2a2a2a',
    text: '#e8e8e8',
    textMuted: '#b8b8b8',
    border: '#3a3a3a',
    shimmerFrom: '#282828',
    shimmerTo: '#3a3a3a',
    primary: '#8fb5a5',
    accent: '#f0a060',
  },
};

// Страница раскрытой книги всегда светлая, поэтому desktop-акцент не темизируется
// (MODERN_MATTE_PALETTE.bookPageAccent).
const BOOK_PAGE_ACCENT = '#b35900';
// Средний цвет первого слайда hero (BOOK_IMAGES[0].dominantColor в
// components/home/homeHeroContent.ts). Кадр вертикальный, слот горизонтальный:
// React-hero заливает поля letterbox этим цветом + blur, шелл — этим же цветом.
// Без заливки узкая портретная полоса фото висела на белом фоне и выглядела
// сломанной вёрсткой.
const HOME_HERO_FILL = '#687e72';

const MAP_VIEWPORT_HEIGHT = 'var(--metravel-map-vh, 100svh)';
const MAP_WEB_MOBILE_BREAKPOINT_PX = 768;
const MAP_WEB_MOBILE_VIEWPORT_RESERVE_PX = 56;
const MAP_WEB_DESKTOP_VIEWPORT_RESERVE_PX = 88;
const MAP_WEB_DESKTOP_SIDEBAR_WIDTH_PX = 340;

/**
 * Build skeleton CSS (shared by home and search).
 * Uses data-theme="dark" on <html> for theme switching (set by +html.tsx inline script).
 */
function buildSkeletonCSS() {
  return `<style id="ssg-skeleton-css">
#ssg-skeleton{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;position:fixed;inset:0;z-index:99999;overflow-x:hidden;overflow-y:auto;background:${COLORS.light.bg};color:${COLORS.light.text}}
#ssg-skeleton *{box-sizing:border-box}
.ssg-bar{width:100%;height:56px;background:${COLORS.light.surface};border-bottom:1px solid ${COLORS.light.border};display:flex;align-items:center;padding:0 16px}
.ssg-bar-logo{font:700 20px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};letter-spacing:-0.01em}
.ssg-home-shell{width:100%;max-width:1200px;margin:0 auto;padding:8px 16px}
.ssg-home-book{display:flex;flex-direction:column;gap:14px;width:100%}
.ssg-home-page{display:flex;flex-direction:column;align-items:stretch;gap:16px;padding:44px 20px 20px;border-radius:24px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border}}
.ssg-home-chapter{display:none}
.ssg-home-title{margin:0;font:700 32px/40px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:-0.8px;color:${COLORS.light.text};max-width:640px;text-align:left}
.ssg-home-title .ssg-accent{display:block;color:${COLORS.light.accent};font-weight:800}
.ssg-home-sub{margin:0;font:400 16px/24px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.light.textMuted};max-width:520px;text-align:left}
.ssg-home-search-row{display:flex;gap:8px;margin-top:4px;height:48px}
.ssg-home-search{flex:1;min-width:0;height:48px;border-radius:12px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border}}
.ssg-home-search-btn{width:48px;height:48px;flex:0 0 48px;border-radius:12px;background:${COLORS.light.primary}}
.ssg-home-cta{width:100%;height:46px;border-radius:16px;background:${COLORS.light.primary};margin-top:8px}
/* Чипы вне белой карточки, под hairline-разделителем — как HomeHeroMoodRail.
   Якоря геометрии (тест ssg-skeletons): низ карточки 410 + gap 14 + margin 9
   = линия 433; + border 1 + padding 34 = верх чипов 468 — позиция React-грида. */
.ssg-home-moods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:9px;border-top:1px solid ${COLORS.light.border};padding-top:34px}
.ssg-home-mood{height:46px;border-radius:999px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border}}
.ssg-home-notes{display:none}
.ssg-home-week{position:relative;overflow:hidden;border-radius:20px;background:${HOME_HERO_FILL};border:0;margin-top:20px}
/* #1281/#1358: реальная hero-фотография остаётся крупнейшим LCP-кандидатом.
   Mobile-shell имеет 16px бокового inset: на viewport 390px слот 358x239px
   даёт 85 443px2, то есть не меньше замеренного React-кандидата 85 438px2.
   На desktop фотография занимает измеренный слот правой страницы книги. Селектор остаётся
   специфичнее img[data-lcp] из critical CSS, поэтому его aspect-ratio/min-height
   не могут изменить бокс. */
.ssg-home-hero{position:relative;width:100%;aspect-ratio:3/2;margin:0;border-radius:inherit;overflow:hidden;background:${HOME_HERO_FILL}}
.ssg-home-hero img.ssg-home-hero-img{position:absolute;inset:0;width:100%;height:100%;min-width:0;min-height:0;max-width:none;max-height:none;aspect-ratio:auto;object-fit:contain;object-position:center;display:block}
/* Скрим снизу — как slideOverlay React-слайдера: подпись читается на фото,
   а не лежит белой плашкой поверх кадра. */
.ssg-home-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,16,14,0) 34%,rgba(10,16,14,.58) 100%);pointer-events:none}
.ssg-home-week-body{position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:16px}
.ssg-home-week-kicker{width:132px;height:24px;border-radius:12px;background:rgba(16,22,20,.45);border:1px solid rgba(255,255,255,.28)}
.ssg-home-week-title{width:56%;height:26px;border-radius:8px;background:rgba(255,255,255,.85)}
.ssg-home-week-sub{width:74%;height:14px;border-radius:6px;background:rgba(255,255,255,.55)}
.ssg-home-week-action{width:150px;height:34px;border-radius:17px;background:rgba(16,22,20,.45);border:1px solid rgba(255,255,255,.32)}
.ssg-home-popular{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:28px}
.ssg-home-popular-card{border-radius:18px;overflow:hidden;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border};padding-bottom:12px}
.ssg-home-popular-thumb{width:100%;aspect-ratio:164/112}
.ssg-home-popular-line{height:12px;border-radius:6px;margin:10px 12px 0}
.ssg-home-popular-line.w76{width:76%}.ssg-home-popular-line.w55{width:55%}
@media(min-width:768px) and (max-width:1279px){.ssg-home-shell{padding:24px}.ssg-home-book{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px}.ssg-home-page{grid-column:1;grid-row:1;justify-content:center;gap:16px;padding:32px}.ssg-home-week{grid-column:2;grid-row:1;margin-top:0}.ssg-home-moods{grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:0;border-top:0;padding-top:0}.ssg-home-hero{aspect-ratio:auto;height:320px}.ssg-home-popular{display:none}}
@media(min-width:1280px){.ssg-home-shell{max-width:none;padding:20px 40px 24px}.ssg-home-book{display:grid;grid-template-columns:49% 51%;gap:0;width:min(calc(100vw - 80px),calc(135.9477svh - 244.7059px),1200px);height:auto;aspect-ratio:1040/765;margin:0 auto;background-color:${COLORS.light.surface};background-image:var(--image-homeHeroBook,none);background-size:100% 100%;background-repeat:no-repeat;border-radius:36px;overflow:hidden}.ssg-home-page{position:relative;top:21.6%;align-self:start;justify-content:flex-start;gap:12px;padding:0 9% 0 16%;border-radius:0;background:transparent;border:0;overflow:hidden}.ssg-home-chapter{display:flex;align-items:center;gap:10px;margin-bottom:2px}.ssg-home-chapter-label{font:600 11px/1.4 Baskerville,Georgia,'Times New Roman',serif;letter-spacing:.14em;text-transform:uppercase;color:${COLORS.light.textMuted};white-space:nowrap}.ssg-home-chapter-line{flex:1;height:1px;background:${COLORS.light.border}}.ssg-home-title{font-family:Baskerville,Georgia,'Times New Roman',serif;font-size:clamp(24px,1.9vw,32px);line-height:1.24;letter-spacing:-0.2px}.ssg-home-title .ssg-accent{color:${BOOK_PAGE_ACCENT}}.ssg-home-sub{font-size:clamp(12px,.85vw,13px);line-height:1.7}.ssg-home-search-row{height:44px;margin-top:4px}.ssg-home-search{height:44px}.ssg-home-search-btn{width:44px;height:44px;flex:0 0 44px}.ssg-home-cta{width:190px;height:44px;margin-top:0}.ssg-home-moods,.ssg-home-popular{display:none}.ssg-home-week{top:21.6%;align-self:start;width:68.8%;height:39.7%;margin:0 0 0 2.6%;border-radius:12px;border:0;background:${HOME_HERO_FILL}}.ssg-home-hero{position:absolute;inset:0;height:100%;aspect-ratio:auto;border-radius:inherit}.ssg-home-week-body{left:24px;right:24px;bottom:22px;padding:18px}}
@media(min-width:1280px) and (min-height:961px){.ssg-home-notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}.ssg-home-note{height:44px;border-radius:12px;background:rgba(255,255,255,.45);border:1px solid ${COLORS.light.border}}}
.ssg-search-shell{width:100%;max-width:1214px;margin:0 auto;padding:10px}
.ssg-search-layout{display:block;min-width:0}
.ssg-search-aside{display:none}
.ssg-search-aside-group{margin-bottom:18px}
.ssg-search-aside-title{margin:0 0 10px;font:600 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};text-transform:uppercase;letter-spacing:.08em}
.ssg-search-aside-line{height:14px;border-radius:7px;margin-bottom:10px}
.ssg-search-main{min-width:0}
.ssg-search-header{padding-top:14px}
.ssg-search-bar{height:48px;border-radius:12px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border};display:flex;align-items:center;padding:0 16px;font:400 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted}}
.ssg-search-toolbar{height:32px;display:flex;align-items:center;gap:8px;margin-top:8px}
.ssg-search-tool{width:88px;height:32px;border-radius:999px;background:${COLORS.light.bgSecondary};border:1px solid ${COLORS.light.border}}
.ssg-search-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin-top:8px}
.ssg-search-card{min-width:0;border-radius:12px;overflow:hidden;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border}}
.ssg-search-card-media{width:100%;height:220px}
.ssg-search-card-body{padding:12px;display:flex;flex-direction:column;gap:8px}
.ssg-search-card-line{height:14px;border-radius:4px}
.ssg-search-card-line.w70{width:70%}.ssg-search-card-line.w50{width:50%}.ssg-search-card-line.w30{width:30%}
.ssg-search-seo{position:relative;width:100%;margin:32px 0 0;padding:0}
.ssg-search-h1{margin:0 0 12px;font:700 28px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};letter-spacing:-0.02em;max-width:720px}
.ssg-search-lead{margin:0;font:400 16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted};max-width:720px}
@media(min-width:768px){.ssg-search-shell{padding:14px}.ssg-search-header{padding-top:59px}.ssg-search-toolbar{gap:14px;margin-top:14px}.ssg-search-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}.ssg-search-card-media{height:270px}.ssg-search-h1{font-size:36px}}
@media(min-width:1440px){.ssg-search-shell{max-width:1600px}.ssg-search-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}.ssg-search-aside{display:block;min-height:520px;padding:16px;background:${COLORS.light.surface};border-right:1px solid ${COLORS.light.border}}}
.ssg-map-layout{display:flex;min-height:calc(${MAP_VIEWPORT_HEIGHT} - ${MAP_WEB_MOBILE_VIEWPORT_RESERVE_PX}px);background:${COLORS.light.bgSecondary}}
.ssg-map-canvas{position:relative;flex:1;min-height:calc(${MAP_VIEWPORT_HEIGHT} - ${MAP_WEB_MOBILE_VIEWPORT_RESERVE_PX}px);overflow:hidden;background:linear-gradient(135deg,${COLORS.light.bgSecondary} 0%,${COLORS.light.bg} 50%,${COLORS.light.bgSecondary} 100%)}
.ssg-map-canvas::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.24) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.24) 1px,transparent 1px);background-size:48px 48px;opacity:.45}
.ssg-map-canvas img.ssg-map-tile{position:absolute;left:50%;top:50%;width:256px;height:256px;min-width:256px;min-height:256px;max-width:none;max-height:none;aspect-ratio:1/1;display:block;transform:translate(var(--metravel-map-shell-tile-offset-x,-50%),var(--metravel-map-shell-tile-offset-y,-50%));z-index:1;pointer-events:none;user-select:none}
.ssg-map-toolbar{position:absolute;top:12px;left:12px;right:84px;display:flex;gap:8px;z-index:3}
.ssg-map-toolbar-pill{height:32px;border-radius:999px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border};padding:0 14px;display:inline-flex;align-items:center;font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};white-space:nowrap}
.ssg-map-controls{position:absolute;top:12px;right:12px;display:flex;flex-direction:column;gap:8px;z-index:3}
.ssg-map-control{width:36px;height:36px;border-radius:12px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border}}
.ssg-map-marker{position:absolute;width:18px;height:18px;border-radius:999px;background:#f5842c;border:3px solid rgba(255,255,255,0.96);box-shadow:0 10px 22px rgba(15,23,42,0.18);z-index:2}
.ssg-map-marker.m1{top:24%;left:31%}.ssg-map-marker.m2{top:38%;left:56%}.ssg-map-marker.m3{top:34%;left:72%}.ssg-map-marker.m4{top:57%;left:42%}.ssg-map-marker.m5{top:62%;left:64%}
.ssg-map-sidebar-shell{display:none;width:${MAP_WEB_DESKTOP_SIDEBAR_WIDTH_PX}px;flex-shrink:0;background:${COLORS.light.surface};border-left:1px solid ${COLORS.light.border}}
@media(min-width:${MAP_WEB_MOBILE_BREAKPOINT_PX}px){.ssg-map-layout,.ssg-map-canvas{min-height:calc(${MAP_VIEWPORT_HEIGHT} - ${MAP_WEB_DESKTOP_VIEWPORT_RESERVE_PX}px)}.ssg-map-canvas{flex:0 0 calc(100% - ${MAP_WEB_DESKTOP_SIDEBAR_WIDTH_PX}px);min-width:0}.ssg-map-sidebar-shell{display:flex;flex-direction:column}}
.ssg-map-sidebar-head{padding:16px 16px 12px;border-bottom:1px solid ${COLORS.light.border}}
.ssg-map-panel-kicker{margin:0 0 8px;font:600 12px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted};text-transform:uppercase;letter-spacing:.08em}
.ssg-map-panel-title{margin:0 0 8px;font:700 28px/1.15 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};letter-spacing:-.03em}
.ssg-map-panel-lead{margin:0;font:400 15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted}}
.ssg-map-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.ssg-map-chip{height:28px;padding:0 12px;border-radius:999px;background:${COLORS.light.bgSecondary};border:1px solid ${COLORS.light.border};display:inline-flex;align-items:center;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted}}
.ssg-map-sidebar-list{padding:14px;display:flex;flex-direction:column;gap:10px}
.ssg-map-sidebar-item{display:flex;gap:10px;align-items:center}
.ssg-map-sidebar-thumb{width:52px;height:52px;border-radius:14px;background:${COLORS.light.bgSecondary};flex-shrink:0}
.ssg-map-sidebar-lines{flex:1;display:flex;flex-direction:column;gap:8px}
.ssg-map-sidebar-line{height:12px;border-radius:6px}
.ssg-map-sidebar-line.w80{width:80%}.ssg-map-sidebar-line.w55{width:55%}
.ssg-map-mobile-card{position:absolute;left:12px;right:12px;bottom:12px;z-index:3;padding:14px;border-radius:24px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border};box-shadow:0 18px 40px rgba(15,23,42,0.18)}
@media(min-width:${MAP_WEB_MOBILE_BREAKPOINT_PX}px){.ssg-map-mobile-card{display:none}}
.ssg-map-mobile-hero{height:164px;border-radius:18px;background:${COLORS.light.bgSecondary};margin-bottom:12px}
.ssg-map-mobile-title{margin:0 0 6px;font:700 20px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text}}
.ssg-map-mobile-sub{margin:0 0 12px;font:400 14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted}}
.ssg-map-mobile-actions{display:flex;gap:8px;flex-wrap:wrap}
.ssg-map-mobile-action{height:32px;min-width:64px;border-radius:999px;background:${COLORS.light.bgSecondary};border:1px solid ${COLORS.light.border}}
.ssg-travel-spacer{height:61px}
.ssg-travel-wrap{max-width:1200px;margin:0 auto;padding:0 10px}
.ssg-travel-first-screen{min-height:calc(100svh - 117px)}
.ssg-travel-hero{position:relative;width:100%;height:min(56vh,520px);min-height:260px;max-height:520px;border:1px solid ${COLORS.light.border};border-radius:8px;overflow:hidden;background:${COLORS.light.bgSecondary};margin:0 0 12px}
@media(min-width:768px){.ssg-travel-spacer{height:24px}.ssg-travel-wrap{padding:0 24px}.ssg-travel-hero{height:70vh;min-height:360px;max-height:750px;margin:8px 0 16px}}
.ssg-travel-hero[data-ssg-travel-hero-adopted="true"]{position:absolute;inset:0;width:100%;height:100%;min-height:0;max-height:none;margin:0;border-radius:inherit}
/* #1206: hero-фотография обязана заполнить бокс hero ещё ДО гидрации.
   ВНИМАНИЕ: этот CSS живёт внутри JS-шаблона, поэтому обратные кавычки здесь
   недопустимы — они закрывают литерал и ломают весь скрипт.
   Раньше здесь стояло ".ssg-travel-hero-img{height:100%}" — и это не работало
   дважды. Во-первых, <picture> (критический CSS делает его display:block;
   height:auto) — бокс неопределённой высоты, поэтому процент не разрешался и
   height схлопывался в auto. Во-вторых, критический CSS содержит
   безусловное img[data-lcp]{aspect-ratio:16/9;min-height:240px} — селектор
   специфичнее одиночного класса (0,1,1 против 0,1,0), и он же задавал размер.
   Итог на mobile 412×823: фото рисовалось 412×240 внутри бокса 412×461, то
   есть 43 226 px² — МЕНЬШЕ, чем текстовый .ssg-travel-h1 (51 888 px²), и
   Chrome не брал фотографию в LCP-кандидаты вообще. Полный размер она получала
   только в момент handoff (инлайновые стили в useTravelSsgHeroHandoff), и
   ровно там записывался LCP: 158 107 px² на 7.7 с при готовой к 2.1 с картинке.
   Поэтому геометрию задаём здесь, с приоритетом над img[data-lcp]:
   <picture> — абсолютный бокс hero, <img> — абсолютный бокс picture. При
   position:absolute + inset:0 высота определена вставками, так что
   aspect-ratio и min-height из критического CSS больше не участвуют. */
.ssg-travel-hero picture{position:absolute;inset:0;display:block;width:100%;height:100%;margin:0;z-index:1}
.ssg-travel-hero img.ssg-travel-hero-img{position:absolute;inset:0;width:100%;height:100%;min-width:0;min-height:0;max-width:none;max-height:none;aspect-ratio:auto;object-fit:contain;object-position:center;display:block;z-index:1}
/* Затемнение — ПОД фотографией, как в React-hero (data-hero-backdrop-overlay
   с zIndex 0): оно тонирует только поля letterbox. При z-index:1 оно лежало
   поверх кадра, и на handoff фотография заметно светлела. */
.ssg-travel-hero-bg{position:absolute;inset:0;background:rgba(7,12,19,0.24);pointer-events:none;z-index:0}
.ssg-travel-author-skeleton{display:flex;align-items:center;gap:12px;min-height:68px;padding:8px 4px 12px;margin-bottom:8px}
.ssg-travel-author-avatar{width:44px;height:44px;flex:0 0 44px;border-radius:999px}
.ssg-travel-author-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:8px}
.ssg-travel-author-label{width:96px;height:11px;border-radius:6px}
.ssg-travel-author-name{width:min(52%,180px);height:16px;border-radius:8px}
.ssg-travel-author-actions{display:flex;gap:8px}
.ssg-travel-author-action{width:36px;height:36px;border-radius:12px}
.ssg-travel-meta-row{display:flex;gap:8px;flex-wrap:wrap;padding:0 4px 12px}
.ssg-travel-meta-chip{width:92px;height:20px;border-radius:999px}
.ssg-travel-primary{min-width:0}
.ssg-travel-desktop-sidebar{display:none}
.ssg-travel-sidebar-card{display:flex;align-items:center;gap:12px;padding:18px;border-radius:28px;background:${COLORS.light.surface}}
.ssg-travel-sidebar-avatar{width:48px;height:48px;flex:0 0 48px;border-radius:999px}
.ssg-travel-sidebar-copy{display:flex;flex:1;flex-direction:column;gap:9px}
.ssg-travel-sidebar-line{height:14px;border-radius:7px}
.ssg-travel-sidebar-line.w55{width:55%}.ssg-travel-sidebar-line.w75{width:75%}
.ssg-travel-sidebar-nav{display:flex;flex-direction:column;gap:12px;padding:18px 8px}
.ssg-travel-sidebar-nav-line{height:18px;border-radius:9px}
/* #1359: реальные title/article/related остаются обычными raw HTML-узлами
   в нормальном DOM-flow. Перед ними first-screen занимает остаток viewport,
   поэтому SEO-текст и инжектируемый сразу после .ssg-travel-h1 quest-promo
   не попадают в первый экран без clipping/display:none/visibility/inert. */
.ssg-travel-crawlable{position:relative;width:100%;margin:0;padding:0}
@media(min-width:1280px){.ssg-travel-wrap{max-width:1600px;padding:0 24px}.ssg-travel-first-screen{display:grid;grid-template-columns:307px minmax(0,1fr);gap:16px;min-height:calc(100svh - 80px)}.ssg-travel-desktop-sidebar{display:flex;flex-direction:column;min-width:0}.ssg-travel-primary>.ssg-travel-author-skeleton{display:none}.ssg-travel-crawlable{width:calc(100% - 323px);margin-left:323px}}
.ssg-travel-title{height:32px;width:70%;border-radius:8px;margin:0 0 12px}
.ssg-travel-meta{height:16px;width:40%;border-radius:6px;margin:0 0 24px}
.ssg-travel-line{height:14px;border-radius:4px;margin-bottom:10px}
.ssg-travel-line.w90{width:90%}.ssg-travel-line.w75{width:75%}.ssg-travel-line.w60{width:60%}
.ssg-travel-h1{margin:0 0 14px;font:700 28px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};letter-spacing:-0.02em;max-width:760px}
@media(min-width:768px){.ssg-travel-h1{font-size:34px}}
.ssg-travel-article{max-width:760px;font:400 16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text}}
.ssg-travel-article p{margin:0 0 16px}
.ssg-travel-article h2{margin:28px 0 12px;font:700 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-0.01em;color:${COLORS.light.text}}
.ssg-travel-article h3{margin:22px 0 10px;font:700 18px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text}}
.ssg-travel-article ul,.ssg-travel-article ol{margin:0 0 16px;padding-left:22px}
.ssg-travel-article li{margin:0 0 6px}
.ssg-travel-article a{color:#1f6feb;text-decoration:underline}
.ssg-travel-article blockquote{margin:0 0 16px;padding-left:14px;border-left:3px solid ${COLORS.light.border};color:${COLORS.light.textMuted}}
.ssg-travel-article img{display:block;max-width:100%;height:auto;object-fit:contain;object-position:center;border-radius:12px}
.ssg-travel-article .img-row-2,.ssg-travel-article .img-grid,.ssg-travel-article .img-jrow,.ssg-travel-article .img-grid-mixed{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:18px 0 22px}
.ssg-travel-article .img-row-2>p,.ssg-travel-article .img-grid>p,.ssg-travel-article .img-jrow>p,.ssg-travel-article .img-grid-mixed>p{margin:0;min-width:0;aspect-ratio:16/9;overflow:hidden;background:${COLORS.light.bgSecondary};border-radius:12px}
.ssg-travel-article .img-row-2 img,.ssg-travel-article .img-grid img,.ssg-travel-article .img-jrow img,.ssg-travel-article .img-grid-mixed img{width:100%;height:100%;max-width:none}
.ssg-travel-article p>img:only-child{width:100%;aspect-ratio:16/9;background:${COLORS.light.bgSecondary}}
@media(max-width:420px){.ssg-travel-article .img-row-2,.ssg-travel-article .img-grid,.ssg-travel-article .img-jrow,.ssg-travel-article .img-grid-mixed{grid-template-columns:minmax(0,1fr)}}
.ssg-travel-related{max-width:760px;margin:32px 0 8px;padding-top:20px;border-top:1px solid ${COLORS.light.border}}
.ssg-travel-related h2{margin:0 0 12px;font:700 20px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text}}
.ssg-travel-related ul{margin:0;padding-left:20px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.ssg-travel-related li{margin:0 0 8px}
.ssg-travel-related a{color:#1f6feb;text-decoration:underline}
.ssg-pulse{animation:ssg-shimmer 1.5s ease-in-out infinite}
@keyframes ssg-shimmer{0%,100%{background:${COLORS.light.shimmerFrom}}50%{background:${COLORS.light.shimmerTo}}}
html[data-theme="dark"] #ssg-skeleton{background:${COLORS.dark.bg};color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-bar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-bar-logo{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-search-h1{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-search-lead{color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-search-aside-title{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-home-book{background-color:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-home-page{background-color:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-home-title{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-home-sub{color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-home-cta,html[data-theme="dark"] .ssg-home-search-btn{background:${COLORS.dark.primary}}
html[data-theme="dark"] .ssg-home-mood{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-home-moods{border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-home-popular-card{background:${COLORS.dark.bgSecondary};border-color:${COLORS.dark.border}}
/* Акцент и поле поиска темизируются только вне книги: страница раскрытой книги
   на desktop всегда светлая (bookPageAccent + бумажные цвета поиска). */
@media(max-width:1279px){html[data-theme="dark"] .ssg-home-title .ssg-accent{color:${COLORS.dark.accent}}html[data-theme="dark"] .ssg-home-search{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}}
@media(min-width:1280px){html[data-theme="dark"] .ssg-home-page{background-color:transparent}}
html[data-theme="dark"] .ssg-search-card,html[data-theme="dark"] .ssg-search-aside{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-search-bar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border};color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-search-tool{background:${COLORS.dark.bgSecondary};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-map-layout{background:${COLORS.dark.bgSecondary}}
html[data-theme="dark"] .ssg-map-canvas{background:linear-gradient(135deg,${COLORS.dark.bgSecondary} 0%,${COLORS.dark.bg} 50%,${COLORS.dark.bgSecondary} 100%)}
html[data-theme="dark"] .ssg-map-canvas::before{background-image:linear-gradient(rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.08) 1px,transparent 1px)}
html[data-theme="dark"] .ssg-map-toolbar-pill,html[data-theme="dark"] .ssg-map-control,html[data-theme="dark"] .ssg-map-sidebar-shell,html[data-theme="dark"] .ssg-map-mobile-card{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-map-panel-kicker,html[data-theme="dark"] .ssg-map-panel-lead,html[data-theme="dark"] .ssg-map-chip{color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-map-panel-title,html[data-theme="dark"] .ssg-map-toolbar-pill,html[data-theme="dark"] .ssg-map-mobile-title{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-map-chip,html[data-theme="dark"] .ssg-map-mobile-action,html[data-theme="dark"] .ssg-map-sidebar-thumb,html[data-theme="dark"] .ssg-map-mobile-hero{background:${COLORS.dark.bgSecondary};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-map-mobile-sub{color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-travel-hero{background:${COLORS.dark.bgSecondary};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-travel-sidebar-card{background:${COLORS.dark.surface}}
html[data-theme="dark"] .ssg-travel-h1{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-article{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-article h2,html[data-theme="dark"] .ssg-travel-article h3{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-article a{color:#5aa7ff}
html[data-theme="dark"] .ssg-travel-article blockquote{border-color:${COLORS.dark.border};color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-travel-article .img-row-2>p,html[data-theme="dark"] .ssg-travel-article .img-grid>p,html[data-theme="dark"] .ssg-travel-article .img-jrow>p,html[data-theme="dark"] .ssg-travel-article p>img:only-child{background:${COLORS.dark.bgSecondary}}
html[data-theme="dark"] .ssg-travel-related{border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-travel-related h2{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-related a{color:#5aa7ff}
html[data-theme="dark"] .ssg-pulse{animation-name:ssg-shimmer-dark}
@keyframes ssg-shimmer-dark{0%,100%{background:${COLORS.dark.shimmerFrom}}50%{background:${COLORS.dark.shimmerTo}}}
/*
 * #1207: снятие шелла БЕЗ полупрозрачной фазы.
 *
 * Раньше здесь был \`transition:opacity .2s\`, и класс \`ssg-hiding\` гасил шелл
 * плавно. Пока идёт этот переход, на экране одновременно видны статический
 * SEO-текст и уже отрисованный интерфейс — они накладываются и нечитаемы.
 * Заявленные 200 мс держатся только на свободном main-thread: замер прода
 * 2026-08-02, /search, iPhone-профиль 375×812, CPU throttle 6× — полупрозрачная
 * фаза длилась 384 мс (7 952 → 8 336 мс), и чем медленнее устройство, тем она
 * длиннее, потому что кадры анимации конкурируют с гидрацией.
 *
 * Теперь шелл скрывается в один кадр и тут же удаляется. Класс остаётся
 * страховкой на случай, если удаление узла не прошло.
 */
#ssg-skeleton.ssg-hiding{opacity:0;visibility:hidden;pointer-events:none}
</style>`;
}

/**
 * Skeleton auto-removal script.
 *
 * The SSG hero <img> (inside #ssg-skeleton, a sibling BEFORE #root) is the LCP
 * element — it paints ~FCP. React's own hero <img data-lcp> renders later
 * INSIDE #root. If the skeleton is torn down as soon as #root gets any child
 * (React's loading shell), the SSG hero disappears and React's hero becomes a
 * new, late LCP candidate that only paints after full hydration (>15s on
 * throttled mobile) — wrecking LCP.
 *
 * Fix (travel pages): keep the SSG hero on screen until React's own hero image
 * (#root img[data-lcp]) is actually loaded. The large full-bleed SSG hero
 * stays the largest contentful paint the whole time, so Chrome keeps the
 * early (~FCP) paint as the final LCP instead of resetting it to hydration
 * time.
 *
 * Home/search skeletons have NO img[data-lcp] (their LCP is the hero TEXT block
 * that paints at ~FCP and is already locked by then). For those, waiting on a
 * non-existent hero image meant the skeleton lingered until the 20s safety net,
 * covering the already-hydrated, interactive app for up to 20s. So for non-travel
 * skeletons we tear down as soon as the app reports hydration+paint (the
 * `app-hydrated` class set by RootWebDeferredChrome after a rAF) — the early text
 * LCP is already captured, so this only removes a stale overlay.
 *
 * 20s safety net: by then LCP is long settled, so the only question is whether
 * React actually mounted. The old check (`#root has childNodes`) could not tell:
 * the static export ALWAYS prerenders a shell inside #root, so the skeleton —
 * the only visible content on travel pages — was force-removed even when the JS
 * bundle never loaded (stale deploy, flaky network), leaving a white screen.
 * Now after 20s we tear down only on real mount signals: the `app-hydrated`
 * class (allowed for travel skeletons too at this point) or an img[data-lcp]
 * EXISTING in #root (React rendered the travel page; no need to wait for the
 * image bytes anymore). If React never mounts, the skeleton stays — readable
 * content instead of a blank page (the global chunk-reload handler does its own
 * one-shot recovery in parallel). A 45s deep fallback covers "mounted but both
 * signals missed" — but it must ask whether REACT is alive, not how much text is
 * on screen. The old check ("#root accumulated >200 chars; the dead static shell
 * is ~60") was measured against travel pages only: the `/` prerender carries
 * 5 739 chars of static text (the quest list) and `/search` is similar, so the
 * threshold was always crossed and the shell was torn off a dead bundle after
 * 45s — the exact blank screen this net exists to prevent (#1356). Instead the
 * net asks whether React is alive, via the internal keys it stamps on the DOM
 * (`__reactFiber…` on every host node it owns). The container key is deliberately
 * ignored: React writes `__reactContainer…` inside createRoot/hydrateRoot BEFORE
 * the first commit, while an SSG page already has element children in #root. A
 * render that throws above the app ErrorBoundary would therefore satisfy
 * "container key + child" without ever committing. A fiber key on a top-level
 * host node is the stronger signal that React actually hydrated/rendered it.
 *
 * A DOM-mutation backstop was considered and rejected: anything that writes into
 * #root without React (Chrome's page translator wrapping text in <font>, password
 * managers, extensions) would tear the shell off a dead bundle again.
 *
 * If nothing is mounted at 45s the shell stays until a real signal appears, so
 * the 120ms poll is slowed to 2s — an unusable page must not keep an 8Hz timer
 * alive, but a bundle that finally arrives (very slow network) still lifts the
 * shell within ~2s.
 *
 * The React travel shell also marks #root with data-travel-details-ready after
 * its own first-screen overlay has lifted. This covers Safari paths where the
 * LCP img node is replaced before this script observes its completed state.
 *
 * Parse-order guard: this <script> lives INSIDE #ssg-skeleton, which is injected
 * right after <body> — i.e. BEFORE <div id="root">. So at first execution #root
 * is not parsed yet and getElementById('root') is null. We must NOT treat that as
 * "orphan skeleton, remove it" (that bug made the skeleton self-destruct in ~30ms,
 * before it could ever be the FCP/LCP paint). Instead, if #root is missing while
 * the document is still loading, defer until DOMContentLoaded and re-check; only
 * remove as an orphan if #root is still absent after the DOM is fully parsed.
 */
function buildRemovalScript() {
  return `<script>(function(){try{var s=document.getElementById('ssg-skeleton');if(!s)return;function begin(){if(s.__b)return;var r=document.getElementById('root');if(!r){if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',begin,{once:true});return}s.remove();return}s.__b=1;var travelSkel=!!s.querySelector('.ssg-travel-hero');var mapSkel=!!s.querySelector('.ssg-map-layout');var done=false;var late=false;var deep=false;var o;var iv;function killCss(){if(document.querySelector('[data-ssg-travel-hero-adopted="true"]'))return;var c=document.getElementById('ssg-skeleton-css');if(c&&c.parentNode)c.parentNode.removeChild(c)}function teardown(){if(done)return;done=true;try{if(o)o.disconnect()}catch(e){}if(iv)clearInterval(iv);try{s.classList.add('ssg-hiding')}catch(e){}try{if(s.parentNode)s.parentNode.removeChild(s)}catch(e){}killCss()}function heroReady(){var i=r.querySelector('img[data-lcp]');return !!(i&&i.complete&&i.naturalWidth>0)}function travelReady(){return travelSkel&&r.getAttribute('data-travel-details-ready')==='true'}function mapReady(){return mapSkel&&r.getAttribute('data-map-route-ready')==='true'}function appReady(){return !mapSkel&&(!travelSkel||late)&&document.documentElement.classList.contains('app-hydrated')}function lateHero(){return late&&!!r.querySelector('img[data-lcp]')}function reactHost(n){try{var ks=Object.keys(n);for(var i=0;i<ks.length;i++){if(ks[i].indexOf('__reactFiber')===0)return true}}catch(e){}return false}function reactMounted(){for(var c=r.firstElementChild;c;c=c.nextElementSibling){if(reactHost(c))return true}return false}function check(){if(done)return false;if(heroReady()||travelReady()||mapReady()||appReady()||lateHero()||(deep&&reactMounted())){teardown();return true}return false}if(check())return;o=new MutationObserver(function(){if(check()){o.disconnect()}});o.observe(r,{childList:true,subtree:true,attributes:true,attributeFilter:['data-map-route-ready','data-travel-details-ready']});function tick(){if(done){clearInterval(iv);return}if(check()){clearInterval(iv);try{o.disconnect()}catch(e){}}}function poll(ms){clearInterval(iv);iv=setInterval(tick,ms)}poll(120);setTimeout(function(){late=true;check()},20000);setTimeout(function(){if(done)return;deep=true;if(check())return;poll(2000)},45000)}begin()}catch(e){}})();</script>`;
}

function buildSearchCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<div class="ssg-search-card"><div class="ssg-search-card-media ssg-pulse"></div><div class="ssg-search-card-body"><div class="ssg-search-card-line w70 ssg-pulse"></div><div class="ssg-search-card-line w50 ssg-pulse"></div><div class="ssg-search-card-line w30 ssg-pulse"></div></div></div>`;
  }
  return html;
}

function buildSearchSidebarLines(count) {
  let html = '';
  const widths = ['80%', '60%', '90%', '70%', '50%', '85%', '65%', '75%'];
  for (let i = 0; i < count; i++) {
    html += `<div class="ssg-search-aside-line ssg-pulse" style="width:${widths[i % widths.length]}"></div>`;
  }
  return html;
}

/**
 * Build home page skeleton HTML.
 */
function buildHomeSkeletonHtml({ heroHref } = {}) {
  // Real hero text (not empty pulse bars) so Chrome's FCP fires on render and
  // the LCP candidate is locked to this large title block BEFORE hydration.
  // Without it the home LCP only fires after full hydration (>8s on throttled
  // mobile). NOT an <h1>: the single semantic <h1> is the out-of-flow one in
  // #root (index.tsx), so the raw HTML keeps exactly one H1. Mirrors the
  // /search and /travels skeleton approach.
  //
  // #1281: одного текста мало. Текстовый кандидат (21 918 px2) вдвое меньше
  // фотографии React-hero, поэтому Chrome переустанавливал LCP на неё уже после
  // гидрации. Картинка к этому моменту давно скачана — её кладёт
  // injectHomeHeroPreload; не хватало только узла, который нарисует её до React.
  // Без heroHref (ассет не нашёлся в dist) сохраняем тот же нейтральный слот,
  // чтобы карточка не схлопывалась из-за абсолютно позиционированного body.
  const heroImg = heroHref
    ? `<img class="ssg-home-hero-img" src="${escapeHtmlAttr(heroHref)}" alt="Маршрут недели" decoding="async" fetchpriority="high" data-ssg-lcp="true"/>`
    : '';
  // Мобильная композиция зеркалит React-hero: белая карточка (заголовок,
  // подзаголовок, поиск с кнопкой, зелёный CTA), под ней hairline-разделитель и
  // грид mood-чипов, затем карточка «Маршрут недели» с фото и скримом, затем
  // 2 карточки «Популярного». На desktop те же узлы перекладываются в разворот
  // книги media-query'ями; чипы прячутся, а на высоких экранах вместо них в
  // левой странице показывается грид page-notes (.ssg-home-notes).
  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo">MeTravel</div></div>
<main class="ssg-home-shell">
<div class="ssg-home-book">
<section class="ssg-home-page">
<div class="ssg-home-chapter" aria-hidden="true"><span class="ssg-home-chapter-label">Идеи путешествий</span><span class="ssg-home-chapter-line"></span></div>
<div class="ssg-home-title">Куда поехать <span class="ssg-accent">в эти выходные?</span></div>
<p class="ssg-home-sub">Реальные маршруты по Беларуси и Европе — с фото и GPS-треками.</p>
<div class="ssg-home-search-row" aria-hidden="true"><div class="ssg-home-search"></div><div class="ssg-home-search-btn"></div></div>
<div class="ssg-home-cta" aria-hidden="true"></div>
<div class="ssg-home-notes" aria-hidden="true">${Array.from({ length: 5 }, () => '<div class="ssg-home-note"></div>').join('')}</div>
</section>
<div class="ssg-home-moods" aria-hidden="true">${Array.from({ length: 5 }, () => '<div class="ssg-home-mood"></div>').join('')}</div>
<article class="ssg-home-week">
<div class="ssg-home-hero">${heroImg}</div>
<div class="ssg-home-week-body" aria-hidden="true">
<div class="ssg-home-week-kicker"></div>
<div class="ssg-home-week-title"></div>
<div class="ssg-home-week-sub"></div>
<div class="ssg-home-week-action"></div>
</div>
</article>
<div class="ssg-home-popular" aria-hidden="true">${Array.from({ length: 2 }, () => '<div class="ssg-home-popular-card"><div class="ssg-home-popular-thumb ssg-pulse"></div><div class="ssg-home-popular-line w76 ssg-pulse"></div><div class="ssg-home-popular-line w55 ssg-pulse"></div></div>').join('')}</div>
</div>
</main>
${buildRemovalScript()}
</div>`;
}

/**
 * Build search page skeleton HTML.
 *
 * Mirrors the catalogue first screen before hydration. The exact crawlable H1
 * and lead stay in normal DOM flow after the cards, so they remain raw SEO text
 * without displacing the search controls and first result card.
 */
function buildSearchSkeletonHtml() {
  const leadText =
    'Ищите маршруты по странам, категориям и уровню сложности. ' +
    'Подбирайте идеи для поездок на выходные, сохраняйте путешествия ' +
    'с фото и заметками и собирайте личную книгу путешествий в PDF. ' +
    'Тысячи готовых маршрутов по Беларуси, Европе и миру — от однодневных ' +
    'прогулок рядом с домом до многодневных трипов с семьёй, друзьями ' +
    'или в одиночку. Фильтруйте поездки по сезону, бюджету, типу транспорта ' +
    'и уровню физической нагрузки: пешие маршруты, велопоходы, автопутешествия, ' +
    'поездки на общественном транспорте, водные и горные маршруты. ' +
    'Смотрите фотографии от путешественников, карты с точками интереса, ' +
    'трек-файлы GPX и подробные заметки — всё, что нужно, чтобы собраться и поехать.';
  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo">MeTravel</div></div>
<div class="ssg-search-shell">
<div class="ssg-search-layout">
<aside class="ssg-search-aside">
<div class="ssg-search-aside-group"><div class="ssg-search-aside-title">Страны</div>${buildSearchSidebarLines(3)}</div>
<div class="ssg-search-aside-group"><div class="ssg-search-aside-title">Категории</div>${buildSearchSidebarLines(3)}</div>
<div class="ssg-search-aside-group"><div class="ssg-search-aside-title">Сложность</div>${buildSearchSidebarLines(2)}</div>
</aside>
<main class="ssg-search-main">
<div class="ssg-search-header">
<div class="ssg-search-bar">Найти маршрут…</div>
<div class="ssg-search-toolbar" aria-hidden="true"><div class="ssg-search-tool"></div><div class="ssg-search-tool"></div><div class="ssg-search-tool"></div></div>
</div>
<div class="ssg-search-grid">${buildSearchCards(6)}</div>
<section class="ssg-search-seo">
<h1 class="ssg-search-h1">Поиск путешествий и маршрутов</h1>
<p class="ssg-search-lead">${leadText}</p>
</section>
</main>
</div>
</div>
${buildRemovalScript()}
</div>`;
}

/**
 * Build map page skeleton HTML.
 *
 * Keeps the map-first layout visible before hydration while preserving desktop
 * side panel and mobile bottom-card geometry.
 */
function buildMapSkeletonHtml() {
  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo">MeTravel</div></div>
<div class="ssg-map-layout">
  <div class="ssg-map-canvas" role="region" aria-label="Карта маршрутов и достопримечательностей Беларуси">
    <img class="ssg-map-tile" data-ssg-map-tile="true" width="256" height="256" alt="" aria-hidden="true" decoding="async">
    <script>(function(){try{if(typeof window.__metravelMountMapShellTile==='function')window.__metravelMountMapShellTile()}catch(e){}})();</script>
    <div class="ssg-map-toolbar">
      <div class="ssg-map-toolbar-pill">Карта маршрутов</div>
      <div class="ssg-map-toolbar-pill">50 км</div>
      <div class="ssg-map-toolbar-pill">Фильтры</div>
    </div>
    <div class="ssg-map-controls">
      <div class="ssg-map-control ssg-pulse"></div>
      <div class="ssg-map-control ssg-pulse"></div>
      <div class="ssg-map-control ssg-pulse"></div>
    </div>
    <div class="ssg-map-marker m1"></div>
    <div class="ssg-map-marker m2"></div>
    <div class="ssg-map-marker m3"></div>
    <div class="ssg-map-marker m4"></div>
    <div class="ssg-map-marker m5"></div>
    <div class="ssg-map-mobile-card">
      <div class="ssg-map-mobile-hero ssg-pulse"></div>
      <div class="ssg-map-mobile-title">Маршруты и места рядом</div>
      <p class="ssg-map-mobile-sub">Точки интереса, маршруты и фильтры под ваши планы — в одном экране.</p>
      <div class="ssg-map-mobile-actions">
        <div class="ssg-map-mobile-action ssg-pulse"></div>
        <div class="ssg-map-mobile-action ssg-pulse"></div>
        <div class="ssg-map-mobile-action ssg-pulse"></div>
      </div>
    </div>
  </div>
  <div class="ssg-map-sidebar-shell">
    <div class="ssg-map-sidebar-head">
      <p class="ssg-map-panel-kicker">Интерактивная карта</p>
      <div class="ssg-map-panel-title">Маршруты и достопримечательности Беларуси</div>
      <p class="ssg-map-panel-lead">Ищите места поблизости, стройте маршрут и быстро открывайте точки интереса на карте.</p>
      <div class="ssg-map-chip-row">
        <div class="ssg-map-chip">Радиус 50 км</div>
        <div class="ssg-map-chip">Маршруты</div>
        <div class="ssg-map-chip">Точки</div>
      </div>
    </div>
    <div class="ssg-map-sidebar-list">
      <div class="ssg-map-sidebar-item">
        <div class="ssg-map-sidebar-thumb ssg-pulse"></div>
        <div class="ssg-map-sidebar-lines">
          <div class="ssg-map-sidebar-line w80 ssg-pulse"></div>
          <div class="ssg-map-sidebar-line w55 ssg-pulse"></div>
        </div>
      </div>
      <div class="ssg-map-sidebar-item">
        <div class="ssg-map-sidebar-thumb ssg-pulse"></div>
        <div class="ssg-map-sidebar-lines">
          <div class="ssg-map-sidebar-line w80 ssg-pulse"></div>
          <div class="ssg-map-sidebar-line w55 ssg-pulse"></div>
        </div>
      </div>
      <div class="ssg-map-sidebar-item">
        <div class="ssg-map-sidebar-thumb ssg-pulse"></div>
        <div class="ssg-map-sidebar-lines">
          <div class="ssg-map-sidebar-line w80 ssg-pulse"></div>
          <div class="ssg-map-sidebar-line w55 ssg-pulse"></div>
        </div>
      </div>
      <div class="ssg-map-sidebar-item">
        <div class="ssg-map-sidebar-thumb ssg-pulse"></div>
        <div class="ssg-map-sidebar-lines">
          <div class="ssg-map-sidebar-line w80 ssg-pulse"></div>
          <div class="ssg-map-sidebar-line w55 ssg-pulse"></div>
        </div>
      </div>
    </div>
  </div>
</div>
${buildRemovalScript()}
</div>`;
}

function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Tags kept (with their text) when sanitizing the article body for crawlers.
const SSG_ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'blockquote', 'a',
]);

// Upper bound for the article body rendered into the pre-hydration shell.
// The previous 9 000 cut half the library mid-article: 150 of 306 published
// travels sanitize to more than that, and the tail that disappeared was exactly
// the "Что рядом" / FAQ / practical sections crawlers rank on (audit 2026-08-08).
// 60 000 clears the whole corpus with room to spare — the longest article
// (id 470, Tour du Mont Blanc) sanitizes to 45 528 chars — while still capping
// a runaway record. Media is already stripped above, so base64 <img> payloads
// (#1319/#1320) cannot eat this budget.
const SSG_ARTICLE_BODY_MAX_CHARS = 60000;

/** Truncate sanitized HTML at a block boundary so no tag is cut mid-way. */
function clampHtmlAtBlock(html, max) {
  if (html.length <= max) return html;
  const slice = html.slice(0, max);
  const boundary = Math.max(
    slice.lastIndexOf('</p>'),
    slice.lastIndexOf('</li>'),
    slice.lastIndexOf('</h2>'),
    slice.lastIndexOf('</h3>'),
    slice.lastIndexOf('</h4>'),
    slice.lastIndexOf('</blockquote>')
  );
  if (boundary > 0) {
    const gt = html.indexOf('>', boundary);
    if (gt > 0) return html.slice(0, gt + 1);
  }
  const lastGt = slice.lastIndexOf('>');
  return lastGt > 0 ? html.slice(0, lastGt + 1) : '';
}

/**
 * Sanitize a travel's stored description HTML into a compact, crawler-safe
 * fragment: drops scripts/styles/media, keeps semantic text tags, strips all
 * attributes (except safe <a href>), and clamps length. External links get
 * rel="nofollow noopener"; internal (site-relative / metravel.by) links stay
 * followable so internal link equity flows (helps indexing & crawl depth).
 */
function sanitizeArticleBodyHtml(rawHtml, maxChars = SSG_ARTICLE_BODY_MAX_CHARS) {
  let html = String(rawHtml || '');
  if (!html.trim()) return '';

  // 1. Remove dangerous and heavy blocks together with their content.
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .replace(/<video[\s\S]*?<\/video>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<source[^>]*>/gi, '');

  // 2. Whitelist tags; drop everything else but keep its inner text.
  html = html.replace(/<(\/?)([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (m, slash, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!SSG_ALLOWED_TAGS.has(t)) return '';
    if (t === 'br') return '<br/>';
    if (slash) return `</${t}>`;
    if (t === 'a') {
      const hrefMatch = attrs.match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      let href = hrefMatch ? (hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '').trim() : '';
      if (/^\s*(javascript:|data:|vbscript:)/i.test(href)) href = '';
      // Keep only absolute http(s) or site-relative links; drop other relatives.
      if (href && !/^https?:\/\//i.test(href) && !href.startsWith('/')) href = '';
      if (!href) return '<a>';
      const isInternal = href.startsWith('/') || /^https?:\/\/(www\.)?metravel\.by/i.test(href);
      const rel = isInternal ? '' : ' rel="nofollow noopener"';
      return `<a href="${escapeHtmlAttr(href)}"${rel}>`;
    }
    return `<${t}>`; // strip all attributes from other allowed tags
  });

  // 3. Collapse whitespace, drop empty blocks, trim.
  html = html
    .replace(/\s+/g, ' ')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<li>\s*<\/li>/gi, '')
    .replace(/>\s+</g, '><')
    .trim();

  return clampHtmlAtBlock(html, maxChars);
}


/**
 * Build travel detail skeleton HTML with inline LCP <img>.
 *
 * The <img> is the LCP element — Chrome paints it before any JS runs,
 * so LCP fires immediately after the preload-link image arrives.
 * After React hydrates, the removal script tears the skeleton down and
 * React's own hero (same image, already cached) takes over.
 *
 * @param {object} opts
 * @param {object|null} opts.heroPreload - { mobile: { href, srcSet, sizes }, desktop: {...} }
 * @param {string} opts.name - Travel name (used as alt + visually-hidden h1)
 */
/** Build a crawlable "Похожие путешествия" internal-links block (FE-IDX-3). */
function buildRelatedBlock(related) {
  if (!Array.isArray(related) || related.length === 0) return '';
  const items = related
    .filter((r) => r && r.path && r.name)
    .map((r) => `<li><a href="${escapeHtmlAttr(r.path)}">${escapeHtmlAttr(r.name)}</a></li>`)
    .join('');
  if (!items) return '';
  return `<nav class="ssg-travel-related" aria-label="Похожие путешествия"><h2>Похожие путешествия</h2><ul>${items}</ul></nav>`;
}

function buildTravelSkeletonHtml({ heroPreload, name, descriptionHtml, related } = {}) {
  let heroImg = '';
  if (heroPreload?.mobile?.href || heroPreload?.desktop?.href) {
    const desktop = heroPreload.desktop || heroPreload.mobile;
    const mobile = heroPreload.mobile || heroPreload.desktop;
    const sources = [];
    if (mobile?.href) {
      sources.push(
        `<source media="(max-width: 767px)" srcset="${escapeHtmlAttr(mobile.srcSet || mobile.href)}" sizes="${escapeHtmlAttr(mobile.sizes || '100vw')}"/>`
      );
    }
    if (desktop?.href) {
      sources.push(
        `<source media="(min-width: 768px)" srcset="${escapeHtmlAttr(desktop.srcSet || desktop.href)}" sizes="${escapeHtmlAttr(desktop.sizes || '720px')}"/>`
      );
    }
    const fallback = desktop?.href || mobile?.href;
    heroImg =
      `<picture>${sources.join('')}` +
      `<img class="ssg-travel-hero-img" src="${escapeHtmlAttr(fallback)}" alt="${escapeHtmlAttr(name || 'Фотография маршрута')}" decoding="async" fetchpriority="high" data-lcp data-ssg-lcp="true"/></picture>`;
  }
  // #1208: один растр на hero. Раньше поля letterbox заливали два `<div>` с
  // размытым LQIP того же фото (#1143) — отдельный сетевой запрос и отдельный
  // декод ради полосок по краям. Теперь поля заливает `dominant_color` прямо на
  // контейнере hero: он приходит манифестом, рисуется первым же кадром и не
  // может стать LCP-кандидатом. Рантайм-hero делает ровно то же самое.
  const heroFillColor = heroPreload?.fill?.color || '';
  const heroFillStyle = heroFillColor
    ? ` style="background-color:${escapeHtmlAttr(heroFillColor)}"`
    : '';
  const heroBlock = heroImg
    ? `<div class="ssg-travel-hero"${heroFillStyle}>${heroImg}<div class="ssg-travel-hero-bg"></div></div>`
    : `<div class="ssg-travel-hero ssg-pulse"></div>`;

  // FE-IDX-1/#1359: render the REAL title/article/related links into ordinary
  // raw DOM nodes so crawlers see substantive content. They stay in normal flow
  // after a viewport-sized first-screen block, so the first paint mirrors the
  // React hero and author/meta geometry without hiding indexable content.
  // The title is NOT an <h1>: the single semantic <h1> stays the out-of-flow
  // one injected before #root by injectHiddenH1.
  const titleText = String(name || '').trim();
  const titleBlock = titleText ? `<div class="ssg-travel-h1">${escapeHtmlAttr(titleText)}</div>` : '';
  const articleHtml = sanitizeArticleBodyHtml(descriptionHtml);
  const crawlableContentBlock = articleHtml
    ? `<div class="ssg-travel-article">${articleHtml}</div>`
    : `<div class="ssg-travel-title ssg-pulse"></div>
<div class="ssg-travel-meta ssg-pulse"></div>
<div class="ssg-travel-line w90 ssg-pulse"></div>
<div class="ssg-travel-line w75 ssg-pulse"></div>
<div class="ssg-travel-line w60 ssg-pulse"></div>
<div class="ssg-travel-line w90 ssg-pulse"></div>
<div class="ssg-travel-line w75 ssg-pulse"></div>`;

  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo">MeTravel</div></div>
<div class="ssg-travel-spacer"></div>
<div class="ssg-travel-wrap">
<div class="ssg-travel-first-screen">
<aside class="ssg-travel-desktop-sidebar" aria-hidden="true">
<div class="ssg-travel-sidebar-card"><div class="ssg-travel-sidebar-avatar ssg-pulse"></div><div class="ssg-travel-sidebar-copy"><div class="ssg-travel-sidebar-line w55 ssg-pulse"></div><div class="ssg-travel-sidebar-line w75 ssg-pulse"></div></div></div>
<div class="ssg-travel-sidebar-nav"><div class="ssg-travel-sidebar-nav-line ssg-pulse"></div><div class="ssg-travel-sidebar-nav-line ssg-pulse"></div><div class="ssg-travel-sidebar-nav-line ssg-pulse"></div><div class="ssg-travel-sidebar-nav-line ssg-pulse"></div><div class="ssg-travel-sidebar-nav-line ssg-pulse"></div></div>
</aside>
<div class="ssg-travel-primary">
${heroBlock}
<div class="ssg-travel-author-skeleton" aria-hidden="true">
<div class="ssg-travel-author-avatar ssg-pulse"></div>
<div class="ssg-travel-author-copy"><div class="ssg-travel-author-label ssg-pulse"></div><div class="ssg-travel-author-name ssg-pulse"></div></div>
<div class="ssg-travel-author-actions"><div class="ssg-travel-author-action ssg-pulse"></div><div class="ssg-travel-author-action ssg-pulse"></div></div>
</div>
<div class="ssg-travel-meta-row" aria-hidden="true"><div class="ssg-travel-meta-chip ssg-pulse"></div><div class="ssg-travel-meta-chip ssg-pulse"></div><div class="ssg-travel-meta-chip ssg-pulse"></div></div>
</div>
</div>
<div class="ssg-travel-crawlable">
${titleBlock}
${crawlableContentBlock}
${buildRelatedBlock(related)}
</div>
</div>
${buildRemovalScript()}
</div>`;
}

/**
 * Inject a skeleton shell into an HTML string for a given route.
 * Routes with skeletons: `/`, `/search`, `/map`, `/travels/[slug]`.
 *
 * @param {string} html - Base HTML string
 * @param {string} route - Route path (e.g. '/', '/search', '/travels/<slug>')
 * @param {object} [ctx] - Route-specific context (heroPreload, name for travel)
 * @returns {string} HTML with skeleton injected (or unchanged)
 */
function injectSkeletonShell(html, route, ctx) {
  let skeleton = '';
  if (route === '/') {
    skeleton = buildHomeSkeletonHtml(ctx || {});
  } else if (route === '/search') {
    skeleton = buildSearchSkeletonHtml();
  } else if (route === '/map') {
    skeleton = buildMapSkeletonHtml();
  } else if (typeof route === 'string' && route.startsWith('/travels/')) {
    skeleton = buildTravelSkeletonHtml(ctx || {});
  }

  if (!skeleton) return html;

  // Both injections MUST use a replacer function, never a replacement string.
  // In a replacement string `$&`, `` $` ``, `$'` and `$1` are substitution
  // patterns, and the shell legitimately contains them: `$'` appears in any
  // `'…$'` literal inside the removal script, and the travel shell embeds the
  // article body straight from the database, where a `$'`/`$&` in the prose is
  // ordinary text. With a string replacement each occurrence expands into the
  // surrounding document — one 133-byte page grew to 22 324 bytes with three
  // duplicated `#root` nodes and a truncated inline script (#1356).
  const css = buildSkeletonCSS();
  let result = html.replace('</head>', () => `${css}\n</head>`);
  result = result.replace(/(<body[^>]*>)/i, (bodyTag) => `${bodyTag}\n${skeleton}`);

  return result;
}

module.exports = {
  buildSkeletonCSS,
  buildHomeSkeletonHtml,
  buildSearchSkeletonHtml,
  buildMapSkeletonHtml,
  buildTravelSkeletonHtml,
  injectSkeletonShell,
  buildRemovalScript,
  sanitizeArticleBodyHtml,
  SSG_ARTICLE_BODY_MAX_CHARS,
  COLORS,
};
