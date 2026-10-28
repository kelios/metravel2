// Canonical responsive-home CSS, generated into app/global.css before publication.
// Keep derived values in their shared pure owners; this module is build-time only.
const { buildHomeBookGeometryCSS } = require('../../components/home/homeBookGeometryCss')
const { homeWebScrollEndPadding } = require('../../components/home/homeScrollDockClip')
const { HOME_BOOK_GEOMETRY } = require('../../components/home/homeBookGeometry')
const { QUEST_TILE_MEDIA_SIZE, QUEST_TILE_MEDIA_SIZE_COMPACT } = require('../../components/quests/questCoverTileGeometry')

const hero = '[data-home-responsive-hero="true"]';
const book = `${hero} [data-home-book-wrapper]`;
const left = `${hero} [data-home-book-left]`;
const media = `${hero} [data-home-book-media]`;

function buildHomeResponsiveCss() {
  return `
[data-home-runtime-layout]{--home-gap-hero:28px;--home-gap-weekends:36px;--home-gap-sections:40px;--home-gap-faq:48px;--home-gap-final:24px;--home-height-weekends:520px;--home-height-feed:500px;--home-scroll-end:${homeWebScrollEndPadding(96)}}
${hero}{padding-top:8px!important;padding-bottom:16px!important}
${hero} [data-home-hero-container]{padding:8px 16px!important;max-width:1920px!important}
${book}{position:relative!important;display:flex!important;flex-direction:column!important;gap:0!important;width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0 auto!important;background-image:none!important;visibility:visible!important;overflow:visible!important}
${hero} [data-home-book-row],${hero} [data-home-book-right]{display:contents!important}
${left}{position:relative!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:0!important;height:auto!important;padding:28px 20px!important;gap:0!important;background:var(--color-surfaceMuted,var(--color-surface))!important;border-radius:8px!important;overflow:visible!important}
${hero} [data-home-book-frame]{width:100%!important;height:auto!important;max-height:none!important;flex:0 0 auto!important;overflow:visible!important}
${hero} [data-home-book-content]{width:100%!important;min-width:0!important;flex-shrink:0!important}
${hero} [data-home-book-heading]{display:block!important}
${hero} [data-home-book-title]{font-family:system-ui,-apple-system,sans-serif!important;font-size:32px!important;line-height:1.25!important;color:var(--color-text)!important;white-space:normal!important}
${hero} [data-home-book-accent]{color:var(--color-brandText,var(--color-primary))!important}
${hero} [data-home-book-subtitle]{font-family:system-ui,-apple-system,sans-serif!important;font-size:16px!important;line-height:24px!important;max-width:100%!important;margin-top:12px!important;color:var(--color-textMuted,var(--color-text-muted))!important}
${hero} [data-home-book-controls]{width:100%!important;min-width:0!important;margin-top:16px!important;margin-bottom:0!important;gap:12px!important}
${hero} [data-home-book-search],${hero} [data-home-book-search] input,${hero} [data-home-book-search] [role="button"],${hero} [data-home-book-cta] [role="button"]{min-height:44px!important;flex-shrink:0!important}
${hero} [data-home-book-search] input{color:var(--color-text)!important}
${hero} [data-home-book-cta]{display:flex!important;flex-direction:column!important;width:100%!important;align-items:stretch!important}
${hero} [data-home-book-cta]>div{width:100%!important;min-height:44px!important}
${hero} [data-home-book-chapter],${hero} [data-home-book-notes],${hero} [data-home-book-tablet],${hero} [data-home-book-decoration],${hero} [data-home-book-slider-nav]{display:none!important}
${media}{position:relative!important;display:flex!important;grid-column:auto;grid-row:auto;box-sizing:border-box!important;top:auto!important;width:100%!important;max-width:none!important;height:auto!important;aspect-ratio:3/2!important;margin:32px 0 0!important;align-self:stretch!important;border-radius:24px!important;overflow:hidden!important}
${media} [data-book-slider]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important}
${media} [data-home-primary-slide]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important}
@media(max-width:1279.98px){
${media} [data-home-primary-overlay]{padding:64px 24px 22px!important;background-image:linear-gradient(to top,rgba(12,10,8,.94) 0%,rgba(12,10,8,.60) 45%,rgba(12,10,8,.20) 70%,transparent 100%)!important}
${media} [data-home-primary-caption]{max-width:100%!important}
${media} [data-home-primary-title]{font-family:system-ui,-apple-system,sans-serif!important;font-size:20px!important;line-height:1.25!important}
${media} [data-home-primary-eyebrow]{font-family:system-ui,-apple-system,sans-serif!important}
${media} [data-home-primary-subtitle]{font-family:system-ui,-apple-system,sans-serif!important;font-size:13px!important;color:rgba(255,255,255,.85)!important;letter-spacing:.3px!important}
${media} [data-home-primary-action]{display:none!important}
}
${hero} [data-home-responsive-mood-rail]{width:100%!important;margin-top:0!important}
${hero} [data-home-responsive-mood-rail]>div{margin-top:20px!important;border-top:1px solid var(--color-borderAccent)!important}
${hero} [data-home-responsive-mood-rail] [role="button"]{background:var(--color-surface)!important;border-color:var(--color-borderAccent)!important}
${hero} [data-home-responsive-mood-rail] [role="button"]>:last-child{font-family:system-ui,-apple-system,sans-serif!important;color:var(--color-text)!important}
${hero} [data-home-responsive-popular]{width:100%!important;margin-top:28px!important}
${hero} [data-home-popular-section]{margin-top:0!important}
${hero} [data-home-responsive-popular] [data-home-popular-grid]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
${hero} [data-home-responsive-popular] [data-home-popular-grid]>*{width:100%!important;max-width:100%!important;min-width:0!important}
${hero} [data-home-popular-content]{padding:10px!important}
${hero} [data-home-popular-title]{font:700 14px/18px system-ui,-apple-system,sans-serif!important;color:var(--color-text)!important}
${hero} [data-home-popular-subtitle]{font:400 12px/16px system-ui,-apple-system,sans-serif!important;color:var(--color-textMuted,var(--color-text-muted))!important}
${hero} [data-home-popular-see-all]{display:none!important}
[data-home-quest-promo]{padding:12px 0!important}
[data-home-quest-container]{padding:16px!important;max-width:1200px!important}
[data-home-quest-header]{gap:6px!important;margin-bottom:20px!important}
[data-home-quest-title]{font-size:24px!important}
[data-home-quest-subtitle]{font-size:14px!important}
[data-home-quest-grid]{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:16px!important}
[data-home-quest-grid]>*{width:100%!important;min-width:0!important}
[data-home-quest-grid]>*:nth-child(n+5){display:none!important}
[data-home-quest-promo] [data-quest-card-media]{width:${QUEST_TILE_MEDIA_SIZE}px!important;height:${QUEST_TILE_MEDIA_SIZE}px!important}
[data-home-quest-promo] [data-quest-card-arrow],[data-home-quest-scenario-cta]{display:none!important}
[data-home-quest-scenario]{gap:12px!important;margin-top:16px!important;padding:12px 14px!important}
@media(max-width:479.98px){[data-home-quest-promo] [data-quest-card-media]{width:${QUEST_TILE_MEDIA_SIZE_COMPACT}px!important;height:${QUEST_TILE_MEDIA_SIZE_COMPACT}px!important}}
@media(max-width:374px){${hero} [data-home-book-title]{font-size:28px!important;line-height:34px!important}}
@media(min-width:768px){[data-home-runtime-layout]{--home-gap-hero:48px;--home-gap-weekends:64px;--home-gap-sections:72px;--home-gap-faq:80px;--home-gap-final:40px;--home-height-weekends:560px;--home-height-feed:540px;--home-scroll-end:${homeWebScrollEndPadding(120)}}
[data-home-quest-promo]{padding:24px 0!important}
[data-home-quest-container]{padding:32px 48px!important}
[data-home-quest-header]{gap:10px!important;margin-bottom:32px!important}
[data-home-quest-title]{font-size:34px!important}
[data-home-quest-subtitle]{font-size:16px!important}
[data-home-quest-grid]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
[data-home-quest-grid]>*:nth-child(n+5){display:flex!important}
[data-home-quest-promo] [data-quest-card-arrow],[data-home-quest-scenario-cta]{display:flex!important}
[data-home-quest-scenario]{gap:16px!important;margin-top:24px!important;padding:16px 20px!important}}
@media(min-width:768px) and (max-width:769.98px){
${hero} [data-home-popular-see-all]{display:flex!important}
${hero} [data-home-responsive-popular] [data-home-popular-grid]{grid-template-columns:repeat(3,minmax(0,1fr))!important}
${hero} [data-home-popular-grid]>*:nth-child(n+4){display:none!important}
}
@media(min-width:770px) and (max-width:1279.98px){
${hero} [data-home-hero-container]{padding:24px!important}
${book}{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:32px!important;row-gap:0!important}
${left}{grid-column:1!important;grid-row:1!important;justify-content:center!important;padding:0!important;background:transparent!important}
${media}{grid-column:2!important;grid-row:1!important;align-self:center!important;margin-top:0!important;border-radius:20px!important}
${hero} [data-home-book-tablet]{display:flex!important}
${hero} [data-home-responsive-mood-rail]{grid-column:1/-1!important;grid-row:2!important}
${media} [data-home-primary-overlay]{padding:48px 20px 18px!important;background-image:linear-gradient(to top,rgba(12,10,8,.92) 0%,rgba(12,10,8,.55) 50%,rgba(12,10,8,.15) 75%,transparent 100%)!important}
${media} [data-home-primary-title]{font-family:Baskerville,Georgia,serif!important;font-size:22px!important}
${media} [data-home-primary-subtitle]{font-family:Baskerville,Georgia,serif!important}
${media} [data-home-primary-eyebrow]{font-family:Baskerville,Georgia,serif!important}
${hero} [data-home-responsive-popular]{display:none!important}
}
@media(min-width:1280px){
${hero}{padding-top:20px!important;padding-bottom:24px!important}
${hero} [data-home-hero-container]{padding:32px 40px!important;max-width:none!important}
${book}{display:grid!important;gap:0!important;background-image:var(--image-homeHeroBook)!important;background-size:100% 100%!important;background-repeat:no-repeat!important;border-radius:0!important;overflow:hidden!important}
${left}{grid-column:1!important;grid-row:1!important;align-self:stretch!important;height:100%!important;max-height:100%!important;background:transparent!important;border-radius:0!important;overflow:hidden!important}
${hero} [data-home-book-frame]{height:100%!important;max-height:100%!important;flex:1 1 auto!important;overflow-y:auto!important;overflow-x:hidden!important}
${hero} [data-home-book-title]{font-family:Baskerville,Georgia,serif!important;white-space:pre-wrap!important;color:var(--color-bookPageText)!important}
${hero} [data-home-book-accent]{color:var(--color-bookPageAccent)!important}
${hero} [data-home-book-subtitle]{font-family:Baskerville,Georgia,serif!important;max-width:88%!important;margin-top:10px!important;color:var(--color-bookPageTextMuted)!important}
${hero} [data-home-book-search] input{color:var(--color-bookPageText)!important}
${hero} [data-home-book-chapter],${hero} [data-home-book-notes]{display:flex!important}
${hero} [data-home-book-notes]>div{margin-top:14px!important;margin-bottom:0!important;max-width:100%!important}
${hero} [data-home-book-note-text]{font-size:13px!important;line-height:16px!important}
${hero} [data-home-book-note-meta]{display:none!important}
${hero} [data-home-book-page-number]{display:block!important;position:absolute!important;bottom:calc(var(--home-book-height) * ${HOME_BOOK_GEOMETRY.pageNumberBottomShare})!important}
${hero} [data-home-book-page-number="left"]{left:calc(var(--home-book-width) * ${HOME_BOOK_GEOMETRY.leftPageStartShare})!important}
${hero} [data-home-book-page-number="right"]{right:calc(var(--home-book-width) * ${HOME_BOOK_GEOMETRY.rightPageEndShare})!important}
${hero} [data-home-book-controls]{margin-top:12px!important;margin-bottom:0!important;gap:10px!important}
${media}{grid-column:2!important;grid-row:1!important;align-self:start!important;border-radius:12px!important;aspect-ratio:3/2!important;height:auto!important;margin-top:0!important;margin-bottom:0!important}
${hero} [data-home-book-slider-nav]{display:flex!important}
${hero} [data-home-responsive-mood-rail],${hero} [data-home-responsive-popular],${hero} [data-home-book-tablet]{display:none!important}
}
@media(min-width:1280px) and (min-height:1000px){${hero} [data-home-book-note-meta]{display:block!important}}
${buildHomeBookGeometryCSS({ book, page: left, title: `${hero} [data-home-book-title]`, subtitle: `${hero} [data-home-book-subtitle]`, week: media }, { important: true })}
`
}

module.exports = { buildHomeResponsiveCss }
