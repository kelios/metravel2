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
import {
    formatDate,
    getActiveLocaleDefinition,
    translate as i18nT,
    translatePlural,
} from '@/i18n'


type PrintableProps = {
    title: string;
    steps: QuestStep[];
    intro?: QuestStep;
    coverUrl?: string;
    questUrl?: string; // полный URL квеста на сайте
    finaleText?: string; // текст финала — печатается на странице с дипломом
    closeLoop?: boolean; // кольцевой квест: линия маршрута на карте замыкается к старту
};

type BookPreviewWindowModule = typeof import('@/utils/openBookPreviewWindow');

let bookPreviewWindowModulePromise: Promise<BookPreviewWindowModule> | null = null;

function loadBookPreviewWindowModule(): Promise<BookPreviewWindowModule> {
    if (!bookPreviewWindowModulePromise) {
        bookPreviewWindowModulePromise = Promise.resolve(import('@/utils/openBookPreviewWindow'));
    }

    return bookPreviewWindowModulePromise;
}

/**
 * Генерирует подарочную HTML-версию квеста для печати.
 * Включает: обложку, карту, шаги с QR-кодами навигации, QR на сайт.
 */
export async function generatePrintableQuest({ title, steps, intro, coverUrl, questUrl, finaleText, closeLoop }: PrintableProps): Promise<void> {
    if (Platform.OS !== 'web') return;

    const validSteps = steps.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && (s.lat !== 0 || s.lng !== 0));
    const mapPoints = buildPrintableMapPoints(validSteps);
    const coverImageUri = resolveStepImageUri(coverUrl);
    const coverLead = extractCoverLead(intro?.story);
    const siteQr = questUrl ? qrUrl(questUrl, QR_SITE) : '';
    const bookPreviewWindow = await loadBookPreviewWindowModule();
    const previewWindow = bookPreviewWindow.openPendingBookPreviewWindow();
    const mapCanvasDataUrl = await buildPrintableCanvasMapDataUrl(mapPoints, closeLoop);
    const mapStaticUrl = mapCanvasDataUrl || await buildPrintableLeafletMapDataUrl(mapPoints, closeLoop);
    const mapSvg = buildPrintableMapSvg(mapPoints, closeLoop);
    const locale = getActiveLocaleDefinition();

    const mapHtml = mapStaticUrl ? `
        <div class="map-card">
            <img
                class="map-image"
                src="${escInline(mapStaticUrl)}"
                alt="${escInline(i18nT('quests:components.quests.QuestPrintable.mapAlt'))}"
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
                            <span class="task-label-text">${escHtml(i18nT('quests:components.quests.QuestPrintable.task'))}</span>
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
                        <span class="qr-nav-label">${escHtml(i18nT('quests:components.quests.QuestPrintable.navigation'))}</span>
                        <div class="qr-items-row">
                            <div class="qr-item">
                                <img src="${qrUrl(googleMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}" alt="Google Maps">
                                <span>Google Maps</span>
                            </div>
                            <div class="qr-item">
                                <img src="${qrUrl(yandexMapsUrl(step.lat, step.lng))}" width="${QR_NAV}" height="${QR_NAV}" alt="Yandex Maps">
                                <span>${escHtml(i18nT('quests:components.quests.QuestFullMap.navigation.yandex'))}</span>
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
                            <span class="answer-label">${escHtml(i18nT('quests:components.quests.QuestPrintable.myAnswer'))}</span>
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

    const today = formatDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="${locale.htmlLang}" dir="${locale.direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} — ${escHtml(i18nT('quests:components.quests.QuestPrintable.bookTitle'))}</title>
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
            ${escHtml(i18nT('quests:components.quests.QuestPrintable.savePdf'))}
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
                        <span class="cover-badge">&#10022; ${escHtml(i18nT('quests:components.quests.QuestPrintable.giftQuest'))}</span>
                        <span class="cover-brand-top">metravel.by</span>
                    </div>
                    <h1>${escHtml(title)}</h1>
                    ${coverLead ? `<p class="cover-lead">${escHtml(coverLead)}</p>` : ''}
                    <div class="cover-meta">
                        <span class="cover-meta-chip">&#9673; ${escHtml(translatePlural('quests:components.quests.QuestPrintable.stepsCount', steps.length))}</span>
                        <span class="cover-meta-chip">&#9654; ${escHtml(i18nT('quests:components.quests.QuestPrintable.cityAdventure'))}</span>
                        <span class="cover-meta-chip">${today}</span>
                    </div>
                    <div class="cover-accent-line"></div>
                    <div class="cover-bottom">
                        <div class="cover-for-block">
                            <div class="cover-for-label">${escHtml(i18nT('quests:components.quests.QuestPrintable.recipient'))}</div>
                            <span class="cover-for-line"></span>
                            <span class="cover-for-line"></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="cover-side">
                <div class="cover-stamp">${escHtml(i18nT('quests:components.quests.QuestPrintable.collectorEditionLine1'))}<br>${escHtml(i18nT('quests:components.quests.QuestPrintable.collectorEditionLine2'))}</div>
                ${siteQr ? `
                <div class="cover-qr-block">
                    <img src="${siteQr}" width="${QR_SITE}" height="${QR_SITE}" alt="${escInline(i18nT('quests:components.quests.QuestPrintable.questQrAlt'))}">
                    <span class="cover-qr-label">${escHtml(i18nT('quests:components.quests.QuestPrintable.openOnline'))}</span>
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
            <h2>${escHtml(i18nT('quests:components.quests.QuestPrintable.howToComplete'))}</h2>
            <p>${escHtml(intro.story)}</p>
            <p class="intro-note">${escHtml(i18nT('quests:components.quests.QuestPrintable.introNote'))}</p>
        </div>
    </div>
    ` : ''}

    <!-- ══════════ MAP ══════════ -->
    ${validSteps.length > 0 ? `
    <div class="map-section">
        <div class="section-label">
            <span class="section-label-text">${escHtml(i18nT('quests:components.quests.QuestPrintable.routeMap'))}</span>
            <span class="section-label-line"></span>
        </div>
        ${mapHtml}
        <div class="map-table-wrap">
        <table class="map-route-table">
            <thead>
                <tr>
                    <th class="num-cell">#</th>
                    <th>${escHtml(i18nT('quests:components.quests.QuestPrintable.location'))}</th>
                    <th>${escHtml(i18nT('quests:components.quests.QuestPrintable.coordinates'))}</th>
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
        <span class="section-label-text">${escHtml(i18nT('quests:components.quests.QuestPrintable.stepsSection'))}</span>
        <span class="section-label-line"></span>
    </div>
    ${stepsHtml}

    <!-- ══════════ FINALE + DIPLOMA ══════════ -->
    <div class="diploma-page">
        ${finaleText ? `
        <div class="finale-block">
            <div class="section-label">
                <span class="section-label-text">${escHtml(i18nT('quests:components.quests.QuestPrintable.finaleTitle'))}</span>
                <span class="section-label-line"></span>
            </div>
            <p class="finale-text">${escHtml(finaleText)}</p>
            <p class="finale-spoiler-note">${escHtml(i18nT('quests:components.quests.QuestPrintable.finaleSpoilerNote'))}</p>
        </div>
        ` : ''}
        <div class="diploma">
            <div class="diploma-frame">
                <span class="diploma-badge">&#10022;</span>
                <div class="diploma-brand">metravel.by</div>
                <h2 class="diploma-title">${escHtml(i18nT('quests:components.quests.QuestPrintable.diplomaTitle'))}</h2>
                <p class="diploma-subtitle">${escHtml(i18nT('quests:components.quests.QuestPrintable.diplomaSubtitle'))}</p>
                <p class="diploma-quest-name">&#171;${escHtml(title)}&#187;</p>
                <div class="diploma-field">
                    <span class="diploma-field-label">${escHtml(i18nT('quests:components.quests.QuestPrintable.diplomaName'))}</span>
                    <span class="diploma-field-line"></span>
                </div>
                <div class="diploma-field-row">
                    <div class="diploma-field">
                        <span class="diploma-field-label">${escHtml(i18nT('quests:components.quests.QuestPrintable.diplomaDate'))}</span>
                        <span class="diploma-field-line"></span>
                    </div>
                    <div class="diploma-field">
                        <span class="diploma-field-label">${escHtml(i18nT('quests:components.quests.QuestPrintable.diplomaLeader'))}</span>
                        <span class="diploma-field-line"></span>
                    </div>
                </div>
                <p class="diploma-footer">${escHtml(i18nT('quests:components.quests.QuestPrintable.diplomaFooter'))}</p>
            </div>
        </div>
    </div>

    <!-- ══════════ LEADER ANSWERS ══════════ -->
    <div class="leader-page">
        <div class="leader-frame">
            <div class="leader-header">
                <span class="leader-scissors">&#9986;</span>
                <h2 class="leader-title">${escHtml(i18nT('quests:components.quests.QuestPrintable.leaderTitle'))}</h2>
            </div>
            <p class="leader-note">${escHtml(i18nT('quests:components.quests.QuestPrintable.leaderNote'))}</p>
            <table class="leader-table">
                <thead>
                    <tr>
                        <th class="num-cell">#</th>
                        <th>${escHtml(i18nT('quests:components.quests.QuestPrintable.leaderStepCol'))}</th>
                        <th>${escHtml(i18nT('quests:components.quests.QuestPrintable.leaderAnswerCol'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${steps.map((s, i) => `
                    <tr>
                        <td class="num-cell">${i + 1}</td>
                        <td>${escHtml(s.title)}</td>
                        <td class="leader-answer">${s.answerDisplay ? escHtml(s.answerDisplay) : `<span class="leader-free">${escHtml(i18nT('quests:components.quests.QuestPrintable.leaderAnswerFree'))}</span>`}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- ══════════ FOOTER ══════════ -->
    <div class="doc-footer">
        <div class="doc-footer-row">
            <span class="doc-footer-brand">metravel.by</span>
            <span class="doc-footer-dot"></span>
            <span>${escHtml(title)}</span>
            <span class="doc-footer-dot"></span>
            <span>${today}</span>
        </div>
        <span class="doc-footer-tagline">${escHtml(i18nT('quests:components.quests.QuestPrintable.footerTagline'))}</span>
    </div>

    </main>
</body>
</html>`;

    bookPreviewWindow.openBookPreviewWindow(html, previewWindow);
}
