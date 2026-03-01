import { Platform } from 'react-native';
import type { QuestStep } from './QuestWizard';
import { openBookPreviewWindow } from '@/utils/openBookPreviewWindow';

type PrintableProps = {
    title: string;
    steps: QuestStep[];
    intro?: QuestStep;
    questUrl?: string; // полный URL квеста на сайте
};

const QR_NAV = 80;
const QR_SITE = 120;
const MAP_VIEWBOX_WIDTH = 960;
const MAP_VIEWBOX_HEIGHT = 380;

type PrintableMapPoint = {
    lat: number;
    lng: number;
    num: number;
    location: string;
};

function qrUrl(data: string, size = QR_NAV): string {
    return `https://quickchart.io/qr?text=${encodeURIComponent(data)}&size=${size * 2}&margin=1&format=png`;
}

function googleMapsUrl(lat: number, lng: number): string {
    return `https://maps.google.com/maps?q=${lat},${lng}`;
}
function yandexMapsUrl(lat: number, lng: number): string {
    return `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`;
}
function organicMapsUrl(lat: number, lng: number): string {
    return `https://omaps.app/?ll=${lat},${lng}&z=16`;
}

function buildPrintableMapSvg(steps: QuestStep[]): string {
    const points: PrintableMapPoint[] = steps
        .filter((step) => Number.isFinite(step.lat) && Number.isFinite(step.lng) && (step.lat !== 0 || step.lng !== 0))
        .map((step, index) => ({
            lat: step.lat,
            lng: step.lng,
            num: index + 1,
            location: step.location || `Точка ${index + 1}`,
        }));

    if (!points.length) return '';

    const allLats = points.map((point) => point.lat);
    const allLngs = points.map((point) => point.lng);

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    const latSpan = Math.max(maxLat - minLat, 0.004);
    const lngSpan = Math.max(maxLng - minLng, 0.004);
    const latPad = latSpan * 0.16;
    const lngPad = lngSpan * 0.16;

    const safeMinLat = minLat - latPad;
    const safeMaxLat = maxLat + latPad;
    const safeMinLng = minLng - lngPad;
    const safeMaxLng = maxLng + lngPad;

    const frame = 34;
    const drawableWidth = MAP_VIEWBOX_WIDTH - frame * 2;
    const drawableHeight = MAP_VIEWBOX_HEIGHT - frame * 2;

    const project = (lat: number, lng: number) => {
        const x = frame + ((lng - safeMinLng) / Math.max(safeMaxLng - safeMinLng, 0.001)) * drawableWidth;
        const y = frame + (1 - (lat - safeMinLat) / Math.max(safeMaxLat - safeMinLat, 0.001)) * drawableHeight;
        return { x, y };
    };

    const projectedPoints = points.map((point) => ({ ...point, ...project(point.lat, point.lng) }));
    const routePath = projectedPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');

    const markers = projectedPoints.map((point, index) => {
        const isFirst = index === 0;
        const isLast = index === projectedPoints.length - 1;
        const markerFill = isFirst ? '#1f6f8b' : isLast ? '#0f4c62' : '#2d6a4f';

        return `
            <g>
                <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="12.8" fill="${markerFill}" stroke="#ffffff" stroke-width="2.5"></circle>
                <text x="${point.x.toFixed(2)}" y="${(point.y + 4.1).toFixed(2)}" text-anchor="middle" font-size="10" font-family="'Avenir Next','Segoe UI',sans-serif" font-weight="700" fill="#ffffff">${point.num}</text>
            </g>
        `;
    }).join('');

    const legend = points.map((point) => {
        return `<span class="map-chip"><b>${point.num}.</b> ${escInline(point.location)}</span>`;
    }).join('');

    return `
        <div class="map-card">
            <svg class="map-svg" viewBox="0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}" role="img" aria-label="Схема маршрута квеста">
                <defs>
                    <linearGradient id="mapBgGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#eef7fb"></stop>
                        <stop offset="100%" stop-color="#f7fbff"></stop>
                    </linearGradient>
                    <pattern id="mapGrid" width="42" height="42" patternUnits="userSpaceOnUse">
                        <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#dce9f2" stroke-width="1"></path>
                    </pattern>
                </defs>
                <rect x="0" y="0" width="${MAP_VIEWBOX_WIDTH}" height="${MAP_VIEWBOX_HEIGHT}" fill="url(#mapBgGradient)"></rect>
                <rect x="0" y="0" width="${MAP_VIEWBOX_WIDTH}" height="${MAP_VIEWBOX_HEIGHT}" fill="url(#mapGrid)" opacity="0.9"></rect>
                <polyline points="${routePath}" fill="none" stroke="#1f6f8b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"></polyline>
                <polyline points="${routePath}" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="3 6" opacity="0.72"></polyline>
                ${markers}
            </svg>
        </div>
        <div class="map-legend">${legend}</div>
    `;
}

/**
 * Генерирует подарочную HTML-версию квеста для печати.
 * Включает: обложку, карту, шаги с QR-кодами навигации, QR на сайт.
 */
