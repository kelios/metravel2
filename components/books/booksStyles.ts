import {DESIGN_TOKENS} from '@/constants/designSystem';
export const booksCss=`
.ready-books{max-width:1120px;margin:auto;padding:24px 16px 64px;overflow-wrap:anywhere;line-height:1.55}
.ready-books h1{font-size:32px;line-height:1.2;margin:0 0 16px}.ready-books h2{font-size:22px;margin:24px 0 12px}
.ready-books a{color:inherit;text-decoration:underline;min-height:44px;display:inline-flex;align-items:center}
.ready-books button,.ready-books select,.ready-books input{font:inherit;min-height:44px;max-width:100%}
.ready-books button{cursor:pointer}.ready-books :focus-visible{outline:3px solid currentColor;outline-offset:3px}
.ready-books-grid{display:grid;grid-template-columns:1fr;gap:24px}.ready-books-card{border:1px solid currentColor;border-radius:${DESIGN_TOKENS.radii.lg}px;overflow:hidden}
.ready-books-card>div{padding:20px}.ready-books-card img{display:block;width:100%;aspect-ratio:1.5;object-fit:contain}
.ready-books-note{border:1px solid currentColor;padding:16px;border-radius:${DESIGN_TOKENS.radii.md}px}.ready-books-note h2{margin-top:0}.ready-books summary{cursor:pointer;min-height:44px}
.ready-books-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:16px 0}.ready-books-controls label{display:flex;gap:8px;align-items:center;min-height:44px}
.ready-books-pages{display:flex;gap:12px;align-items:flex-start;overflow:auto;min-height:280px}.ready-books-paper{position:relative;flex:1;min-width:0;display:flex;align-items:center;justify-content:center;border:1px solid currentColor}.ready-books-paper img{width:100%;display:block}
.ready-books-preview{padding:20px;border:1px solid currentColor;border-radius:${DESIGN_TOKENS.radii.lg}px;margin-top:20px}
.ready-books-files{list-style:none;padding:0}.ready-books-files li{padding:16px 0;border-bottom:1px solid currentColor;display:flex;flex-wrap:wrap;gap:12px;align-items:center}.ready-books-files li>span{flex:1;min-width:180px}
@media(min-width:800px){.ready-books{padding:48px 32px 80px}.ready-books-grid{grid-template-columns:1fr 1fr}.ready-books h1{font-size:40px}}
`;
