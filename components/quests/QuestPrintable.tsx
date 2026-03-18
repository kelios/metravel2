import { Platform } from 'react-native';
import type { QuestStep } from './QuestWizard';

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
const MAP_IMAGE_WIDTH = 1200;
const MAP_IMAGE_HEIGHT = 520;
const MAP_IMAGE_ZOOM = 13;

type PrintableMapPoint = {
    lat: number;
    lng: number;
    num: number;
    location: string;
};

type MapImageGeneratorModule = typeof import('@/utils/mapImageGenerator');
type BookPreviewWindowModule = typeof import('@/utils/openBookPreviewWindow');

const PRINT_COLORS = {
    brand: 'rgb(31, 111, 139)',
    brandDark: 'rgb(15, 76, 98)',
    success: 'rgb(45, 106, 79)',
    white: 'rgb(255, 255, 255)',
    whiteSoft: 'rgba(255, 255, 255, 0.7)',
    whiteGlass: 'rgba(255, 255, 255, 0.85)',
    ink: 'rgb(29, 36, 48)',
    muted: 'rgb(94, 106, 120)',
    soft: 'rgb(237, 242, 247)',
    line: 'rgb(212, 221, 232)',
    brandSoft: 'rgb(236, 246, 250)',
    accent: 'rgb(255, 183, 3)',
    paperBg: 'rgb(243, 247, 251)',
    panelBorder: 'rgb(205, 216, 229)',
    panelBgStart: 'rgb(245, 250, 255)',
    panelBgEnd: 'rgb(255, 248, 234)',
    brandLine: 'rgb(185, 213, 225)',
    title: 'rgb(21, 63, 82)',
    lineMuted: 'rgb(174, 183, 196)',
    introBorder: 'rgb(205, 228, 238)',
    introText: 'rgb(52, 67, 85)',
    mapBorder: 'rgb(215, 228, 239)',
    mapBg: 'rgb(250, 253, 255)',
    mapGridBg: 'rgb(238, 247, 251)',
    mapGridBgEnd: 'rgb(247, 251, 255)',
    mapGridStroke: 'rgb(220, 233, 242)',
    chipBorder: 'rgb(212, 226, 238)',
    chipText: 'rgb(56, 80, 106)',
    tableBorder: 'rgb(154, 180, 195)',
    tableText: 'rgb(60, 79, 99)',
    tableRow: 'rgb(237, 240, 244)',
    tableMuted: 'rgb(111, 124, 141)',
    stepBorder: 'rgb(215, 226, 238)',
    stepBgEnd: 'rgb(251, 253, 255)',
    location: 'rgb(62, 92, 116)',
    story: 'rgb(62, 75, 91)',
    taskBg: 'rgb(248, 250, 252)',
    taskBorder: 'rgb(223, 231, 241)',
    taskInset: 'rgb(242, 245, 248)',
    taskText: 'rgb(34, 48, 66)',
    hint: 'rgb(107, 118, 133)',
    qrBorder: 'rgb(215, 227, 238)',
    qrImgBorder: 'rgb(217, 226, 238)',
    qrText: 'rgb(93, 109, 126)',
    answerBorder: 'rgb(200, 211, 225)',
    answerText: 'rgb(106, 119, 137)',
    answerLine: 'rgb(142, 160, 182)',
    footerBorder: 'rgb(217, 225, 236)',
    footerText: 'rgb(118, 131, 151)',
} as const;

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

function buildPrintableMapPoints(steps: QuestStep[]): PrintableMapPoint[] {
    return steps
        .filter((step) => Number.isFinite(step.lat) && Number.isFinite(step.lng) && (step.lat !== 0 || step.lng !== 0))
        .map((step, index) => ({
            lat: step.lat,
            lng: step.lng,
            num: index + 1,
            location: step.location || `Точка ${index + 1}`,
        }));
}

let mapImageGeneratorModulePromise: Promise<MapImageGeneratorModule> | null = null;
let bookPreviewWindowModulePromise: Promise<BookPreviewWindowModule> | null = null;

function loadMapImageGenerator(): Promise<MapImageGeneratorModule> {
    if (!mapImageGeneratorModulePromise) {
        mapImageGeneratorModulePromise = import('@/utils/mapImageGenerator');
    }

    return mapImageGeneratorModulePromise;
}

function loadBookPreviewWindowModule(): Promise<BookPreviewWindowModule> {
    if (!bookPreviewWindowModulePromise) {
        bookPreviewWindowModulePromise = import('@/utils/openBookPreviewWindow');
    }

    return bookPreviewWindowModulePromise;
}

