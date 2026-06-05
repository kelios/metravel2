#!/usr/bin/env node
/* Генерирует обложку квеста «Варшава» (1536×1024 PNG) — векторный постер:
 * закатное небо, силуэт Старого города, медальон с Сиреной, типографика.
 * Рендер через @resvg/resvg-js. Запуск: node scripts/gen-warsaw-cover.js */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const W = 1536, H = 1024;

// --- Силуэт Старого города (townhouses + башни + Дворец культуры справа) ---
function skyline() {
  const base = 772;
  // строим землю слева-направо как последовательность зданий
  const segs = [];
  segs.push({ x: 60, w: 140, top: 628, gable: 'tri' });
  segs.push({ x: 210, w: 120, top: 650, gable: 'step' });
  segs.push({ x: 340, w: 150, top: 616, gable: 'flat' });
  // Колонна Сигизмунда
  segs.push({ x: 500, w: 26, top: 470, gable: 'column' });
  segs.push({ x: 540, w: 130, top: 642, gable: 'tri' });
  // Башня Королевского замка (с часами)
  segs.push({ x: 690, w: 86, top: 452, gable: 'tower' });
  segs.push({ x: 786, w: 150, top: 636, gable: 'step' });
  // Шпиль костёла (Св. Анна)
  segs.push({ x: 946, w: 70, top: 408, gable: 'spire' });
  segs.push({ x: 1026, w: 150, top: 648, gable: 'flat' });
  segs.push({ x: 1186, w: 120, top: 628, gable: 'tri' });
  // Дворец культуры и науки (ступенчатый шпиль) справа
  segs.push({ x: 1330, w: 150, top: 360, gable: 'pkin' });

  let body = `M0,${H} L0,${base} `;
  for (const s of segs) {
    const { x, w, top, gable } = s;
    body += `L${x},${base} L${x},${top + 40} `;
    if (gable === 'tri') {
      body += `L${x + w * 0.5},${top} L${x + w},${top + 40} `;
    } else if (gable === 'step') {
      body += `L${x + w * 0.2},${top + 14} L${x + w * 0.2},${top} L${x + w * 0.4},${top} L${x + w * 0.4},${top - 14} L${x + w * 0.6},${top - 14} L${x + w * 0.6},${top} L${x + w * 0.8},${top} L${x + w * 0.8},${top + 14} `;
    } else if (gable === 'flat') {
      body += `L${x},${top} L${x + w},${top} `;
    } else if (gable === 'column') {
      // тонкая колонна с фигуркой наверху
      body += `L${x + w * 0.5 - 6},${top + 40} L${x + w * 0.5 - 6},${top + 18} L${x + w * 0.5 - 11},${top + 18} L${x + w * 0.5 - 11},${top + 6} L${x + w * 0.5 + 11},${top + 6} L${x + w * 0.5 + 11},${top + 18} L${x + w * 0.5 + 6},${top + 18} L${x + w * 0.5 + 6},${top + 40} `;
    } else if (gable === 'tower') {
      // башня с пирамидальной крышей и шпилем
      body += `L${x},${top + 30} L${x + w * 0.18},${top} L${x + w * 0.5},${top - 44} L${x + w * 0.5},${top - 70} L${x + w * 0.5 + 2},${top - 70} L${x + w * 0.5 + 2},${top - 44} L${x + w * 0.82},${top} L${x + w},${top + 30} `;
    } else if (gable === 'spire') {
      body += `L${x + w * 0.5 - 14},${top + 30} L${x + w * 0.5},${top - 36} L${x + w * 0.5},${top - 70} L${x + w * 0.5 + 1},${top - 70} L${x + w * 0.5 + 1},${top - 36} L${x + w * 0.5 + 14},${top + 30} `;
    } else if (gable === 'pkin') {
      // ступенчатый небоскрёб со шпилем
      const cx = x + w * 0.5;
      body += `L${x},${top + 120} L${x + 18},${top + 120} L${x + 18},${top + 64} L${x + 40},${top + 64} L${x + 40},${top + 24} L${cx - 6},${top + 24} L${cx - 6},${top - 70} L${cx},${top - 70} L${cx},${top - 70} L${cx + 6},${top - 70} L${cx + 6},${top + 24} L${x + w - 40},${top + 24} L${x + w - 40},${top + 64} L${x + w - 18},${top + 64} L${x + w - 18},${top + 120} L${x + w},${top + 120} `;
    }
    body += `L${x + w},${top + 40} L${x + w},${base} `;
  }
  body += `L${W},${base} L${W},${H} Z`;
  return body;
}

