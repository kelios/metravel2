import {DESIGN_TOKENS} from '@/constants/designSystem';

const c=DESIGN_TOKENS.colors,r=DESIGN_TOKENS.radii,sp=DESIGN_TOKENS.spacing,ty=DESIGN_TOKENS.typography.scale;
const type=(scale:{fontSize:number;lineHeight:number;letterSpacing:number;fontWeight:string})=>`font-size:${scale.fontSize}px;line-height:${scale.lineHeight}px;letter-spacing:${scale.letterSpacing}px;font-weight:${scale.fontWeight}`;

/**
 * «Где напечатать» (#2983): the print-point directory inside the edition page's `.rbe` scope.
 * Colours are theme tokens (`var(--color-*)`), so the dark theme needs no override.
 */
export const printProvidersCss=`
.rbe .rbe-providers .rbe-acc-inner>section:not(.rbe-pp){display:flex;flex-direction:column;align-items:flex-start;gap:${sp.sm}px}
.rbe .rbe-pp{display:flex;flex-direction:column;gap:${sp.md}px}
.rbe .rbe-pp-lead{color:${c.textMuted};max-width:720px}
.rbe .rbe-pp-note{display:flex;gap:${sp.sm}px;align-items:flex-start;padding:${sp.md}px;border-radius:${r.md}px;background:${c.primaryLight}}
.rbe .rbe-pp-note>.rbe-i{color:${c.primaryText};margin-top:2px}
.rbe .rbe-pp-note p{${type(ty.bodySmall)};color:${c.textMuted}}
.rbe .rbe-pp-note p.rbe-pp-format{font-weight:600;color:${c.text};margin-bottom:4px}
.rbe .rbe-pp-controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:${sp.sm}px ${sp.lg}px;padding-top:${sp.xs}px}
.rbe .rbe-pp-seg{display:flex;flex-wrap:wrap;gap:${sp.xs}px}
.rbe .rbe-pp-city{flex:0 1 340px;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:${sp.xs}px ${sp.sm}px}
.rbe .rbe-pp-city label{${type(ty.bodySmall)};font-weight:600;color:${c.textMuted}}
.rbe .rbe-pp-select{position:relative;display:flex;flex:1 1 160px;min-width:0}
.rbe .rbe-pp-select select{appearance:none;-webkit-appearance:none;min-height:44px;width:100%;margin:0;padding:0 40px 0 ${sp.md}px;border-radius:${r.md}px;border:1px solid ${c.borderStrong};background:${c.surface};color:${c.text};${type(ty.body)};font-family:inherit;cursor:pointer}
.rbe .rbe-pp-select>.rbe-i{position:absolute;right:${sp.sm}px;top:50%;transform:translateY(-50%);pointer-events:none;color:${c.textMuted}}
.rbe .rbe-pp-list{display:grid;gap:${sp.md}px;grid-template-columns:1fr}
.rbe .rbe-pp-card{display:flex;flex-direction:column;gap:${sp.sm}px;min-width:0;padding:${sp.md}px ${sp.lg}px;border-radius:${r.lg}px;border:1px solid ${c.borderStrong};background:${c.background}}
.rbe .rbe-pp-addr,.rbe .rbe-pp-facts li,.rbe .rbe-pp-foot{display:flex;gap:${sp.xs}px;align-items:flex-start;${type(ty.bodySmall)}}
.rbe .rbe-pp-addr,.rbe .rbe-pp-foot{color:${c.textMuted}}
.rbe .rbe-pp-addr>.rbe-i,.rbe .rbe-pp-facts .rbe-i,.rbe .rbe-pp-foot>.rbe-i{margin-top:2px}
.rbe .rbe-pp-facts{display:flex;flex-direction:column;gap:6px}
.rbe .rbe-pp-facts .rbe-i{color:${c.success}}
.rbe .rbe-pp-facts li.is-ask{color:${c.textMuted}}
.rbe .rbe-pp-facts li.is-ask .rbe-i{color:${c.warning}}
.rbe .rbe-pp-actions{margin-top:auto;display:flex;flex-wrap:wrap;align-items:flex-start;gap:${sp.xs}px ${sp.md}px;padding-top:${sp.xs}px}
.rbe .rbe-pp-src{flex:1 1 auto;min-width:0}
.rbe .rbe-pp-src summary{list-style:none;cursor:pointer;color:${c.primaryText};font-weight:600;font-size:14px;min-height:44px;display:inline-flex;align-items:center;gap:6px}
.rbe .rbe-pp-src summary::-webkit-details-marker{display:none}
.rbe .rbe-pp-src summary .rbe-i{transition:transform .2s}
.rbe .rbe-pp-src[open] summary .rbe-i{transform:rotate(180deg)}
.rbe .rbe-pp-src ul{display:flex;flex-wrap:wrap;gap:4px ${sp.xs}px}
.rbe .rbe-pp-error{color:${c.danger}}
.rbe .rbe-pp-empty{color:${c.textMuted}}
@media(min-width:720px){.rbe .rbe-pp-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){.rbe .rbe-pp-src summary .rbe-i{transition:none}}
`;
