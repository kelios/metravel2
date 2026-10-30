import type {PrintProfile} from '../../../../types/readyBook';

export function readyBookStyles(profile: PrintProfile, fonts: {regular: string; bold: string; serif: string}, country: string) {
  for (const data of Object.values(fonts)) {
    if (!/^data:font\/ttf;base64,[A-Za-z0-9+/=]+$/.test(data)) throw new Error('Embedded TTF font required');
  }
  const pocket = profile.id === 'pocket-150x100';
  const bleed = profile.bleedMm;
  const width = profile.widthMm + bleed * 2;
  const height = profile.heightMm + bleed * 2;
  return `
@font-face{font-family:BookSans;src:url('${fonts.regular}')}@font-face{font-family:BookSans;src:url('${fonts.bold}');font-weight:700}@font-face{font-family:BookSerif;src:url('${fonts.serif}');font-weight:700}
@page{size:${width}mm ${height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:BookSans,sans-serif;font-size:${pocket ? 9 : 10.5}pt;line-height:${pocket ? 1.3 : 1.35};color:#29352f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.book-page{position:relative;width:${width}mm;height:${height}mm;break-after:page;background:#fffefa;--accent:${country === 'BY' ? '#355f48' : '#884b36'}}.book-page:last-child{break-after:auto}
.trim{position:absolute;left:${bleed}mm;top:${bleed}mm;width:${profile.widthMm}mm;height:${profile.heightMm}mm;padding-top:12mm;padding-bottom:12mm}.left .trim{padding-left:var(--outer);padding-right:var(--inner)}.right .trim{padding-left:var(--inner);padding-right:var(--outer)}
header,footer{position:absolute;font-size:9pt;line-height:1.3;color:#59675f;left:inherit;right:inherit}header{top:5mm}footer{bottom:5mm}.left header,.left footer{left:var(--outer);right:var(--inner)}.right header,.right footer{left:var(--inner);right:var(--outer)}
h1,h2,h3,p,ul,ol{margin:0}h1,h2{font-family:BookSerif,serif;color:var(--accent);font-size:${pocket ? 14 : 22}pt;line-height:1.15}h3{font-size:${pocket ? 10 : 13}pt}p+p{margin-top:2mm}a{color:inherit;text-decoration:none;overflow-wrap:anywhere}.content{position:relative;height:100%}.flow{height:100%;display:flex;flex-direction:column;gap:${pocket ? 3 : 5}mm}.flow li{margin-bottom:1mm}ul,ol{padding-left:5mm}.small{font-size:9pt;line-height:1.3}.muted{color:#59675f}.gap{height:5mm}.line{border-bottom:.15mm solid #bdc7be;height:6mm}.lines{display:block;width:100%;flex-shrink:0}
.place-title{height:${pocket ? 14 : 22}mm}.place-title small{display:block;font-family:BookSans;font-weight:400;font-size:9pt;color:#59675f;line-height:1.3}.place-story{position:absolute;top:${pocket ? 15 : 95}mm;left:${pocket ? 60 : 0}mm;width:${pocket ? 'calc(100% - 60mm)' : '100%'};height:${pocket ? 47 : 62}mm}.place-image{position:absolute;left:0;top:${pocket ? 15 : 22}mm;width:${pocket ? 56 : 118}mm;height:${pocket ? 48 : 68}mm;object-fit:contain}.coords{position:absolute;bottom:0;left:0;right:0;font-size:9pt}.photo-frame{border:.2mm solid #bdc7be;width:${pocket ? 100 : 108}mm;height:${pocket ? 70 : 158}mm;display:flex;align-items:center;justify-content:center;text-align:center;color:#59675f;font-size:9pt;position:absolute;top:${pocket ? 2 : 16}mm;left:50%;transform:translateX(-50%)}.photo-caption{position:absolute;top:${pocket ? 74 : 177}mm;font-size:9pt}.qr-row{display:flex;gap:4mm;align-items:flex-start}.qr{width:${pocket ? 26 : 29}mm;height:${pocket ? 26 : 29}mm}.notes-facts{height:${pocket ? 60 : 94}mm}.notes .lines{height:${pocket ? 10 : 78}mm}.continuation{margin-bottom:2mm}.collage-credit{position:static;flex:0 0 auto;font-size:9pt;line-height:1.3;overflow-wrap:anywhere}.collage-space{flex:1;min-height:12mm;border:.15mm dashed #bdc7be;color:#59675f;padding:3mm}.map{width:100%;height:${pocket ? 53 : 132}mm}.contents-list{font-size:${pocket ? 9 : 10.5}pt;line-height:1.3;columns:${pocket ? 2 : 1};list-style:none;padding:0}.cover-art{width:100%;height:${pocket ? 45 : 80}mm;object-fit:contain}.cover h1{font-size:${pocket ? 24 : 36}pt}.cover .subtitle{font-size:${pocket ? 12 : 18}pt}.cover .flow{justify-content:center}.stop-index{color:var(--accent);font-weight:700}
.photo-memory .trim{padding-bottom:${pocket ? 9 : 12}mm}
.collage .content{display:flex;flex-direction:column;gap:2mm}.collage .gap{display:none}.collage-credit p+p{margin-top:0}.route-details p+p{margin-top:1mm}.nature-collage .collage-credit{margin-top:auto}
`;
}
