#!/usr/bin/env node
/* Generates the Warsaw quest cover (1536x1024 PNG) as a dark fantasy poster.
 * The asset intentionally has no typography: quest cards render text in UI. */
const fs = require('fs');
const path = require('path');
let Resvg = null;
try {
  ({ Resvg } = require('@resvg/resvg-js'));
} catch {
  Resvg = null;
}

const W = 1536;
const H = 1024;

function lanterns() {
  const points = [
    [138, 772, 8], [256, 734, 5], [356, 752, 6], [496, 742, 5],
    [866, 758, 7], [1022, 742, 6], [1168, 758, 5], [1340, 736, 6],
  ];
  return points.map(([x, y, r]) => `
    <g opacity="0.95">
      <circle cx="${x}" cy="${y}" r="${r * 7}" fill="url(#lampGlow)"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="#f6b85c"/>
      <rect x="${x - 1}" y="${y}" width="2" height="52" fill="#2a251f" opacity="0.55"/>
    </g>`).join('');
}

function oldTownSkyline() {
  const base = 776;
  const buildings = [
    { x: 38, w: 110, h: 122, roof: 'gable' },
    { x: 155, w: 86, h: 102, roof: 'stepped' },
    { x: 246, w: 118, h: 148, roof: 'gable' },
    { x: 372, w: 96, h: 128, roof: 'flat' },
    { x: 480, w: 76, h: 246, roof: 'column' },
    { x: 566, w: 124, h: 136, roof: 'gable' },
    { x: 708, w: 92, h: 286, roof: 'castleTower' },
    { x: 812, w: 118, h: 146, roof: 'stepped' },
    { x: 944, w: 82, h: 328, roof: 'spire' },
    { x: 1038, w: 136, h: 128, roof: 'flat' },
    { x: 1190, w: 112, h: 140, roof: 'gable' },
    { x: 1328, w: 158, h: 366, roof: 'pkin' },
  ];

  let pathData = `M0,${H} L0,${base}`;
  for (const b of buildings) {
    const top = base - b.h;
    const x2 = b.x + b.w;
    pathData += ` L${b.x},${base} L${b.x},${top + 48}`;
    if (b.roof === 'gable') {
      pathData += ` L${b.x + b.w / 2},${top} L${x2},${top + 48}`;
    } else if (b.roof === 'stepped') {
      pathData += ` L${b.x + 18},${top + 38} L${b.x + 18},${top + 20} L${b.x + 38},${top + 20} L${b.x + 38},${top} L${b.x + 78},${top} L${b.x + 78},${top + 20} L${x2 - 16},${top + 20} L${x2 - 16},${top + 38} L${x2},${top + 38}`;
    } else if (b.roof === 'column') {
      const cx = b.x + b.w / 2;
      pathData += ` L${cx - 9},${top + 52} L${cx - 9},${top + 18} L${cx - 16},${top + 18} L${cx - 16},${top + 5} L${cx + 16},${top + 5} L${cx + 16},${top + 18} L${cx + 9},${top + 18} L${cx + 9},${top + 52}`;
    } else if (b.roof === 'castleTower') {
      const cx = b.x + b.w / 2;
      pathData += ` L${b.x + 10},${top + 54} L${b.x + 22},${top + 16} L${cx},${top - 62} L${cx},${top - 90} L${cx + 2},${top - 90} L${cx + 2},${top - 62} L${x2 - 22},${top + 16} L${x2 - 10},${top + 54}`;
    } else if (b.roof === 'spire') {
      const cx = b.x + b.w / 2;
      pathData += ` L${cx - 18},${top + 60} L${cx},${top - 80} L${cx},${top - 116} L${cx + 2},${top - 116} L${cx + 2},${top - 80} L${cx + 18},${top + 60}`;
    } else if (b.roof === 'pkin') {
      const cx = b.x + b.w / 2;
      pathData += ` L${b.x + 20},${top + 122} L${b.x + 20},${top + 78} L${b.x + 44},${top + 78} L${b.x + 44},${top + 30} L${cx - 8},${top + 30} L${cx - 8},${top - 92} L${cx},${top - 120} L${cx + 8},${top - 92} L${cx + 8},${top + 30} L${x2 - 44},${top + 30} L${x2 - 44},${top + 78} L${x2 - 20},${top + 78} L${x2 - 20},${top + 122}`;
    } else {
      pathData += ` L${x2},${top}`;
    }
    pathData += ` L${x2},${base}`;
  }
  pathData += ` L${W},${base} L${W},${H} Z`;
  return pathData;
}

