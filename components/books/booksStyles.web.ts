import {DESIGN_TOKENS} from '@/constants/designSystem';
export const booksCss=`
.ready-books{max-width:1120px;margin:auto;padding:24px 16px 64px;overflow-wrap:anywhere;line-height:1.55}
.ready-books h1{font-size:32px;line-height:1.2;margin:0 0 16px}.ready-books h2{font-size:22px;margin:24px 0 12px}
.ready-books a{color:inherit;text-decoration:underline;min-height:44px;display:inline-flex;align-items:center}
.ready-books button,.ready-books select,.ready-books input{font:inherit;min-height:44px;max-width:100%}
.ready-books button{cursor:pointer}.ready-books :focus-visible{outline:3px solid currentColor;outline-offset:3px}
.ready-books-note{border:1px solid currentColor;padding:16px;border-radius:${DESIGN_TOKENS.radii.md}px}.ready-books-note h2{margin-top:0}.ready-books summary{cursor:pointer;min-height:44px}
.ready-books-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:16px 0}.ready-books-controls label{display:flex;gap:8px;align-items:center;min-height:44px}.ready-books fieldset.ready-books-controls{padding:12px 16px;border:1px solid currentColor;border-radius:${DESIGN_TOKENS.radii.md}px;min-width:0}
.ready-books-pages{display:flex;gap:12px;align-items:flex-start;overflow:auto;min-height:280px}.ready-books-paper{position:relative;flex:1;min-width:0;display:flex;align-items:center;justify-content:center;border:1px solid currentColor}.ready-books-paper img{width:100%;display:block}
.ready-books-preview{padding:20px;border:1px solid currentColor;border-radius:${DESIGN_TOKENS.radii.lg}px;margin-top:20px}
.ready-books-files{list-style:none;padding:0}.ready-books-files li{padding:16px 0;border-bottom:1px solid currentColor;display:flex;flex-wrap:wrap;gap:12px;align-items:center}.ready-books-files li>span{flex:1;min-width:180px}.ready-books a.ready-books-download{text-decoration:none;justify-content:center;padding:0 20px;border:1px solid currentColor;border-radius:${DESIGN_TOKENS.radii.md}px;font-weight:600}
@media(min-width:800px){.ready-books{padding:48px 32px 80px}.ready-books h1{font-size:40px}}
`;

const c=DESIGN_TOKENS.colors,r=DESIGN_TOKENS.radii,sp=DESIGN_TOKENS.spacing,sh=DESIGN_TOKENS.shadows,ty=DESIGN_TOKENS.typography.scale;
// The caps scale is destructured: a `.label` read at module load is reserved for UI copy (#2156).
const {label:capsScale}=ty;
const type=(scale:{fontSize:number;lineHeight:number;letterSpacing:number;fontWeight:string})=>`font-size:${scale.fontSize}px;line-height:${scale.lineHeight}px;letter-spacing:${scale.letterSpacing}px;font-weight:${scale.fontWeight}`;
/**
 * Edition page (#2948, design `docs/design/travel-memory-books-v1/edition-page-2026-11-02.md`).
 * Every colour is a theme token (`var(--color-*)` on web), so the dark theme needs no override.
 * Rules are scoped under `.rbe` so they win over the shared `.ready-books a/h2` defaults.
 */
