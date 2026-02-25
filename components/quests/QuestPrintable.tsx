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

/**
 * Генерирует подарочную HTML-версию квеста для печати.
 * Включает: обложку, карту, шаги с QR-кодами навигации, QR на сайт.
 */
export function generatePrintableQuest({ title, steps, intro, questUrl }: PrintableProps) {
    if (Platform.OS !== 'web') return;

    const validSteps = steps.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && (s.lat !== 0 || s.lng !== 0));
    const siteQr = questUrl ? qrUrl(questUrl, QR_SITE) : '';

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
    body { font-family: 'Avenir Next', 'Segoe UI', sans-serif; color: var(--ink); line-height: 1.55; font-size: 10.5pt; background: #fff; }
    h1, h2, h3 { font-family: 'Merriweather', 'Georgia', serif; }

    .cover {
        text-align: center;
        padding: 34px 22px 28px;
        border-radius: 16px;
        margin-bottom: 22px;
        border: 1px solid #cdd8e5;
        background: linear-gradient(160deg, #f5faff 0%, #ffffff 55%, #fff8ea 100%);
        position: relative;
        overflow: hidden;
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
    .cover .subtitle { font-size: 10pt; color: var(--muted); margin-bottom: 14px; }
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
        margin-bottom: 20px;
    }
    .intro h2 { font-size: 11.5pt; color: #0f4c62; margin-bottom: 6px; }
    .intro p { font-size: 9.5pt; color: #344355; }
    .intro .note { margin-top: 8px; font-weight: 600; color: #0f4c62; font-size: 9pt; }

    .map-section { margin-bottom: 20px; page-break-inside: avoid; }
    .map-section h2 { font-size: 11.5pt; color: #0f4c62; margin-bottom: 8px; }
    #quest-map { width: 100%; height: 380px; border-radius: 12px; border: 1px solid var(--line); margin-bottom: 10px; z-index: 0; }
    .coords-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 10px; }
    .coords-table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #9ab4c3; color: #3c4f63; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6px; }
    .coords-table td { padding: 5px 8px; border-bottom: 1px solid #edf0f4; }
    .coords-table .mono { font-family: 'Menlo', 'Consolas', monospace; font-size: 7.5pt; color: #6f7c8d; }

    .step {
        page-break-inside: avoid;
        margin-bottom: 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 14px 14px 12px;
        background: #fff;
    }
    .step-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 12px; }
    .step-header { display: flex; align-items: flex-start; gap: 10px; flex: 1; }
    .step-num {
        display: flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; border-radius: 50%;
        background: var(--brand); color: #fff; font-weight: 700; font-size: 12pt; flex-shrink: 0;
    }
    .step-header h3 { font-size: 11pt; color: var(--ink); margin-bottom: 1px; line-height: 1.25; }
    .location { font-size: 8.8pt; color: #3e5c74; font-weight: 600; }
    .story { font-size: 9.3pt; color: #3e4b5b; margin-bottom: 10px; }
    .task-box {
        background: #f8fafc;
        border: 1px solid #dfe7f1;
        border-left: 4px solid var(--accent);
        padding: 9px 11px;
        border-radius: 8px;
        margin-bottom: 10px;
    }
    .task { font-size: 9.8pt; font-weight: 700; color: #223042; }
    .hint { font-size: 8.4pt; color: #6b7685; margin-top: 5px; font-style: italic; }

    .qr-nav { display: flex; gap: 6px; flex-shrink: 0; }
    .qr-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .qr-item img { border-radius: 6px; border: 1px solid #d9e2ee; background: #fff; }
    .qr-item span { font-size: 7pt; color: #5d6d7e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }

    .answer-box {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px dashed #c8d3e1;
        padding-top: 9px;
    }
    .answer-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #6a7789; font-weight: 700; white-space: nowrap; }
    .answer-line { flex: 1; border-bottom: 1px solid #8ea0b6; height: 22px; }

    .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #d9e1ec; font-size: 8pt; color: #768397; }

    @media print {
        .no-print { display: none !important; }
        body { font-size: 10pt; }
    }
</style>
</head>
<body>
    <div class="no-print" style="text-align:center;padding:14px;background:#153f52;color:#fff;font-family:'Avenir Next','Segoe UI',sans-serif;">
        <button onclick="window.print()" style="background:#fff;color:#153f52;border:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:15px;cursor:pointer;margin-right:12px;">
            Распечатать / Сохранить PDF
        </button>
    </div>

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
        <div id="quest-map"></div>
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

    ${validSteps.length > 0 ? `
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><${'/'}script>
    <script>
    (function() {
        var pts = ${JSON.stringify(validSteps.map((s, i) => ({ lat: s.lat, lng: s.lng, num: i + 1, loc: s.location })))};
        var map = L.map('quest-map', { zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
        var bounds = [];
        pts.forEach(function(p) {
            var icon = L.divIcon({
                className: '',
                html: '<div style="background:#2d6a4f;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);">' + p.num + '</div>',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindTooltip(p.num + '. ' + p.loc, { direction: 'top', offset: [0, -14] });
            bounds.push([p.lat, p.lng]);
        });
        if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
    })();
    <${'/'}script>
    ` : ''}
</body>
</html>`;

    openBookPreviewWindow(html);
}

function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}
