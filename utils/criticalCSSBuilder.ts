import { DESIGN_COLORS } from '@/constants/designSystem';

/**
 * Build critical CSS string for the HTML shell.
 *
 * Extracted from app/+html.tsx so that Babel/Metro does not attempt to parse
 * CSS selector syntax (e.g. `*,*::before,*::after`) inside a JSX-adjacent
 * template literal, which causes SyntaxError in some Metro/Babel versions.
 */
export function buildCriticalCSS(): string {
  const TL = DESIGN_COLORS.criticalTextLight;
  const BL = DESIGN_COLORS.criticalBgLight;
  const BSL = DESIGN_COLORS.criticalBgSecondaryLight;
  const SL = DESIGN_COLORS.criticalSurfaceLight;
  const FL = DESIGN_COLORS.criticalFocusLight;
  const TD = DESIGN_COLORS.criticalTextDark;
  const BD = DESIGN_COLORS.criticalBgDark;
  const BSD = DESIGN_COLORS.criticalBgSecondaryDark;
  const SD = DESIGN_COLORS.criticalSurfaceDark;
  const FD = DESIGN_COLORS.criticalFocusDark;
  const BTL = DESIGN_COLORS.criticalBgTertiaryLight;

  return [
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
    'html{scroll-behavior:smooth;height:100%;scrollbar-gutter:stable;-webkit-text-size-adjust:100%;-moz-text-size-adjust:100%;text-size-adjust:100%;background-color:var(--color-background,' + BL + ')}',
    'body{',
    '  margin:0;',
    '  min-height:100vh;',
    '  min-height:-webkit-fill-available;',
    "  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;",
    '  font-display:swap;',
    '  line-height:1.6;',
    '  -webkit-font-smoothing:antialiased;',
    '  -moz-osx-font-smoothing:grayscale;',
    '  text-rendering:optimizeSpeed;',
    '  color:var(--color-text,' + TL + ');',
    '  background:linear-gradient(180deg,var(--color-background,' + BL + ') 0%,var(--color-backgroundSecondary,' + BSL + ') 40%,var(--color-surface,' + SL + ') 100%);',
    '  padding-bottom:env(safe-area-inset-bottom);',
    '  overflow-y:scroll;',
    '  overflow-x:hidden;',
    '}',
    'img,picture,video,canvas,svg{display:block;max-width:100%;height:auto}',
    'svg[viewBox="0 0 32 32"][width="100%"][height="100%"]{width:32px;height:32px;max-width:none;max-height:none;display:inline-block}',
    'img{width:100%;font-style:italic;vertical-align:middle}',
    'input,button,textarea,select{font:inherit;color:inherit}',
    'button{cursor:pointer;background:transparent;border:0}',
    'button:focus-visible,a:focus-visible{outline:2px solid var(--color-focus,' + FL + ');outline-offset:2px}',
    'a{color:inherit;text-decoration:none}',
    '[hidden]{display:none !important}',
    'img[data-lcp]{min-height:300px;background:var(--color-backgroundSecondary,' + BSL + ');aspect-ratio:16/9}',
    'img[width][height]{height:auto}',
    'img[fetchpriority="high"]{display:block}',
    'img[loading="lazy"]{content-visibility:auto;contain-intrinsic-size:auto 300px}',
    '#root,#root>div,#root>div>div{min-height:100vh;width:100%}',
    '[data-testid="travel-details-page"]{min-height:100vh;contain:layout style}',
    '[data-testid="travel-details-hero"]{min-height:300px;contain:layout style paint;background:var(--color-backgroundSecondary,' + BSL + ')}',
    '[data-testid="travel-details-hero"] img{aspect-ratio:16/9;width:100%;max-width:860px;object-fit:contain}',
    '[data-testid="main-header"]{min-height:56px;contain:layout style;position:sticky;top:0;z-index:2000;width:100%}',
    '[data-testid="home-hero"]{contain:layout style}',
    '[data-testid="home-trust-block"]{content-visibility:auto;contain-intrinsic-size:auto 220px}',
    '[data-testid="home-how-it-works"]{content-visibility:auto;contain-intrinsic-size:auto 420px}',
    '[data-testid="home-hero-stack"]{min-height:400px;contain:layout style paint;display:flex;flex-direction:column !important;width:100%}',
    '@media (min-width:768px){[data-testid="home-hero-stack"]{flex-direction:row !important;align-items:center}}',
    '[data-testid="home-hero-image-slot"]{display:none}',
    '@media (min-width:768px){[data-testid="home-hero-image-slot"]{display:flex !important;justify-content:center;align-items:center;flex:1;min-width:320px}}',
    '@media (min-width:768px){[data-testid="home-hero-image-slot"] > *{width:320px;height:400px}}',
    '[data-testid="home-hero-stack"] img{width:320px;height:400px;aspect-ratio:4/5;object-fit:cover}',
    '[data-testid*="travel-gallery"] img{aspect-ratio:16/9;contain:layout style paint;object-fit:cover}',
    '[style*="minHeight"]{contain:layout style paint}',
    '[role="img"]:not([aria-label]){font-size:0}',
    '@media (prefers-reduced-motion: reduce){',
    '  html{scroll-behavior:auto}',
    '  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important}',
    '}',
    'html[data-theme="dark"]{color-scheme:dark;--color-text:' + TD + ';--color-background:' + BD + ';--color-backgroundSecondary:' + BSD + ';--color-surface:' + SD + ';--color-focus:' + FD + '}',
    'html[data-theme="light"]{color-scheme:light;--color-text:' + TL + ';--color-background:' + BL + ';--color-backgroundSecondary:' + BSL + ';--color-surface:' + SL + ';--color-focus:' + FL + '}',
    ':focus-visible{outline:2px solid var(--color-focus,' + FL + ');outline-offset:2px}',
    '::selection{background-color:rgba(0,102,204,0.3);color:inherit}',
    '@media (max-width:768px){',
    '  html{height:100%;height:-webkit-fill-available;font-size:100%}',
    '  body{min-height:100vh;min-height:-webkit-fill-available;padding-bottom:calc(env(safe-area-inset-bottom) + 80px)}',
    '  img[data-lcp]{min-height:240px;aspect-ratio:16/9;background:var(--color-backgroundTertiary,' + BTL + ')}',
    '  [data-testid="travel-details-hero"]{min-height:240px}',
    '  [data-card]{margin-bottom:16px;width:100%;max-width:100%;contain:layout style paint}',
    '  [data-card] img{height:200px;object-fit:cover;width:100%;aspect-ratio:16/9}',
    '}',
    '@media (min-width:769px){',
    '  body{font-size:16px}',
    '}',
    '@supports (padding-bottom: env(safe-area-inset-bottom)){',
    '  body{padding-bottom:env(safe-area-inset-bottom)}',
    '}',
    '[data-testid="footer-dock-row"],[data-testid="footer-desktop-bar"]{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;align-items:center !important}',
    '[data-testid="footer-dock-row"]{justify-content:center !important}',
    '[data-testid="footer-desktop-bar"]{justify-content:space-between !important}',
    '[data-testid^="footer-item-"]{display:inline-flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;flex:0 0 auto !important}',
    '.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
    '[data-testid="map-container"]{min-height:400px;contain:layout style;background:var(--color-backgroundSecondary,' + BSL + ')}',
    '[data-testid="map-container"],[data-testid="map-leaflet-wrapper"],.leaflet-container,.leaflet-control-container{contain:none !important}',
    '[data-testid="search-container"]{min-height:100vh;contain:layout style}',
    '[data-testid="travel-card"]{contain:layout style paint;will-change:auto}',
    '[data-testid="travel-details-description"]{content-visibility:auto;contain-intrinsic-size:auto 400px}',
    '[data-testid="travel-details-map"]{content-visibility:auto;contain-intrinsic-size:auto 500px}',
    '[data-testid="travel-details-points"]{content-visibility:auto;contain-intrinsic-size:auto 300px}',
    '[data-testid="travel-details-author"]{content-visibility:auto;contain-intrinsic-size:auto 200px}',
    '[data-testid="travel-details-author-mobile"]{content-visibility:auto;contain-intrinsic-size:auto 200px}',
    '[data-testid="travel-details-quick-facts"]{content-visibility:auto;contain-intrinsic-size:auto 80px}',
    '[data-testid="map-skeleton"],[data-testid="search-skeleton"]{animation:pulse 1.5s ease-in-out infinite}',
    '@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}',
    // CSS-only skeleton shimmer for header and hero — visible before JS loads.
    // Once React hydrates it replaces these elements, so no CLS.
    '@keyframes crit-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}',
    '[data-testid="main-header"]{background:var(--color-background,' + BL + ');border-bottom:1px solid var(--color-backgroundSecondary,' + BSL + ')}',
    '[data-testid="home-hero-stack"]{background:var(--color-background,' + BL + ')}',
  ].join('\n');
}
