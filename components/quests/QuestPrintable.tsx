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
    @page { margin: 14mm 10mm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', 'Times New Roman', serif; color: #2c2c2c; line-height: 1.55; font-size: 10.5pt; background: #fff; }

    /* === ОБЛОЖКА === */
    .cover { text-align: center; padding: 40px 20px 30px; border: 3px double #2d6a4f; border-radius: 12px; margin-bottom: 24px; position: relative; }
    .cover::before { content: ''; position: absolute; inset: 6px; border: 1px solid #c5ddd2; border-radius: 8px; pointer-events: none; }
    .cover .gift-label { font-size: 9pt; text-transform: uppercase; letter-spacing: 3px; color: #888; margin-bottom: 8px; }
    .cover h1 { font-size: 24pt; color: #2d6a4f; margin-bottom: 4px; font-weight: 700; }
    .cover .subtitle { font-size: 10pt; color: #777; margin-bottom: 16px; }
    .cover .gift-line { width: 60px; height: 2px; background: #2d6a4f; margin: 0 auto 16px; border-radius: 1px; }
    .cover .site-qr { display: inline-block; }
    .cover .site-qr img { border-radius: 8px; border: 1px solid #e0e0e0; }
    .cover .site-qr p { font-size: 8pt; color: #999; margin-top: 6px; }
    .cover .for-line { margin-top: 20px; font-size: 11pt; color: #555; }
    .cover .for-line span { display: inline-block; border-bottom: 1px solid #bbb; min-width: 200px; margin-left: 6px; }

    /* === ИНСТРУКЦИЯ === */
    .intro { background: #f7faf8; border: 1px solid #d4e5dc; border-radius: 10px; padding: 16px 18px; margin-bottom: 22px; }
    .intro h2 { font-size: 11pt; color: #2d6a4f; margin-bottom: 6px; font-family: -apple-system, sans-serif; font-weight: 700; }
    .intro p { font-size: 9.5pt; color: #555; font-family: -apple-system, sans-serif; }
    .intro .note { margin-top: 8px; font-weight: 600; color: #2d6a4f; font-size: 9.5pt; }

    /* === КАРТА === */
    .map-section { margin-bottom: 22px; page-break-inside: avoid; }
    .map-section h2 { font-size: 11pt; color: #2d6a4f; margin-bottom: 8px; font-family: -apple-system, sans-serif; font-weight: 700; }
    .map-screenshot { width: 100%; border-radius: 10px; border: 1px solid #d4e5dc; }
    #quest-map { width: 100%; height: 380px; border-radius: 10px; border: 1px solid #d4e5dc; margin-bottom: 10px; z-index: 0; }
    .coords-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 10px; font-family: -apple-system, sans-serif; }
    .coords-table th { text-align: left; padding: 5px 8px; border-bottom: 2px solid #2d6a4f; color: #2d6a4f; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; }
    .coords-table td { padding: 4px 8px; border-bottom: 1px solid #eee; }
    .coords-table .mono { font-family: 'Courier New', monospace; font-size: 7.5pt; color: #999; }

    /* === ШАГ === */
    .step { page-break-inside: avoid; margin-bottom: 16px; border: 1px solid #d4e5dc; border-radius: 10px; padding: 14px 16px; background: #fefefe; }
    .step-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 12px; }
    .step-header { display: flex; align-items: flex-start; gap: 10px; flex: 1; }
    .step-num { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; background: #2d6a4f; color: #fff; font-weight: 700; font-size: 13pt; flex-shrink: 0; font-family: -apple-system, sans-serif; }
    .step-header h3 { font-size: 11pt; color: #1a1a1a; margin-bottom: 1px; }
    .location { font-size: 9pt; color: #2d6a4f; font-weight: 500; font-family: -apple-system, sans-serif; }
    .story { font-size: 9.5pt; color: #555; margin-bottom: 10px; }

    .task-box { background: #f7faf8; border-left: 3px solid #2d6a4f; padding: 10px 12px; border-radius: 0 8px 8px 0; margin-bottom: 10px; }
    .task { font-size: 10pt; font-weight: 600; color: #1a1a1a; font-family: -apple-system, sans-serif; }
    .hint { font-size: 8.5pt; color: #999; margin-top: 5px; font-style: italic; font-family: -apple-system, sans-serif; }

    .qr-nav { display: flex; gap: 8px; flex-shrink: 0; }
    .qr-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .qr-item img { border-radius: 4px; border: 1px solid #eee; }
    .qr-item span { font-size: 7pt; color: #888; font-weight: 500; font-family: -apple-system, sans-serif; }

    .answer-box { display: flex; align-items: center; gap: 8px; border-top: 1px dashed #d4e5dc; padding-top: 10px; }
    .answer-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #aaa; font-weight: 600; font-family: -apple-system, sans-serif; white-space: nowrap; }
    .answer-line { flex: 1; border-bottom: 1px solid #ccc; height: 22px; }

    /* === ПОДВАЛ === */
    .footer { text-align: center; margin-top: 28px; padding-top: 14px; border-top: 2px double #d4e5dc; font-size: 8pt; color: #aaa; font-family: -apple-system, sans-serif; }

    @media print {
        .no-print { display: none !important; }
        body { font-size: 10pt; }
    }
</style>
</head>
<body>
    <div class="no-print" style="text-align:center;padding:14px;background:#2d6a4f;color:#fff;font-family:-apple-system,sans-serif;">
        <button onclick="window.print()" style="background:#fff;color:#2d6a4f;border:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;margin-right:12px;">
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