function windows() {
  const rows = [];
  for (let x = 72; x < 1260; x += 74) {
    const count = x % 3 === 0 ? 2 : 3;
    for (let i = 0; i < count; i += 1) {
      rows.push(`<rect x="${x + i * 18}" y="${624 + ((x + i) % 4) * 28}" width="8" height="18" rx="4" fill="#e49b43" opacity="${0.18 + ((x + i) % 3) * 0.07}"/>`);
    }
  }
  return rows.join('');
}

function mermaid() {
  return `
    <g transform="translate(736 540)" filter="url(#softGlow)" opacity="0.96">
      <path d="M-24,100 C28,74 32,16 -12,-22 C-42,-48 -30,-88 -4,-106 C22,-86 24,-46 4,-18 C62,8 76,72 22,124 C-2,148 -54,152 -88,132 C-48,130 -34,118 -24,100 Z" fill="url(#mermaidFill)"/>
      <path d="M-86,132 C-122,116 -142,148 -126,178 C-110,148 -92,152 -76,160 C-92,168 -104,192 -86,212 C-50,188 -48,150 -86,132 Z" fill="url(#mermaidFill)"/>
      <circle cx="-2" cy="-132" r="27" fill="url(#mermaidFill)"/>
      <path d="M-24,-142 C-66,-112 -58,-52 -30,-22 C-38,-72 -28,-112 8,-144 Z" fill="url(#mermaidFill)" opacity="0.88"/>
      <path d="M14,-126 C48,-102 52,-62 32,-30 C30,-72 24,-102 -2,-130 Z" fill="url(#mermaidFill)" opacity="0.88"/>
      <path d="M12,-100 C34,-128 50,-150 62,-168" stroke="#f5d48a" stroke-width="12" stroke-linecap="round"/>
      <path d="M58,-272 L72,-272 L68,-166 L62,-150 L56,-166 Z" fill="#f5d48a"/>
      <path d="M42,-166 L88,-166" stroke="#f5d48a" stroke-width="8" stroke-linecap="round"/>
      <path d="M-24,-92 C-72,-82 -100,-50 -110,-6" stroke="#f5d48a" stroke-width="12" stroke-linecap="round"/>
      <path d="M-122,-6 C-114,-42 -72,-52 -54,-18 C-64,26 -106,34 -122,-6 Z" fill="url(#shieldFill)" stroke="#f5d48a" stroke-width="6"/>
      <path d="M-92,-38 L-92,22 M-118,-8 L-66,-8" stroke="#f5d48a" stroke-width="4" opacity="0.72"/>
    </g>`;
}