async function buildPrintableStaticMapUrl(points: PrintableMapPoint[]): Promise<string> {
    if (!points.length) return '';

    const { generateStaticMapUrl } = await loadMapImageGenerator();

    return generateStaticMapUrl(
        points.map((point) => ({
            name: point.location,
            lat: point.lat,
            lng: point.lng,
        })),
        {
            width: MAP_IMAGE_WIDTH,
            height: MAP_IMAGE_HEIGHT,
            zoom: MAP_IMAGE_ZOOM,
        },
    );
}

async function buildPrintableLeafletMapDataUrl(points: PrintableMapPoint[]): Promise<string> {
    if (!points.length) return '';

    try {
        const { generateLeafletRouteSnapshot } = await loadMapImageGenerator();
        const snapshot = await generateLeafletRouteSnapshot(
            points.map((point) => ({
                lat: point.lat,
                lng: point.lng,
                label: `${point.num}. ${point.location}`,
            })),
            {
                width: MAP_IMAGE_WIDTH,
                height: MAP_IMAGE_HEIGHT,
                zoom: MAP_IMAGE_ZOOM,
                routeLine: points.map((point) => [point.lat, point.lng] as [number, number]),
            },
        );
        return snapshot || '';
    } catch {
        return '';
    }
}

function buildPrintableMapLegend(points: PrintableMapPoint[]): string {
    if (!points.length) return '';

    return points.map((point) => {
        return `<span class="map-chip"><b>${point.num}.</b> ${escInline(point.location)}</span>`;
    }).join('');
}

function buildPrintableMapSvg(points: PrintableMapPoint[]): string {

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
        const markerFill = isFirst ? PRINT_COLORS.brand : isLast ? PRINT_COLORS.brandDark : PRINT_COLORS.success;

        return `
            <g>
                <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="12.8" fill="${markerFill}" stroke="${PRINT_COLORS.white}" stroke-width="2.5"></circle>
                <text x="${point.x.toFixed(2)}" y="${(point.y + 4.1).toFixed(2)}" text-anchor="middle" font-size="10" font-family="'Avenir Next','Segoe UI',sans-serif" font-weight="700" fill="${PRINT_COLORS.white}">${point.num}</text>
            </g>
        `;
    }).join('');

    return `
        <svg class="map-svg" viewBox="0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}" role="img" aria-label="Схема маршрута квеста">
            <defs>
                <linearGradient id="mapBgGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${PRINT_COLORS.mapGridBg}"></stop>
                    <stop offset="100%" stop-color="${PRINT_COLORS.mapGridBgEnd}"></stop>
                </linearGradient>
                <pattern id="mapGrid" width="42" height="42" patternUnits="userSpaceOnUse">
                    <path d="M 42 0 L 0 0 0 42" fill="none" stroke="${PRINT_COLORS.mapGridStroke}" stroke-width="1"></path>
                </pattern>
            </defs>
            <rect x="0" y="0" width="${MAP_VIEWBOX_WIDTH}" height="${MAP_VIEWBOX_HEIGHT}" fill="url(#mapBgGradient)"></rect>
            <rect x="0" y="0" width="${MAP_VIEWBOX_WIDTH}" height="${MAP_VIEWBOX_HEIGHT}" fill="url(#mapGrid)" opacity="0.9"></rect>
            <polyline points="${routePath}" fill="none" stroke="${PRINT_COLORS.brand}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"></polyline>
            <polyline points="${routePath}" fill="none" stroke="${PRINT_COLORS.white}" stroke-width="1.2" stroke-dasharray="3 6" opacity="0.72"></polyline>
            ${markers}
        </svg>
    `;
}

/**
 * Генерирует подарочную HTML-версию квеста для печати.
 * Включает: обложку, карту, шаги с QR-кодами навигации, QR на сайт.
 */