export function generatePrintableQuest({ title, steps, intro, questUrl }: PrintableProps) {
    if (Platform.OS !== 'web') return;

    const validSteps = steps.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && (s.lat !== 0 || s.lng !== 0));
    const siteQr = questUrl ? qrUrl(questUrl, QR_SITE) : '';
    const mapSvg = buildPrintableMapSvg(validSteps);

    const stepsHtml = steps.map((step, i) => {
        const hasCoords = Number.isFinite(step.lat) && Number.isFinite(step.lng) && (step.lat !== 0 || step.lng !== 0);
        return `
        <div class="step">
            <div class="step-top">
                <div class="step-header">
                    <span class="step-num">${i + 1}</span>
                    <div>
                        <h3>${escHtml(step.title)}</h3>
                        <p class="location">${escHtml(step.location)}</p>
                    </div>
                </div>
                ${hasCoords ? `
                <div class="qr-nav">
                    <div class="qr-item"><img src="${qrUrl(googleMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}"><span>Google</span></div>
                    <div class="qr-item"><img src="${qrUrl(yandexMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}"><span>Yandex</span></div>
                    <div class="qr-item"><img src="${qrUrl(organicMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}"><span>Organic</span></div>
                </div>
                ` : ''}
            </div>
            <p class="story">${escHtml(step.story)}</p>
            <div class="task-box">
                <p class="task">${escHtml(step.task)}</p>
                ${step.hint ? `<p class="hint">${escHtml(step.hint)}</p>` : ''}
            </div>
            <div class="answer-box">
                <span class="answer-label">Ответ:</span>
                <div class="answer-line"></div>
            </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escHtml(title)} — Подарочная версия</title>
<style>
    :root {
        --ink: #1d2430;
        --muted: #5e6a78;
        --soft: #edf2f7;
        --line: #d4dde8;
        --brand: #1f6f8b;
        --brand-soft: #ecf6fa;
        --accent: #ffb703;
    }
    @page { margin: 14mm 10mm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Avenir Next', 'Segoe UI', sans-serif; color: var(--ink); line-height: 1.55; font-size: 10.5pt; background: #f3f7fb; }
    h1, h2, h3 { font-family: 'Merriweather', 'Georgia', serif; }
    .sheet {
        max-width: 860px;
        margin: 0 auto;
        padding: 18px 10px 28px;
        background: #fff;
    }

    .cover {
        text-align: center;
        padding: 34px 22px 28px;
        border-radius: 16px;
        margin-bottom: 18px;
        border: 1px solid #cdd8e5;
        background: linear-gradient(160deg, #f5faff 0%, #ffffff 55%, #fff8ea 100%);
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 28px rgba(18, 45, 67, 0.08);
    }
    .cover::after {
        content: '';
        position: absolute;
        width: 280px;
        height: 280px;
        right: -120px;
        top: -160px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(31,111,139,0.12) 0%, rgba(31,111,139,0) 70%);
        pointer-events: none;
    }
    .cover .gift-label {
        display: inline-block;
        font-size: 8.5pt;
        text-transform: uppercase;
        letter-spacing: 1.4px;
        color: var(--brand);
        border: 1px solid #b9d5e1;
        background: #ffffffb3;
        border-radius: 999px;
        padding: 3px 11px;
        margin-bottom: 10px;
    }
    .cover h1 { font-size: 23pt; color: #153f52; margin-bottom: 6px; line-height: 1.24; }
    .cover .subtitle { font-size: 10pt; color: var(--muted); margin-bottom: 12px; letter-spacing: 0.1px; }
    .cover .gift-line { width: 76px; height: 3px; background: var(--accent); margin: 0 auto 14px; border-radius: 99px; }
    .cover .site-qr { display: inline-block; }
    .cover .site-qr img { border-radius: 10px; border: 1px solid #d6dce5; background: #fff; }
    .cover .site-qr p { font-size: 8pt; color: var(--muted); margin-top: 6px; }
    .cover .for-line { margin-top: 16px; font-size: 10pt; color: var(--muted); }
    .cover .for-line span { display: inline-block; border-bottom: 1px solid #aeb7c4; min-width: 210px; margin-left: 6px; }

    .intro {
        background: var(--brand-soft);
        border: 1px solid #cde4ee;
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 18px;
    }
    .intro h2 { font-size: 11.5pt; color: #0f4c62; margin-bottom: 6px; }
    .intro p { font-size: 9.5pt; color: #344355; }
    .intro .note { margin-top: 8px; font-weight: 600; color: #0f4c62; font-size: 9pt; }

    .map-section {
        margin-bottom: 18px;
        page-break-inside: avoid;
        border: 1px solid #d7e4ef;
        border-radius: 12px;
        background: #fafdff;
        padding: 13px;
    }
    .map-section h2 { font-size: 11.5pt; color: #0f4c62; margin-bottom: 8px; }
    .map-card {
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
        box-shadow: inset 0 0 0 1px #f7f9fc;
    }
    .map-svg { display: block; width: 100%; height: auto; min-height: 220px; }
    .map-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 9px;
    }
    .map-chip {
        font-size: 7.8pt;
        border: 1px solid #d4e2ee;
        border-radius: 999px;
        padding: 3px 8px;
        background: #fff;
        color: #38506a;
    }
    .coords-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 10px; border-radius: 8px; overflow: hidden; }
    .coords-table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #9ab4c3; color: #3c4f63; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6px; }
    .coords-table td { padding: 5px 8px; border-bottom: 1px solid #edf0f4; }
    .coords-table .mono { font-family: 'Menlo', 'Consolas', monospace; font-size: 7.5pt; color: #6f7c8d; }

    .step {
        page-break-inside: avoid;
        margin-bottom: 12px;
        border: 1px solid #d7e2ee;
        border-radius: 12px;
        padding: 14px 14px 13px;
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        box-shadow: 0 3px 12px rgba(17, 45, 66, 0.05);
    }
    .step-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 14px; }
    .step-header { display: flex; align-items: flex-start; gap: 10px; flex: 1; }
    .step-num {
        display: flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; border-radius: 50%;
        background: var(--brand); color: #fff; font-weight: 700; font-size: 12pt; flex-shrink: 0;
    }
    .step-header h3 { font-size: 11.2pt; color: var(--ink); margin-bottom: 2px; line-height: 1.24; }
    .location { font-size: 8.8pt; color: #3e5c74; font-weight: 600; }
    .story { font-size: 9.35pt; color: #3e4b5b; margin-bottom: 10px; }
    .task-box {
        background: #f8fafc;
        border: 1px solid #dfe7f1;
        border-left: 4px solid var(--accent);
        padding: 9px 11px;
        border-radius: 8px;
        margin-bottom: 11px;
        box-shadow: inset 0 0 0 1px #f2f5f8;
    }
    .task { font-size: 9.8pt; font-weight: 700; color: #223042; }
    .hint { font-size: 8.4pt; color: #6b7685; margin-top: 5px; font-style: italic; }

    .qr-nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; min-width: 262px; }
    .qr-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 5px 4px 4px;
        border: 1px solid #d7e3ee;
        border-radius: 8px;
        background: #ffffffd9;
    }
    .qr-item img { border-radius: 6px; border: 1px solid #d9e2ee; background: #fff; }
    .qr-item span { font-size: 7pt; color: #5d6d7e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }

    .answer-box {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px dashed #c8d3e1;
        padding-top: 8px;
    }
    .answer-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #6a7789; font-weight: 700; white-space: nowrap; }
    .answer-line { flex: 1; border-bottom: 1px solid #8ea0b6; height: 22px; }

    .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid #d9e1ec; font-size: 8pt; color: #768397; }

    @media print {
        .no-print { display: none !important; }
        body { font-size: 10pt; }
        .sheet {
            max-width: none;
            margin: 0;
            padding: 0;
            background: #fff;
        }
        .cover,
        .step {
            box-shadow: none;
        }
    }
</style>
</head>
<body>
    <div class="no-print" style="text-align:center;padding:14px;background:#153f52;color:#fff;font-family:'Avenir Next','Segoe UI',sans-serif;">
        <button onclick="window.print()" style="background:#fff;color:#153f52;border:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:15px;cursor:pointer;margin-right:12px;">
            Распечатать / Сохранить PDF
        </button>
    </div>

    <main class="sheet">
    <div class="cover">
        <p class="gift-label">Подарочный квест</p>
        <h1>${escHtml(title)}</h1>
        <p class="subtitle">${steps.length} шагов · Приключение ждёт!</p>
        <div class="gift-line"></div>
        ${siteQr ? `
        <div class="site-qr">
            <img src="${siteQr}" width="${QR_SITE}" height="${QR_SITE}" alt="QR на квест">
            <p>Сканируйте, чтобы пройти квест онлайн</p>
        </div>
        ` : ''}
        <p class="for-line">Для:<span></span></p>
    </div>

    ${intro ? `
    <div class="intro">
        <h2>Как пройти квест</h2>
        <p>${escHtml(intro.story)}</p>
        <p class="note">Записывайте ответы от руки. Проверить их можно позднее на сайте, отсканировав QR-код на обложке.</p>
    </div>
    ` : ''}

    ${validSteps.length > 0 ? `
    <div class="map-section">
        <h2>Карта маршрута</h2>
        ${mapSvg}
        <table class="coords-table">
            <thead><tr><th>#</th><th>Локация</th><th>Координаты</th></tr></thead>
            <tbody>
                ${validSteps.map((s, i) => `<tr><td><b>${i + 1}</b></td><td>${escHtml(s.location)}</td><td class="mono">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</td></tr>`).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${stepsHtml}

    <div class="footer">
        ${escHtml(title)} · metravel.by · ${new Date().toLocaleDateString('ru-RU')}
    </div>
    </main>
</body>
</html>`;

    openBookPreviewWindow(html);
}

function escInline(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escHtml(str: string): string {
    return escInline(str)
        .replace(/\n/g, '<br>');
}