export const editionCss=`
.rbe{color:${c.text}}
.rbe img{display:block;max-width:100%}
.rbe :focus-visible{outline:3px solid ${c.primaryText};outline-offset:3px}
.rbe p{margin:0}
.rbe ul,.rbe ol{margin:0;padding:0;list-style:none}
.rbe .rbe-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.rbe .rbe-i{display:inline-flex;flex:none;line-height:0}
.rbe .rbe-block{padding:${sp.xxl}px 0;border-top:1px solid ${c.borderStrong}}
.rbe .rbe-block:focus{outline:none}
.rbe h2{${type(ty.h1)};margin:0 0 ${sp.xs}px}
.rbe h3,.rbe .rbe-h3{${type(ty.h3)};margin:0}
.rbe .rbe-h3{display:block}
.rbe .rbe-lead{color:${c.textMuted};margin:0 0 ${sp.lg}px;max-width:640px}
.rbe .rbe-small{${type(ty.bodySmall)};color:${c.textMuted}}
.rbe .rbe-label{${type(capsScale)};text-transform:uppercase;color:${c.textMuted};margin:${sp.lg}px 0 ${sp.sm}px;padding:0}
.rbe .rbe-state{margin:0 0 ${sp.lg}px}
.rbe .rbe-btn{display:inline-flex;align-items:center;justify-content:center;gap:${sp.xs}px;min-height:48px;padding:0 ${sp.lg}px;border-radius:${r.md}px;${type(ty.bodyStrong)};border:1px solid transparent;cursor:pointer;text-decoration:none;white-space:nowrap;box-sizing:border-box;font-family:inherit}
.rbe .rbe-btn:disabled{opacity:.55;cursor:not-allowed}
.rbe .rbe-btn-primary{background:${c.primary};color:${c.textOnPrimary};box-shadow:${sh.card}}
.rbe .rbe-btn-primary:hover{background:${c.primaryDark}}
.rbe .rbe-btn-secondary{background:${c.surface};color:${c.text};border-color:${c.borderStrong};box-shadow:${sh.card}}
.rbe .rbe-btn-outline{background:transparent;color:${c.primaryText};border-color:${c.primary}}
.rbe .rbe-btn-sm{min-height:44px;padding:0 ${sp.md}px;font-size:14px}
.rbe .rbe-link{background:none;border:0;padding:0;color:${c.primaryText};font-weight:600;font-size:14px;min-height:44px;display:inline-flex;align-items:center;gap:6px;text-decoration:none;cursor:pointer}
.rbe-hero{display:grid;gap:${sp.xl}px;align-items:center;padding:${sp.md}px 0 ${sp.xxl}px}
.rbe .rbe-eyebrow{${type(capsScale)};text-transform:uppercase;color:${c.primaryText};margin:0 0 ${sp.sm}px}
.rbe .rbe-hero h1{${type(ty.display)};margin:0 0 ${sp.sm}px}
.rbe .rbe-promise{font-size:18px;line-height:28px;margin:0 0 ${sp.lg}px;max-width:520px}
.rbe .rbe-chips{display:flex;flex-wrap:wrap;gap:${sp.xs}px;margin:0 0 ${sp.lg}px}
.rbe .rbe-chips li{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 ${sp.sm}px;border-radius:${r.pill}px;background:${c.surface};border:1px solid ${c.borderStrong};${type(ty.bodySmall)};font-weight:600}
.rbe .rbe-chips li.is-accent{background:${c.primaryLight};border-color:transparent;color:${c.primaryText}}
.rbe .rbe-cta{display:flex;flex-wrap:wrap;gap:${sp.sm}px;margin-bottom:${sp.sm}px}
.rbe .rbe-cta-meta{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center}
.rbe-stage{position:relative;aspect-ratio:1.18;max-width:600px;width:100%;margin:0 auto}
.rbe-spread{position:absolute;display:flex;background:${c.backgroundTertiary};border-radius:4px;box-shadow:${sh.hover};overflow:hidden}
.rbe .rbe-spread img{width:50%;height:100%;object-fit:cover}
.rbe-spread::after{content:"";position:absolute;top:0;bottom:0;left:50%;width:24px;margin-left:-12px;background:linear-gradient(90deg,transparent,rgba(0,0,0,.10),transparent)}
.rbe-cover{position:absolute;border-radius:3px 8px 8px 3px;box-shadow:${sh.heavy};overflow:hidden;background:${c.backgroundTertiary}}
.rbe-cover::before{content:"";position:absolute;inset:0 auto 0 0;width:10px;background:linear-gradient(90deg,rgba(0,0,0,.14),transparent)}
.rbe .rbe-cover img{width:100%;height:100%;object-fit:cover}
.rbe-stage[data-size=pocket] .rbe-spread-1{width:74%;aspect-ratio:3;right:0;top:4%;transform:rotate(3deg)}
.rbe-stage[data-size=pocket] .rbe-spread-2{width:74%;aspect-ratio:3;left:0;bottom:3%;transform:rotate(-2.5deg)}
.rbe-stage[data-size=pocket] .rbe-cover{width:62%;aspect-ratio:1.5;left:19%;top:25%}
.rbe-stage[data-size=a5] .rbe-spread-1{width:56%;aspect-ratio:1.41;right:0;top:3%;transform:rotate(3deg)}
.rbe-stage[data-size=a5] .rbe-spread-2{width:56%;aspect-ratio:1.41;left:0;bottom:3%;transform:rotate(-2.5deg)}
.rbe-stage[data-size=a5] .rbe-cover{width:40%;aspect-ratio:.705;left:30%;top:7%}
.rbe .rbe-stage-caption{text-align:center;margin-top:${sp.sm}px}
.rbe .rbe-how{display:grid;gap:${sp.md}px;grid-template-columns:1fr}
.rbe .rbe-how>li{background:${c.surface};border-radius:${r.lg}px;box-shadow:${sh.card};overflow:hidden}
.rbe .rbe-how-page{background:${c.backgroundTertiary};padding:${sp.md}px}
.rbe .rbe-how-page img{width:100%;aspect-ratio:1.5;object-fit:contain;box-shadow:${sh.card};border-radius:2px}
.rbe .rbe-how-page[data-size=a5] img{aspect-ratio:.705;max-height:280px;margin:0 auto;width:auto}
.rbe .rbe-how-text{padding:${sp.md}px ${sp.md}px ${sp.lg}px}
.rbe .rbe-how-text p{margin:6px 0 0;color:${c.textMuted};font-size:14px;line-height:20px}
.rbe .rbe-step{display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;background:${c.primaryLight};color:${c.primaryText};font-size:12px;font-weight:800;margin-right:8px;vertical-align:1px}
.rbe .rbe-opt{position:relative;display:block;background:${c.surface};border:2px solid transparent;border-radius:${r.lg}px;box-shadow:${sh.card};text-align:left;padding:0;color:inherit;overflow:hidden;text-decoration:none;min-height:44px}
.rbe a.rbe-opt:hover,.rbe .rbe-size:hover{box-shadow:${sh.hover}}
.rbe .rbe-opt.is-checked{border-color:${c.primary}}
.rbe .rbe-opt-thumb{background:${c.backgroundTertiary};display:flex;align-items:center;justify-content:center;padding:${sp.md}px;aspect-ratio:1.35}
.rbe .rbe-opt-thumb img{max-height:100%;max-width:100%;box-shadow:${sh.hover};border-radius:2px}
.rbe .rbe-opt-body{display:block;padding:${sp.sm}px ${sp.md}px ${sp.md}px}
.rbe .rbe-opt-body .rbe-small{display:block;margin-top:2px}
.rbe .rbe-check{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;background:${c.primary};color:${c.textOnPrimary};display:none;align-items:center;justify-content:center;z-index:1}
.rbe .rbe-opt.is-checked .rbe-check{display:flex}
.rbe .rbe-styles{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -${sp.md}px;padding:4px ${sp.md}px ${sp.sm}px;gap:${sp.sm}px}
.rbe .rbe-styles>li{flex:0 0 62%;scroll-snap-align:start}
.rbe .rbe-styles .rbe-opt{height:100%}
.rbe .rbe-sizes-group{border:0;padding:0;margin:0;min-width:0}
.rbe .rbe-sizes{display:grid;gap:${sp.md}px;grid-template-columns:1fr;max-width:720px}
.rbe .rbe-size{display:flex;gap:${sp.md}px;align-items:center;padding:${sp.md}px 44px ${sp.md}px ${sp.md}px;cursor:pointer}
.rbe .rbe-size .rbe-opt-body{padding:0}
.rbe .rbe-size input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.rbe .rbe-size:has(input:focus-visible){outline:3px solid ${c.primaryText};outline-offset:3px}
.rbe .rbe-sil{flex:none;width:96px;height:96px;display:flex;align-items:center;justify-content:center}
.rbe .rbe-sil-paper{position:relative;background:${c.surface};border:2px solid currentColor;border-radius:3px;display:flex;align-items:center;justify-content:center}
.rbe .rbe-sil-photo{background:${c.primaryLight};border:1.5px dashed ${c.primaryText};border-radius:2px}
.rbe .rbe-sil-pocket .rbe-sil-paper{width:90px;height:60px}.rbe .rbe-sil-pocket .rbe-sil-photo{width:60px;height:42px}
.rbe .rbe-sil-a5 .rbe-sil-paper{width:60px;height:85px}.rbe .rbe-sil-a5 .rbe-sil-photo{width:41px;height:61px}
.rbe .rbe-route{display:grid;gap:${sp.xs}px ${sp.lg}px;grid-template-columns:1fr}
.rbe .rbe-route li{display:flex;align-items:center;gap:${sp.sm}px;min-height:52px;padding:${sp.xs}px 0;border-bottom:1px solid ${c.borderStrong}}
.rbe .rbe-route li[hidden]{display:none}
.rbe .rbe-route-n{flex:none;width:32px;height:32px;border-radius:50%;background:${c.primaryLight};color:${c.primaryText};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
.rbe .rbe-route-t{flex:1;min-width:0}
.rbe .rbe-route-p{flex:none;${type(ty.bodySmall)};color:${c.textMuted}}
.rbe .rbe-route-toggle{margin-top:${sp.md}px}
.rbe .rbe-acc{background:${c.surface};border-radius:${r.lg}px;box-shadow:${sh.card};margin-bottom:${sp.sm}px}
.rbe .rbe-acc>summary{list-style:none;display:flex;align-items:center;gap:${sp.sm}px;min-height:64px;padding:${sp.sm}px ${sp.lg}px;cursor:pointer;border-radius:${r.lg}px}
.rbe .rbe-acc>summary::-webkit-details-marker{display:none}
.rbe .rbe-acc-ic{width:40px;height:40px;border-radius:${r.sm}px;background:${c.primaryLight};color:${c.primaryText};display:flex;align-items:center;justify-content:center;flex:none}
.rbe .rbe-acc-txt{display:flex;flex-direction:column;min-width:0}
.rbe .rbe-acc-title{${type(ty.h3)}}
.rbe .rbe-acc-hint{${type(ty.bodySmall)};color:${c.textMuted}}
.rbe .rbe-acc-chev{margin-left:auto;color:${c.textMuted};transition:transform .2s}
.rbe .rbe-acc[open]>summary .rbe-acc-chev{transform:rotate(180deg)}
.rbe .rbe-acc-inner{padding:0 ${sp.lg}px ${sp.lg}px}
.rbe .rbe-dl-main{display:grid;gap:${sp.lg}px;align-items:center;background:${c.surface};border-radius:${r.xl}px;box-shadow:${sh.card};padding:${sp.lg}px;border:2px solid ${c.primaryLight}}
.rbe .rbe-dl-main h3{font-size:20px;line-height:26px}
.rbe .rbe-dl-main .rbe-small{margin-top:4px}
.rbe .rbe-dl-thumb{background:${c.backgroundTertiary};border-radius:${r.md}px;padding:${sp.sm}px;display:flex;justify-content:center;align-items:center}
.rbe .rbe-dl-thumb img{max-height:140px;box-shadow:${sh.hover}}
.rbe .rbe-dl-row{display:grid;gap:${sp.md}px;grid-template-columns:1fr;margin-top:${sp.md}px}
.rbe .rbe-dl-card{display:flex;flex-wrap:wrap;gap:${sp.md}px;align-items:center;background:${c.surface};border-radius:${r.lg}px;box-shadow:${sh.card};padding:${sp.md}px ${sp.lg}px}
.rbe .rbe-dl-thumb-sm{flex:none;width:72px;height:72px;padding:4px;border-radius:${r.sm}px;overflow:hidden}
.rbe .rbe-dl-thumb-sm img{max-width:64px;max-height:64px}
.rbe .rbe-dl-thumb-icon{color:${c.primaryText}}
.rbe .rbe-grow{flex:1;min-width:140px}
.rbe .rbe-grow .rbe-small{margin-top:2px}
.rbe .rbe-dl-acts{display:flex;flex-wrap:wrap;gap:${sp.xs}px;width:100%}
.rbe .rbe-dl-acts .rbe-btn{flex:1}
.rbe .rbe-dl-print{margin-top:${sp.md}px}
.rbe .rbe-files-group{margin-top:${sp.md}px}
.rbe .rbe-files-group h3{font-size:15px;margin:0 0 ${sp.xxs}px}
.rbe .rbe-files-group>.rbe-small{margin:0 0 ${sp.xs}px}
.rbe .rbe-files li{display:flex;flex-wrap:wrap;gap:${sp.xs}px ${sp.md}px;align-items:center;justify-content:space-between;min-height:56px;border-top:1px solid ${c.borderStrong};padding:${sp.xs}px 0}
.rbe .rbe-files li>span{flex:1;min-width:180px}
.rbe .rbe-version{margin-top:${sp.md}px}
.rbe .rbe-paths{display:grid;gap:${sp.md}px;grid-template-columns:1fr}
.rbe .rbe-path{background:${c.surface};border-radius:${r.lg}px;box-shadow:${sh.card};padding:${sp.lg}px;display:flex;flex-direction:column;gap:${sp.xs}px}
.rbe .rbe-path-ic{width:44px;height:44px;border-radius:${r.sm}px;background:${c.primaryLight};color:${c.primaryText};display:flex;align-items:center;justify-content:center}
.rbe .rbe-path p{color:${c.textMuted};font-size:14px;line-height:20px}
.rbe .rbe-path .rbe-path-fit{${type(ty.bodySmall)};font-weight:600;color:${c.text}}
.rbe .rbe-path summary{list-style:none;cursor:pointer;color:${c.primaryText};font-weight:600;font-size:14px;min-height:44px;display:flex;align-items:center;gap:6px}
.rbe .rbe-path summary::-webkit-details-marker{display:none}
.rbe .rbe-path ol{list-style:decimal;padding-left:20px;font-size:14px;line-height:20px;color:${c.textMuted}}
.rbe .rbe-guide-open{margin:${sp.md}px 0 ${sp.lg}px}
.rbe .ready-books-note p,.rbe .ready-books-preview p{margin:0 0 ${sp.sm}px}
.rbe .rbe-faq .rbe-acc>summary{min-height:56px}
.rbe .rbe-faq .rbe-acc-inner p{color:${c.textMuted}}
.rbe .rbe-more{display:flex;overflow-x:auto;gap:${sp.md}px;margin:0 -${sp.md}px;padding:4px ${sp.md}px ${sp.sm}px;scroll-snap-type:x mandatory}
.rbe .rbe-more>li{flex:0 0 64%;scroll-snap-align:start}
.rbe .rbe-more a{display:block;height:100%;text-decoration:none;color:inherit;background:${c.surface};border-radius:${r.lg}px;box-shadow:${sh.card};overflow:hidden}
.rbe .rbe-more-thumb{background:${c.backgroundTertiary};aspect-ratio:1.4;display:flex;align-items:center;justify-content:center;padding:${sp.md}px}
.rbe .rbe-more-thumb img{max-height:100%;box-shadow:${sh.hover}}
.rbe .rbe-more-body{display:block;padding:${sp.sm}px ${sp.md}px ${sp.md}px}
.rbe .rbe-more-body .rbe-small{display:block;margin-top:2px}
.rbe .rbe-foot{padding:${sp.xxl}px 0 0}
.rbe-sticky{position:sticky;bottom:var(--mt-dock-h,0px);margin:0 -${sp.md}px;z-index:${DESIGN_TOKENS.zIndex.sticky};display:flex;gap:${sp.xs}px;background:${c.surface};border-top:1px solid ${c.borderStrong};box-shadow:${sh.medium};padding:${sp.xs}px ${sp.md}px calc(${sp.xs}px + max(0px,env(safe-area-inset-bottom,0px) - var(--mt-dock-h,0px)))}
.rbe .rbe-sticky .rbe-btn{flex:1;min-width:0;padding:0 ${sp.sm}px}
@media(prefers-reduced-motion:reduce){.rbe .rbe-acc-chev{transition:none}}
@media(max-width:560px){.rbe .rbe-cta .rbe-btn{flex:1;padding:0 ${sp.sm}px}}
@media(max-width:799px){
  .rbe{padding-bottom:calc(72px + var(--mt-dock-h,0px))}
  html:has(.rbe-sticky),[data-testid="ready-books-scroll"]:has(.rbe-sticky){scroll-padding-bottom:calc(88px + var(--mt-dock-h,0px))}
}
@media(min-width:561px){.rbe .rbe-sizes{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:720px){
  .rbe .rbe-how,.rbe .rbe-paths{grid-template-columns:repeat(3,minmax(0,1fr))}
  .rbe .rbe-route{grid-template-columns:1fr 1fr}
  .rbe .rbe-dl-main{grid-template-columns:200px 1fr auto;padding:${sp.xl}px}
  .rbe .rbe-dl-row{grid-template-columns:1fr 1fr}
  .rbe .rbe-dl-card{flex-wrap:nowrap}
  .rbe .rbe-dl-acts{width:auto;justify-content:flex-end}
  .rbe .rbe-dl-acts .rbe-btn{flex:none}
}
@media(min-width:800px){.rbe .rbe-hero h1{font-size:44px;line-height:50px;letter-spacing:-1px}.rbe-sticky{display:none}}
@media(min-width:960px){
  .rbe-hero{grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);gap:${sp.xxl}px}
  .rbe .rbe-styles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible;margin:0;padding:0;gap:${sp.md}px}
  .rbe .rbe-more{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible;margin:0;padding:0}
}
`;

