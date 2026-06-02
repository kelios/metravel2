import { Platform } from 'react-native';
import type { QuestStep } from './types';
import {
    QR_NAV,
    QR_SITE,
} from './printable/constants';
import { buildPrintableStyles } from './printable/styles';
import {
    buildPrintableMapPoints,
    escHtml,
    escInline,
    extractCoverLead,
    googleMapsUrl,
    organicMapsUrl,
    qrUrl,
    resolveStepImageUri,
    yandexMapsUrl,
} from './printable/utils';
import {
    buildPrintableCanvasMapDataUrl,
    buildPrintableLeafletMapDataUrl,
    buildPrintableMapSvg,
} from './printable/map';

type PrintableProps = {
    title: string;
    steps: QuestStep[];
    intro?: QuestStep;
    coverUrl?: string;
    questUrl?: string; // полный URL квеста на сайте
};

type BookPreviewWindowModule = typeof import('@/utils/openBookPreviewWindow');

let bookPreviewWindowModulePromise: Promise<BookPreviewWindowModule> | null = null;

function loadBookPreviewWindowModule(): Promise<BookPreviewWindowModule> {
    if (!bookPreviewWindowModulePromise) {
        bookPreviewWindowModulePromise = import('@/utils/openBookPreviewWindow');
    }

    return bookPreviewWindowModulePromise;
}

/**
 * Генерирует подарочную HTML-версию квеста для печати.
 * Включает: обложку, карту, шаги с QR-кодами навигации, QR на сайт.
 */
export async function generatePrintableQuest({ title, steps, intro, coverUrl, questUrl }: PrintableProps): Promise<void> {
    if (Platform.OS !== 'web') return;

    const validSteps = steps.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && (s.lat !== 0 || s.lng !== 0));
    const mapPoints = buildPrintableMapPoints(validSteps);
    const coverImageUri = resolveStepImageUri(coverUrl);
    const coverLead = extractCoverLead(intro?.story);
    const siteQr = questUrl ? qrUrl(questUrl, QR_SITE) : '';
    const bookPreviewWindow = await loadBookPreviewWindowModule();
    const previewWindow = bookPreviewWindow.openPendingBookPreviewWindow();
    const mapCanvasDataUrl = await buildPrintableCanvasMapDataUrl(mapPoints);
    const mapStaticUrl = mapCanvasDataUrl || await buildPrintableLeafletMapDataUrl(mapPoints);
    const mapSvg = buildPrintableMapSvg(mapPoints);

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
        const stepImageUri = resolveStepImageUri(step.image);
        return `
        <div class="step">
            <div class="step-eyebrow">
                <span class="step-num-badge">${i + 1}</span>
                <span class="step-eyebrow-divider"></span>
                <span class="step-location-label">${escHtml(step.location)}</span>
                ${hasCoords ? `<span class="step-coords-label">${step.lat.toFixed(4)}, ${step.lng.toFixed(4)}</span>` : ''}
                <span class="step-progress">${i + 1} / ${steps.length}</span>
            </div>
            <div class="step-body${stepImageUri ? '' : ' no-photo'}">
                ${stepImageUri ? `
                <div class="step-photo-wrap">
                    <img class="step-photo" src="${escInline(stepImageUri)}" alt="${escInline(step.title)}" loading="eager" referrerpolicy="no-referrer" />
                </div>
                ` : ''}
                <div class="step-content">
                    <h3 class="step-title">${escHtml(step.title)}</h3>
                    <p class="story">${escHtml(step.story)}</p>
                    <div class="task-box">
                        <div class="task-label-row">
                            <span class="task-label-icon">?</span>
                            <span class="task-label-text">Задание</span>
                        </div>
                        <p class="task">${escHtml(step.task)}</p>
                        ${step.hint ? `
                        <div class="hint-row">
                            <span class="hint-icon">i</span>
                            <p class="hint">${escHtml(step.hint)}</p>
                        </div>` : ''}
                    </div>
                    ${hasCoords ? `
                    <div class="qr-nav">
                        <span class="qr-nav-label">Навигация</span>
                        <div class="qr-items-row">
                            <div class="qr-item">
                                <img src="${qrUrl(googleMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}" alt="Google Maps">
                                <span>Google Maps</span>
                            </div>
                            <div class="qr-item">
                                <img src="${qrUrl(yandexMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}" alt="Yandex Maps">
                                <span>Яндекс</span>
                            </div>
                            <div class="qr-item">
                                <img src="${qrUrl(organicMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}" alt="Organic Maps">
                                <span>Organic Maps</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    <div class="answer-box">
                        <div class="answer-header">
                            <span class="answer-label">Мой ответ</span>
                            <span class="answer-label-line"></span>
                        </div>
                        <div class="answer-lines">
                            <div class="answer-line"></div>
                            <div class="answer-line"></div>
                            <div class="answer-line"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} — Подарочная книга квеста</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${buildPrintableStyles()}</style>