function basiliskMist() {
  return `
    <g opacity="0.55" filter="url(#mistBlur)">
      <path d="M902,250 C996,130 1178,174 1236,280 C1174,238 1100,252 1056,312 C1114,306 1168,336 1192,392 C1132,358 1068,374 1024,422 C970,376 890,392 834,448 C852,372 880,304 902,250 Z" fill="url(#basilisk)"/>
      <path d="M986,282 C944,284 918,322 914,354 C958,326 1004,338 1022,374 C1030,326 1016,296 986,282 Z" fill="#0e302d"/>
      <circle cx="972" cy="244" r="8" fill="#d7b85a" opacity="0.85"/>
    </g>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#071719"/>
      <stop offset="0.45" stop-color="#0b2527"/>
      <stop offset="0.74" stop-color="#102b2e"/>
      <stop offset="1" stop-color="#061015"/>
    </linearGradient>
    <radialGradient id="moonGlow" cx="0.47" cy="0.54" r="0.52">
      <stop offset="0" stop-color="#efc06a" stop-opacity="0.82"/>
      <stop offset="0.36" stop-color="#c48137" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#0b2527" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#f2b45d" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#f2b45d" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cityFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#121b1f"/>
      <stop offset="1" stop-color="#070b10"/>
    </linearGradient>
    <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#12393a"/>
      <stop offset="1" stop-color="#041012"/>
    </linearGradient>
    <linearGradient id="mermaidFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff0b8"/>
      <stop offset="0.45" stop-color="#d89b48"/>
      <stop offset="1" stop-color="#7ce1d6"/>
    </linearGradient>
    <radialGradient id="shieldFill" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#224c54"/>
      <stop offset="1" stop-color="#08161a"/>
    </radialGradient>
    <linearGradient id="basilisk" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1aa187" stop-opacity="0.08"/>
      <stop offset="0.52" stop-color="#2fc5a7" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#0a211f" stop-opacity="0.08"/>
    </linearGradient>
    <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.95 0 1 0 0 0.67 0 0 1 0 0.24 0 0 0 0.75 0" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="mistBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="paper" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="19" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.18"/></feComponentTransfer>
      <feBlend in="SourceGraphic" mode="soft-light"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="#06242a" opacity="0.32" filter="url(#paper)"/>
  <circle cx="760" cy="548" r="520" fill="url(#moonGlow)"/>
  <g fill="#d8fff7" opacity="0.68">
    <circle cx="176" cy="88" r="1.6"/><circle cx="306" cy="62" r="1.2"/><circle cx="514" cy="126" r="1.4"/>
    <circle cx="1054" cy="78" r="1.3"/><circle cx="1260" cy="126" r="1.6"/><circle cx="1410" cy="72" r="1.2"/>
    <circle cx="932" cy="170" r="1.2"/><circle cx="672" cy="70" r="1.3"/>
  </g>

  ${basiliskMist()}
  <path d="${oldTownSkyline()}" fill="url(#cityFill)"/>
  <path d="${oldTownSkyline()}" fill="none" stroke="#b87536" stroke-width="2" opacity="0.42"/>
  <g opacity="0.72">${windows()}</g>
  ${lanterns()}

  <rect y="776" width="${W}" height="248" fill="url(#river)"/>
  <path d="M0,808 C168,780 304,836 470,804 C628,774 774,824 936,796 C1136,762 1304,812 1536,774 L1536,1024 L0,1024 Z" fill="#071216" opacity="0.74"/>
  <g opacity="0.52" stroke-linecap="round">
    <path d="M182,846 C300,826 398,856 522,836" stroke="#d99846" stroke-width="3" opacity="0.26"/>
    <path d="M650,820 C760,792 898,824 1014,806" stroke="#f4c371" stroke-width="4" opacity="0.32"/>
    <path d="M1044,858 C1160,834 1264,852 1398,826" stroke="#d99846" stroke-width="3" opacity="0.24"/>
    <path d="M560,930 C706,896 894,930 1070,890" stroke="#73d6c9" stroke-width="3" opacity="0.18"/>
  </g>

  <g opacity="0.92">
    <ellipse cx="1090" cy="838" rx="118" ry="38" fill="url(#lampGlow)" opacity="0.7"/>
    <path d="M1056,812 C1080,790 1124,790 1148,812 C1124,804 1080,804 1056,812 Z" fill="#f7c960"/>
    <circle cx="1102" cy="796" r="15" fill="#f7c960"/>
    <path d="M1114,790 C1130,778 1154,786 1164,802 C1142,798 1130,802 1118,812 Z" fill="#f7c960"/>
    <path d="M1096,780 L1102,762 L1108,780" stroke="#f7c960" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  ${mermaid()}

  <g opacity="0.26" filter="url(#mistBlur)">
    <path d="M108,738 C300,676 430,738 568,678 C710,616 834,668 1000,632 C1160,598 1306,654 1454,598 L1536,1024 L0,1024 Z" fill="#8edfd0"/>
  </g>

  <rect width="${W}" height="${H}" fill="none" stroke="#0b181b" stroke-width="36" opacity="0.62"/>
  <radialGradient id="vignette" cx="0.5" cy="0.55" r="0.74">
    <stop offset="0.48" stop-color="#000000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.7"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;

const outDir = path.resolve(__dirname, '..', 'assets', 'quests', 'warsawSyrenka');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'cover.png');

async function renderWithPlaywright() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;width:${W}px;height:${H}px;background:#071719;overflow:hidden}img{display:block;width:${W}px;height:${H}px}</style></head><body><img src="${dataUrl}" alt=""></body></html>`,
      { waitUntil: 'load' },
    );
    return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
  } finally {
    await browser.close();
  }
}

async function main() {
  let png;
  if (Resvg) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: W },
      background: '#071719',
    });
    png = resvg.render().asPng();
  } else {
    png = await renderWithPlaywright();
  }

  fs.writeFileSync(outPath, png);
  console.log('written', outPath, `${(png.length / 1024).toFixed(0)}KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