/**
 * Catalogue landing (#2970): composes the edition classes (`rbe-hero`, `rbe-block`, chips,
 * buttons, `rbe-path` step cards) and adds only the catalogue parts — step grid, place pages,
 * theme chips, edition cards.
 */
export const catalogCss=`
.rbe.rbc{padding-bottom:0}
.rbe .rbc-hero-copy{min-width:0}
.rbe .rbc-steps{display:grid;gap:${sp.md}px;grid-template-columns:1fr}
.rbe .rbc-places{display:flex;overflow-x:auto;gap:${sp.md}px;margin:0 -${sp.md}px;padding:4px ${sp.md}px ${sp.sm}px;scroll-snap-type:x mandatory}
.rbe .rbc-places>li{flex:0 0 84%;scroll-snap-align:start}
.rbe .rbc-places a{display:block;height:100%;text-decoration:none;color:inherit;background:${c.surface};border-radius:${r.lg}px;box-shadow:${sh.card};overflow:hidden}
.rbe .rbc-places a:hover,.rbe .rbc-card:not(.rbc-card-planned):hover{box-shadow:${sh.hover}}
.rbe .rbc-place-page{display:block;background:${c.backgroundTertiary};padding:${sp.sm}px}
.rbe .rbc-place-page img{width:100%;aspect-ratio:1.5;object-fit:contain;background:${c.surface};box-shadow:${sh.card};border-radius:2px}
.rbe .rbc-place-body{display:block;padding:${sp.sm}px ${sp.md}px ${sp.md}px}
.rbe .rbc-place-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:4px}
.rbe .rbc-themes{border:0;padding:0;margin:0 0 ${sp.lg}px;min-width:0;display:flex;flex-wrap:wrap;gap:${sp.xs}px}
.rbe .rbc-themes legend{float:left;width:100%;margin:0 0 ${sp.xs}px;padding:0}
.rbe .rbc-theme{position:relative;display:inline-flex;align-items:center;min-height:44px;padding:0 ${sp.md}px;border-radius:${r.pill}px;background:${c.surface};border:1px solid ${c.borderStrong};${type(ty.bodySmall)};font-weight:600;cursor:pointer}
.rbe .rbc-theme input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.rbe .rbc-theme:has(input:checked){background:${c.primary};border-color:${c.primary};color:${c.textOnPrimary}}
.rbe .rbc-theme:has(input:focus-visible){outline:3px solid ${c.primaryText};outline-offset:3px}
.rbe .rbc-grid{display:grid;gap:${sp.md}px;grid-template-columns:1fr}
.rbe .rbc-card{position:relative;display:flex;flex-direction:column;height:100%;background:${c.surface};border-radius:${r.lg}px;box-shadow:${sh.card};overflow:hidden}
.rbe .rbc-card:has(.rbc-card-link:focus-visible){outline:3px solid ${c.primaryText};outline-offset:3px}
.rbe .rbc-card-planned{box-shadow:none;border:1px dashed ${c.borderStrong};background:transparent}
.rbe .rbc-card-thumb{background:${c.backgroundTertiary};aspect-ratio:1.5;display:flex;align-items:center;justify-content:center;padding:${sp.md}px}
.rbe .rbc-card-thumb img{max-width:100%;max-height:100%;box-shadow:${sh.hover};border-radius:2px}
.rbe .rbc-card-body{flex:1;display:flex;flex-direction:column;gap:${sp.xs}px;padding:${sp.md}px ${sp.lg}px ${sp.lg}px}
.rbe .rbc-card-body .rbe-chips{margin:${sp.xxs}px 0 0}
.rbe .rbc-card-link{margin-top:auto;align-self:flex-start;display:inline-flex;align-items:center;gap:6px;min-height:44px;color:${c.primaryText};font-weight:700;text-decoration:none}
.rbe .rbc-card-link:focus-visible{outline:none}
.rbe .rbc-card-link::after{content:"";position:absolute;inset:0}
.rbe .rbc-style-list{display:grid;gap:${sp.xs}px;margin-top:${sp.xs}px}
.rbe .rbc-style-list li{border-top:1px solid ${c.borderStrong}}
.rbe .rbc-style-list a{min-height:44px;gap:${sp.xs}px}
.rbe .rbc-style-list p{margin:0 0 ${sp.xs}px}
.rbe .rbc-mini-preview img{display:block;max-width:100%;height:auto;box-shadow:${sh.card};border:1px solid ${c.borderStrong};border-radius:${r.sm}px}
@media(max-width:799px){
  .rbe .rbc-hero{gap:${sp.md}px;padding-bottom:${sp.lg}px}
  .rbe .rbc-hero-copy{order:-1}
  .rbe .rbc-hero-art .rbe-stage{max-width:250px}
}
@media(min-width:560px){.rbe .rbc-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:720px){
  .rbe .rbc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rbe .rbc-places{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible;margin:0;padding:0}
}
@media(min-width:960px){
  .rbe .rbc-steps{grid-template-columns:repeat(4,minmax(0,1fr))}
  .rbe .rbc-grid,.rbe .rbc-places{grid-template-columns:repeat(3,minmax(0,1fr))}
}
`;