</head>
<body>
    <div class="toolbar no-print">
        <span class="toolbar-title">${escHtml(title)}</span>
        <button class="toolbar-btn" onclick="window.print()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Сохранить PDF
        </button>
    </div>

    <main class="sheet">

    <!-- ══════════ COVER ══════════ -->
    <div class="cover${coverImageUri ? ' has-cover-image' : ''}">
        ${coverImageUri ? `<div class="cover-image-backdrop" style="background-image:url('${escInline(coverImageUri)}')"></div>` : ''}
        <div class="cover-inner">
            <div class="cover-copy">
                <div class="cover-copy-panel">
                    <div class="cover-top-row">
                        <span class="cover-badge">&#10022; Подарочный квест</span>
                        <span class="cover-brand-top">metravel.by</span>
                    </div>
                    <h1>${escHtml(title)}</h1>
                    ${coverLead ? `<p class="cover-lead">${escHtml(coverLead)}</p>` : ''}
                    <div class="cover-meta">
                        <span class="cover-meta-chip">&#9673; ${steps.length} шагов</span>
                        <span class="cover-meta-chip">&#9654; Городское приключение</span>
                        <span class="cover-meta-chip">${today}</span>
                    </div>
                    <div class="cover-accent-line"></div>
                    <div class="cover-bottom">
                        <div class="cover-for-block">
                            <div class="cover-for-label">Для</div>
                            <span class="cover-for-line"></span>
                            <span class="cover-for-line"></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="cover-side">
                <div class="cover-stamp">Коллекционный<br>печатный выпуск</div>
                ${siteQr ? `
                <div class="cover-qr-block">
                    <img src="${siteQr}" width="${QR_SITE}" height="${QR_SITE}" alt="QR на квест">
                    <span class="cover-qr-label">Открыть онлайн-версию</span>
                </div>
                ` : ''}
            </div>
        </div>
    </div>

    <!-- ══════════ INTRO ══════════ -->
    ${intro ? `
    <div class="intro-section">
        <div class="intro-bar"></div>
        <div class="intro-content">
            <h2>Как пройти квест</h2>
            <p>${escHtml(intro.story)}</p>
            <p class="intro-note">Записывайте ответы от руки. Проверить их можно позднее на сайте, отсканировав QR-код на обложке.</p>
        </div>
    </div>
    ` : ''}

    <!-- ══════════ MAP ══════════ -->
    ${validSteps.length > 0 ? `
    <div class="map-section">
        <div class="section-label">
            <span class="section-label-text">Карта маршрута</span>
            <span class="section-label-line"></span>
        </div>
        ${mapHtml}
        <div class="map-table-wrap">
        <table class="map-route-table">
            <thead>
                <tr>
                    <th class="num-cell">#</th>
                    <th>Локация</th>
                    <th>Координаты</th>
                </tr>
            </thead>
            <tbody>
                ${validSteps.map((s, i) => `
                <tr>
                    <td class="num-cell">${i + 1}</td>
                    <td>${escHtml(s.location)}</td>
                    <td class="mono">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>
    </div>
    ` : ''}

    <!-- ══════════ STEPS ══════════ -->
    <div class="section-label" style="margin-bottom: 20px;">
        <span class="section-label-text">Шаги квеста</span>
        <span class="section-label-line"></span>
    </div>
    ${stepsHtml}

    <!-- ══════════ FOOTER ══════════ -->
    <div class="doc-footer">
        <div class="doc-footer-row">
            <span class="doc-footer-brand">metravel.by</span>
            <span class="doc-footer-dot"></span>
            <span>${escHtml(title)}</span>
            <span class="doc-footer-dot"></span>
            <span>${today}</span>
        </div>
        <span class="doc-footer-tagline">Создавайте свои маршруты и квесты на metravel.by</span>
    </div>

    </main>
</body>
</html>`;

    bookPreviewWindow.openBookPreviewWindow(html, previewWindow);
}