export async function generatePrintableQuest({ title, steps, intro, questUrl }: PrintableProps): Promise<void> {
    if (Platform.OS !== 'web') return;

    const validSteps = steps.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && (s.lat !== 0 || s.lng !== 0));
    const mapPoints = buildPrintableMapPoints(validSteps);
    const siteQr = questUrl ? qrUrl(questUrl, QR_SITE) : '';
    const bookPreviewWindow = await loadBookPreviewWindowModule();
    const previewWindow = bookPreviewWindow.openPendingBookPreviewWindow();
    const mapLeafletDataUrl = await buildPrintableLeafletMapDataUrl(mapPoints);
    const mapStaticUrl = mapLeafletDataUrl || await buildPrintableStaticMapUrl(mapPoints);
    const mapSvg = buildPrintableMapSvg(mapPoints);
    const mapLegend = buildPrintableMapLegend(mapPoints);
    const mapHtml = mapStaticUrl ? `
        <div class="map-card">
            <img
                class="map-image"
                src="${escInline(mapStaticUrl)}"
                alt="Карта маршрута квеста"
                loading="eager"
                referrerpolicy="no-referrer"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block';"
            />
            <div class="map-fallback">${mapSvg}</div>
        </div>
    ` : `
        <div class="map-card">
            ${mapSvg}
        </div>
    `;

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
        --ink: ${PRINT_COLORS.ink};
        --muted: ${PRINT_COLORS.muted};
        --soft: ${PRINT_COLORS.soft};
        --line: ${PRINT_COLORS.line};
        --brand: ${PRINT_COLORS.brand};
        --brand-soft: ${PRINT_COLORS.brandSoft};
        --accent: ${PRINT_COLORS.accent};
    }
    @page { margin: 14mm 10mm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Avenir Next', 'Segoe UI', sans-serif; color: var(--ink); line-height: 1.55; font-size: 10.5pt; background: ${PRINT_COLORS.paperBg}; }
    h1, h2, h3 { font-family: 'Merriweather', 'Georgia', serif; }
    .sheet {
        max-width: 860px;
        margin: 0 auto;
        padding: 18px 10px 28px;
        background: ${PRINT_COLORS.white};
    }

    .cover {
        text-align: center;
        padding: 34px 22px 28px;
        border-radius: 16px;
        margin-bottom: 18px;
        border: 1px solid ${PRINT_COLORS.panelBorder};
        background: linear-gradient(160deg, ${PRINT_COLORS.panelBgStart} 0%, ${PRINT_COLORS.white} 55%, ${PRINT_COLORS.panelBgEnd} 100%);
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
        border: 1px solid ${PRINT_COLORS.brandLine};
        background: ${PRINT_COLORS.whiteSoft};
        border-radius: 999px;
        padding: 3px 11px;
        margin-bottom: 10px;
    }
    .cover h1 { font-size: 23pt; color: ${PRINT_COLORS.title}; margin-bottom: 6px; line-height: 1.24; }
    .cover .subtitle { font-size: 10pt; color: var(--muted); margin-bottom: 12px; letter-spacing: 0.1px; }
    .cover .gift-line { width: 76px; height: 3px; background: var(--accent); margin: 0 auto 14px; border-radius: 99px; }
    .cover .site-qr { display: inline-block; }
    .cover .site-qr img { border-radius: 10px; border: 1px solid rgb(214, 220, 229); background: ${PRINT_COLORS.white}; }
    .cover .site-qr p { font-size: 8pt; color: var(--muted); margin-top: 6px; }
    .cover .for-line { margin-top: 16px; font-size: 10pt; color: var(--muted); }
    .cover .for-line span { display: inline-block; border-bottom: 1px solid ${PRINT_COLORS.lineMuted}; min-width: 210px; margin-left: 6px; }

    .intro {
        background: var(--brand-soft);
        border: 1px solid ${PRINT_COLORS.introBorder};
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 18px;
    }
    .intro h2 { font-size: 11.5pt; color: ${PRINT_COLORS.brandDark}; margin-bottom: 6px; }
    .intro p { font-size: 9.5pt; color: ${PRINT_COLORS.introText}; }
    .intro .note { margin-top: 8px; font-weight: 600; color: ${PRINT_COLORS.brandDark}; font-size: 9pt; }

    .map-section {
        margin-bottom: 18px;
        page-break-inside: avoid;
        border: 1px solid ${PRINT_COLORS.mapBorder};
        border-radius: 12px;
        background: ${PRINT_COLORS.mapBg};
        padding: 13px;
    }
    .map-section h2 { font-size: 11.5pt; color: ${PRINT_COLORS.brandDark}; margin-bottom: 8px; }
    .map-card {
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: ${PRINT_COLORS.white};
        box-shadow: inset 0 0 0 1px rgb(247, 249, 252);
    }
    .map-image {
        display: block;
        width: 100%;
        height: auto;
        min-height: 220px;
        object-fit: cover;
        background: rgb(238, 243, 248);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .map-fallback { display: none; }
    .map-svg { display: block; width: 100%; height: auto; min-height: 220px; }
    .map-svg {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .map-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 9px;
    }
    .map-chip {
        font-size: 7.8pt;
        border: 1px solid ${PRINT_COLORS.chipBorder};
        border-radius: 999px;
        padding: 3px 8px;
        background: ${PRINT_COLORS.white};
        color: ${PRINT_COLORS.chipText};
    }
    .coords-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 10px; border-radius: 8px; overflow: hidden; }
    .coords-table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid ${PRINT_COLORS.tableBorder}; color: ${PRINT_COLORS.tableText}; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6px; }
    .coords-table td { padding: 5px 8px; border-bottom: 1px solid ${PRINT_COLORS.tableRow}; }
    .coords-table .mono { font-family: 'Menlo', 'Consolas', monospace; font-size: 7.5pt; color: ${PRINT_COLORS.tableMuted}; }

    .step {
        page-break-inside: avoid;
        margin-bottom: 12px;
        border: 1px solid ${PRINT_COLORS.stepBorder};
        border-radius: 12px;
        padding: 14px 14px 13px;
        background: linear-gradient(180deg, ${PRINT_COLORS.white} 0%, ${PRINT_COLORS.stepBgEnd} 100%);
        box-shadow: 0 3px 12px rgba(17, 45, 66, 0.05);
    }
    .step-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 14px; }
    .step-header { display: flex; align-items: flex-start; gap: 10px; flex: 1; }
    .step-num {
        display: flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; border-radius: 50%;
        background: var(--brand); color: ${PRINT_COLORS.white}; font-weight: 700; font-size: 12pt; flex-shrink: 0;
    }
    .step-header h3 { font-size: 11.2pt; color: var(--ink); margin-bottom: 2px; line-height: 1.24; }
    .location { font-size: 8.8pt; color: ${PRINT_COLORS.location}; font-weight: 600; }
    .story { font-size: 9.35pt; color: ${PRINT_COLORS.story}; margin-bottom: 10px; }
    .task-box {
        background: ${PRINT_COLORS.taskBg};
        border: 1px solid ${PRINT_COLORS.taskBorder};
        border-left: 4px solid var(--accent);
        padding: 9px 11px;
        border-radius: 8px;
        margin-bottom: 11px;
        box-shadow: inset 0 0 0 1px ${PRINT_COLORS.taskInset};
    }
    .task { font-size: 9.8pt; font-weight: 700; color: ${PRINT_COLORS.taskText}; }
    .hint { font-size: 8.4pt; color: ${PRINT_COLORS.hint}; margin-top: 5px; font-style: italic; }

    .qr-nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; min-width: 262px; }
    .qr-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 5px 4px 4px;
        border: 1px solid ${PRINT_COLORS.qrBorder};
        border-radius: 8px;
        background: ${PRINT_COLORS.whiteGlass};
    }
    .qr-item img { border-radius: 6px; border: 1px solid ${PRINT_COLORS.qrImgBorder}; background: ${PRINT_COLORS.white}; }
    .qr-item span { font-size: 7pt; color: ${PRINT_COLORS.qrText}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }

    .answer-box {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px dashed ${PRINT_COLORS.answerBorder};
        padding-top: 8px;
    }
    .answer-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: ${PRINT_COLORS.answerText}; font-weight: 700; white-space: nowrap; }
    .answer-line { flex: 1; border-bottom: 1px solid ${PRINT_COLORS.answerLine}; height: 22px; }

    .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px solid ${PRINT_COLORS.footerBorder}; font-size: 8pt; color: ${PRINT_COLORS.footerText}; }

    @media print {
        .no-print { display: none !important; }
        body { font-size: 10pt; }
        .sheet {
            max-width: none;
            margin: 0;
            padding: 0;
            background: ${PRINT_COLORS.white};
        }
        .cover,
        .step {
            box-shadow: none;
        }
    }
</style>
</head>
<body>
    <div class="no-print" style="text-align:center;padding:14px;background:${PRINT_COLORS.title};color:${PRINT_COLORS.white};font-family:'Avenir Next','Segoe UI',sans-serif;">
        <button onclick="window.print()" style="background:${PRINT_COLORS.white};color:${PRINT_COLORS.title};border:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:15px;cursor:pointer;margin-right:12px;">
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
        ${mapHtml}
        <div class="map-legend">${mapLegend}</div>
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

    bookPreviewWindow.openBookPreviewWindow(html, previewWindow);
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