// --- Сирена: стилизованный силуэт с поднятым мечом и щитом ---
function mermaid() {
  // локальные координаты, центр медальона = (0,0)
  return `
    <g stroke-linejoin="round" stroke-linecap="round">
      <!-- хвост (S-изгиб) с плавником -->
      <path d="M -6,6
               C 26,30 30,70 8,96
               C -8,114 -40,120 -64,108
               C -44,112 -22,104 -16,86
               C 18,70 14,40 -10,20 Z"
            fill="url(#merFill)"/>
      <!-- плавник-флюк -->
      <path d="M -64,108 C -86,96 -96,118 -84,134 C -78,120 -70,118 -60,120
               C -72,126 -78,140 -70,152 C -54,140 -50,118 -64,108 Z"
            fill="url(#merFill)"/>
      <!-- торс -->
      <path d="M -10,20 C -22,4 -22,-26 -12,-44 C -6,-54 6,-54 12,-44
               C 22,-26 22,2 6,20 C 2,26 -4,26 -10,20 Z" fill="url(#merFill)"/>
      <!-- голова -->
      <circle cx="0" cy="-64" r="17" fill="url(#merFill)"/>
      <!-- волосы -->
      <path d="M -16,-66 C -26,-58 -28,-40 -20,-30 C -22,-46 -16,-58 -8,-64 Z" fill="url(#merFill)"/>
      <path d="M 16,-66 C 26,-58 28,-40 20,-30 C 22,-46 16,-58 8,-64 Z" fill="url(#merFill)"/>
      <!-- поднятая рука с мечом -->
      <path d="M 8,-44 C 26,-56 40,-78 46,-104 L 40,-106 C 32,-82 20,-62 4,-50 Z" fill="url(#merFill)"/>
      <!-- меч -->
      <g stroke="url(#merFill)" fill="url(#merFill)">
        <rect x="41" y="-150" width="6" height="50" rx="2"/>
        <rect x="30" y="-104" width="28" height="6" rx="3"/>
        <circle cx="44" cy="-95" r="4"/>
      </g>
      <!-- рука со щитом -->
      <path d="M -12,-40 C -30,-34 -44,-22 -50,-6 L -44,-2 C -36,-18 -24,-30 -8,-34 Z" fill="url(#merFill)"/>
      <circle cx="-52" cy="2" r="20" fill="url(#merShield)" stroke="url(#merFill)" stroke-width="3"/>
      <path d="M -52,-14 L -52,18 M -66,2 L -38,2" stroke="url(#merFill)" stroke-width="2.5"/>
    </g>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0"   stop-color="#10162b"/>
      <stop offset="0.42" stop-color="#222c52"/>
      <stop offset="0.66" stop-color="#7a4a6e"/>
      <stop offset="0.8"  stop-color="#d98a4e"/>
      <stop offset="0.92" stop-color="#eba85a"/>
      <stop offset="1"    stop-color="#caa05a"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffe7b0" stop-opacity="0.95"/>
      <stop offset="0.4" stop-color="#f6c277" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#f6c277" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="city" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#171a2e"/>
      <stop offset="1" stop-color="#090b16"/>
    </linearGradient>
    <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#caa05a" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#2a2f4d" stop-opacity="0.0"/>
    </linearGradient>
    <radialGradient id="medbg" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="#222a4a"/>
      <stop offset="1" stop-color="#0d1227"/>
    </radialGradient>
    <linearGradient id="merFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbe7b8"/>
      <stop offset="1" stop-color="#e7b86a"/>
    </linearGradient>
    <radialGradient id="merShield" cx="0.5" cy="0.4" r="0.6">
      <stop offset="0" stop-color="#39426e"/>
      <stop offset="1" stop-color="#1a1f3a"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3d79a"/>
      <stop offset="0.5" stop-color="#e7c074"/>
      <stop offset="1" stop-color="#c9a045"/>
    </linearGradient>
    <linearGradient id="title" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fdf6e6"/>
      <stop offset="1" stop-color="#f1d9a3"/>
    </linearGradient>
  </defs>

  <!-- небо -->
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <!-- закатное солнце за городом -->
  <circle cx="768" cy="690" r="430" fill="url(#sun)"/>

  <!-- эйфория звёзд сверху -->
  <g fill="#ffffff" opacity="0.7">
    <circle cx="180" cy="120" r="2"/><circle cx="320" cy="80" r="1.5"/>
    <circle cx="1240" cy="110" r="2"/><circle cx="1380" cy="170" r="1.5"/>
    <circle cx="980" cy="70" r="1.5"/><circle cx="560" cy="60" r="1.3"/>
    <circle cx="1120" cy="220" r="1.3"/><circle cx="420" cy="190" r="1.2"/>
  </g>

  <!-- силуэт города -->
  <path d="${skyline()}" fill="url(#city)"/>
  <!-- тёплая кромка по крышам -->
  <path d="${skyline()}" fill="none" stroke="#e9a85a" stroke-width="2" opacity="0.35"/>

  <!-- отражение в Висле -->
  <rect x="0" y="772" width="${W}" height="${H - 772}" fill="url(#river)"/>

  <!-- эйфория: верхняя засечка -->
  <text x="768" y="170" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-size="30" letter-spacing="11" fill="#f1d9a3" font-weight="600">ГОРОДСКОЙ КВЕСТ</text>
  <line x1="624" y1="196" x2="912" y2="196" stroke="#e7c074" stroke-width="1.4" opacity="0.7"/>

  <!-- заголовок -->
  <text x="768" y="338" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="168" font-weight="700" fill="url(#title)" letter-spacing="6">ВАРШАВА</text>

  <!-- подзаголовок -->
  <text x="768" y="402" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
        font-size="42" fill="#f6ead0">Сирена, Базилишек и Золотая утка</text>

  <!-- медальон с Сиреной -->
  <g transform="translate(768,640)">
    <circle r="158" fill="url(#medbg)" stroke="url(#gold)" stroke-width="6"/>
    <circle r="150" fill="none" stroke="#e7c074" stroke-width="1.5" opacity="0.5"/>
    <g transform="translate(0,8) scale(0.92)">${mermaid()}</g>
  </g>

  <!-- чипы -->
  <g font-family="Helvetica, Arial, sans-serif" font-size="27" fill="#fdf3df" font-weight="600">
    <text x="768" y="876" text-anchor="middle" letter-spacing="2">10 точек&#160;&#160;•&#160;&#160;Старе Място&#160;&#160;•&#160;&#160;Королевский тракт</text>
  </g>
  <text x="768" y="922" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-size="22" letter-spacing="4" fill="#e7c074" opacity="0.9">metravel.by</text>
</svg>`;

const outDir = path.resolve(__dirname, '..', 'assets', 'quests', 'warsawSyrenka');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'cover.png');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true, defaultFontFamily: 'Georgia' },
  background: '#10162b',
});
const png = resvg.render().asPng();
fs.writeFileSync(outPath, png);
console.log('written', outPath, (png.length / 1024).toFixed(0) + 'KB');
