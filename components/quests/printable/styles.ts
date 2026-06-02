import { PRINT_COLORS } from './constants';

/**
 * CSS-стили подарочной печатной версии квеста.
 * Вынесено из QuestPrintable.tsx без изменения поведения.
 */
export function buildPrintableStyles(): string {
    return `
    @page {
        margin: 14mm 13mm 14mm 13mm;
        size: A4;
        @bottom-right {
            content: counter(page);
            font-family: Inter, sans-serif;
            font-size: 7.5pt;
            color: ${PRINT_COLORS.pageNumColor};
        }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: Inter, 'Segoe UI', system-ui, sans-serif;
        color: ${PRINT_COLORS.ink};
        line-height: 1.6;
        font-size: 10pt;
        background: ${PRINT_COLORS.paperBg};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    h1, h2, h3, .serif {
        font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    }

    /* ─── TOOLBAR ────────────────────────────────────── */
    .toolbar {
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 11px 28px;
        background: ${PRINT_COLORS.titleDark};
        color: ${PRINT_COLORS.white};
        font-family: Inter, sans-serif;
        font-size: 13px;
        gap: 16px;
        border-bottom: 2px solid ${PRINT_COLORS.brand};
    }
    .toolbar-title { font-weight: 500; opacity: 0.8; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
    .toolbar-btn {
        display: inline-flex; align-items: center; gap: 8px;
        background: ${PRINT_COLORS.accent};
        color: ${PRINT_COLORS.titleDark};
        border: none;
        padding: 9px 24px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        letter-spacing: 0.2px;
        white-space: nowrap;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(232,160,32,0.35);
    }
    .toolbar-btn:hover { opacity: 0.9; transform: translateY(-1px); }

    /* ─── SHEET ──────────────────────────────────────── */
    .sheet {
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 28px 60px;
        background: ${PRINT_COLORS.white};
        min-height: 100vh;
    }

    /* ─── COVER ──────────────────────────────────────── */
    .cover {
        position: relative;
        border-radius: 24px;
        overflow: hidden;
        margin-bottom: 32px;
        min-height: 456px;
        background:
            linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 34%),
            linear-gradient(145deg, ${PRINT_COLORS.coverDark} 0%, ${PRINT_COLORS.brandDark} 42%, ${PRINT_COLORS.brand} 100%);
        box-shadow: 0 24px 70px rgba(7, 26, 40, 0.26), 0 6px 18px rgba(7,26,40,0.12);
        page-break-after: avoid;
    }
    .cover-image-backdrop {
        position: absolute;
        inset: 0;
        background-position: center center;
        background-repeat: no-repeat;
        background-size: cover;
        transform: scale(1.04);
        transform-origin: center;
    }
    .cover-image-backdrop::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
            linear-gradient(90deg, rgba(7,26,40,0.82) 0%, rgba(7,26,40,0.7) 34%, rgba(7,26,40,0.3) 68%, rgba(7,26,40,0.52) 100%),
            linear-gradient(180deg, rgba(7,26,40,0.18) 0%, rgba(7,26,40,0.08) 20%, rgba(7,26,40,0.42) 100%);
        pointer-events: none;
    }
    .cover-inner {
        position: relative;
        z-index: 2;
        padding: 34px 36px 34px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 220px;
        gap: 20px;
        min-height: 456px;
    }
    .cover-copy {
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 2px 0 8px;
    }
    .cover-copy-panel {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        max-width: 560px;
        padding: 24px 28px 24px;
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(8,24,36,0.3) 0%, rgba(8,24,36,0.2) 100%);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 44px rgba(0,0,0,0.18);
        backdrop-filter: blur(5px);
    }
    .cover-side {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: stretch;
        gap: 16px;
        padding: 6px 0;
    }
    .cover-top-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 40px;
    }
    .cover-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-family: Inter, sans-serif;
        font-size: 7pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.9px;
        color: ${PRINT_COLORS.accent};
        background: rgba(232,160,32,0.13);
        border: 1px solid rgba(232,160,32,0.28);
        border-radius: 999px;
        padding: 7px 14px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
    }
    .cover-brand-top {
        font-family: Inter, sans-serif;
        font-size: 7.2pt;
        color: rgba(255,255,255,0.34);
        font-weight: 700;
        letter-spacing: 1.4px;
        text-transform: uppercase;
    }
    .cover h1 {
        font-size: 33pt;
        font-weight: 800;
        color: ${PRINT_COLORS.white};
        line-height: 1.02;
        letter-spacing: -1.1px;
        margin-bottom: 18px;
        max-width: 500px;
        text-wrap: balance;
        text-shadow: 0 4px 16px rgba(0,0,0,0.28);
    }
    .cover-lead {
        max-width: 430px;
        margin-bottom: 20px;
        font-size: 10.2pt;
        line-height: 1.65;
        color: rgba(255,255,255,0.74);
        font-weight: 500;
    }
    .cover-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
        flex-wrap: wrap;
    }
    .cover-meta-chip {
        font-family: Inter, sans-serif;
        font-size: 7.6pt;
        color: rgba(255,255,255,0.88);
        background: rgba(255,255,255,0.11);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 999px;
        padding: 5px 11px;
        display: flex;
        align-items: center;
        gap: 5px;
        backdrop-filter: blur(4px);
    }
    .cover-accent-line {
        width: 68px;
        height: 3px;
        background: linear-gradient(90deg, ${PRINT_COLORS.coverAccentLine}, rgba(232,160,32,0.3));
        border-radius: 99px;
        margin-bottom: 22px;
    }
    .cover-bottom {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        margin-top: auto;
    }
    .cover-for-block {
        flex: 1;
        max-width: 320px;
    }
    .cover-for-label {
        font-family: Inter, sans-serif;
        font-size: 7pt;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 1.5px;
        font-weight: 600;
        margin-bottom: 8px;
    }
    .cover-for-line {
        display: block;
        border-bottom: 1px solid rgba(255,255,255,0.25);
        width: 260px;
        height: 28px;
    }
    .cover-for-line + .cover-for-line {
        margin-top: 2px;
    }
    .cover-stamp {
        align-self: flex-end;
        min-width: 150px;
        padding: 16px 18px;
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%);
        border: 1px solid rgba(255,255,255,0.16);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.16);
        text-align: left;
        font-size: 7pt;
        line-height: 1.45;
        text-transform: uppercase;
        letter-spacing: 1.4px;
        color: rgba(255,255,255,0.88);
        font-weight: 700;
        backdrop-filter: blur(5px);
    }
    .cover-qr-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 9px;
        background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.07) 100%);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 20px;
        padding: 16px 16px 14px;
        backdrop-filter: blur(4px);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
    }
    .cover-qr-block img {
        border-radius: 10px;
        background: ${PRINT_COLORS.white};
        display: block;
        padding: 5px;
    }
    .cover-qr-label {
        font-size: 6.6pt;
        color: rgba(255,255,255,0.74);
        font-family: Inter, sans-serif;
        text-align: center;
        line-height: 1.4;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
    }

    /* ─── INTRO ──────────────────────────────────────── */
    .intro-section {
        margin-bottom: 32px;
        display: grid;
        grid-template-columns: 4px 1fr;
        gap: 0 20px;
        page-break-inside: avoid;
    }
    .intro-bar {
        background: linear-gradient(180deg, ${PRINT_COLORS.brand}, ${PRINT_COLORS.brandLight});
        border-radius: 99px;
    }
    .intro-content {
        padding: 24px 26px;
        background: linear-gradient(180deg, rgba(235,245,250,0.78) 0%, rgba(255,255,255,0.96) 100%);
        border-radius: 18px;
        border: 1px solid ${PRINT_COLORS.introBorder};
        box-shadow: 0 8px 24px rgba(15,52,80,0.06);
    }
    .intro-section h2 {
        font-size: 15pt;
        color: ${PRINT_COLORS.brandDark};
        margin-bottom: 14px;
    }
    .intro-section p {
        font-size: 9.7pt;
        color: ${PRINT_COLORS.introText};
        line-height: 1.82;
    }
    .intro-note {
        margin-top: 18px;
        padding: 12px 14px 0 0;
        border-top: 1px dashed ${PRINT_COLORS.introBorder};
        font-size: 8.4pt;
        color: ${PRINT_COLORS.brandDark};
        font-weight: 500;
        line-height: 1.6;
    }

    /* ─── SECTION LABEL ──────────────────────────────── */
    .section-label {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 18px;
        margin-top: 4px;
    }
    .section-label-text {
        font-family: Inter, sans-serif;
        font-size: 7pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2.5px;
        color: ${PRINT_COLORS.brand};
        white-space: nowrap;
        padding: 3px 10px;
        background: ${PRINT_COLORS.brandSoft};
        border-radius: 999px;
        border: 1px solid ${PRINT_COLORS.brandLine};
    }
    .section-label-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, ${PRINT_COLORS.brandLine}, transparent);
    }

    /* ─── MAP SECTION ────────────────────────────────── */
    .map-section {
        margin-bottom: 36px;
        page-break-inside: avoid;
    }
    .map-card {
        border-radius: 16px;
        overflow: hidden;
        background: ${PRINT_COLORS.white};
        border: 1px solid ${PRINT_COLORS.mapBorder};
        box-shadow: 0 6px 24px rgba(15,52,80,0.09);
        margin-bottom: 0;
    }
    .map-image {
        display: block;
        width: 100%;
        height: auto;
        min-height: 260px;
        object-fit: cover;
        background: ${PRINT_COLORS.mapGridBg};
        filter: saturate(1.12) contrast(1.04);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .map-fallback { display: none; }
    .map-svg { display: block; width: 100%; height: auto; min-height: 260px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .map-table-wrap {
        border: 1px solid ${PRINT_COLORS.mapBorder};
        border-top: none;
        border-radius: 0 0 16px 16px;
        overflow: hidden;
        margin-bottom: 0;
    }
    .map-route-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 8pt;
        font-family: Inter, sans-serif;
    }
    .map-route-table th {
        text-align: left;
        padding: 8px 12px;
        background: ${PRINT_COLORS.brandDark};
        color: rgba(255,255,255,0.7);
        font-size: 6.5pt;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        font-weight: 700;
    }
    .map-route-table tr:nth-child(odd) td { background: ${PRINT_COLORS.white}; }
    .map-route-table tr:nth-child(even) td { background: ${PRINT_COLORS.tableRow}; }
    .map-route-table td {
        padding: 6px 12px;
        border-bottom: 1px solid ${PRINT_COLORS.line};
        color: ${PRINT_COLORS.story};
        font-size: 8pt;
    }
    .map-route-table .num-cell {
        width: 32px;
        font-weight: 800;
        color: ${PRINT_COLORS.brand};
        font-size: 9pt;
    }
    .map-route-table .mono {
        font-family: 'Menlo', 'Consolas', monospace;
        font-size: 7pt;
        color: ${PRINT_COLORS.tableMuted};
    }

    /* ─── STEP ───────────────────────────────────────── */
    .step {
        page-break-inside: avoid;
        margin-bottom: 30px;
        border: 1px solid ${PRINT_COLORS.stepBorder};
        border-radius: 18px;
        overflow: hidden;
        background: ${PRINT_COLORS.white};
        box-shadow: 0 6px 20px rgba(15,52,80,0.05), 0 1px 2px rgba(15,52,80,0.03);
    }
    .step-eyebrow {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 20px;
        background: linear-gradient(90deg, ${PRINT_COLORS.stepHeaderBg} 0%, ${PRINT_COLORS.brandDark} 100%);
    }
    .step-num-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${PRINT_COLORS.accent};
        color: ${PRINT_COLORS.titleDark};
        font-weight: 800;
        font-size: 10pt;
        font-family: Inter, sans-serif;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .step-eyebrow-divider {
        width: 1px;
        height: 18px;
        background: rgba(255,255,255,0.18);
        flex-shrink: 0;
    }
    .step-location-label {
        font-size: 8.5pt;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
        font-family: Inter, sans-serif;
        flex: 1;
        letter-spacing: 0.2px;
    }
    .step-coords-label {
        font-size: 6.5pt;
        font-family: 'Menlo', 'Consolas', monospace;
        color: rgba(255,255,255,0.35);
        flex-shrink: 0;
    }
    .step-progress {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
        font-size: 6.5pt;
        color: rgba(255,255,255,0.4);
        font-family: Inter, sans-serif;
        font-weight: 600;
        letter-spacing: 0.3px;
        flex-shrink: 0;
    }
    .step-body {
        display: grid;
        grid-template-columns: 200px 1fr;
    }
    .step-body.no-photo {
        grid-template-columns: 1fr;
    }
    .step-photo-wrap {
        width: 200px;
        overflow: hidden;
        background: ${PRINT_COLORS.stepPhotoBg};
        border-right: 1px solid ${PRINT_COLORS.stepBorder};
        flex-shrink: 0;
    }
    .step-photo {
        display: block;
        width: 200px;
        height: 100%;
        min-height: 200px;
        object-fit: cover;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .step-content {
        padding: 20px 22px 18px;
        min-width: 0;
    }
    .step-title {
        font-size: 13.5pt;
        color: ${PRINT_COLORS.title};
        margin-bottom: 9px;
        line-height: 1.22;
        font-weight: 700;
    }
    .story {
        font-size: 9.2pt;
        color: ${PRINT_COLORS.story};
        line-height: 1.74;
        margin-bottom: 14px;
    }

    /* ─── TASK BOX ───────────────────────────────────── */
    .task-box {
        background: linear-gradient(180deg, ${PRINT_COLORS.taskBg} 0%, ${PRINT_COLORS.taskInset} 100%);
        border: 1px solid ${PRINT_COLORS.taskBorder};
        border-left: 3px solid ${PRINT_COLORS.accent};
        padding: 12px 14px;
        border-radius: 12px;
        margin-bottom: 14px;
    }
    .task-label-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 5px;
    }
    .task-label-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${PRINT_COLORS.accent};
        color: ${PRINT_COLORS.white};
        font-weight: 900;
        font-size: 8pt;
        font-family: Inter, sans-serif;
        flex-shrink: 0;
    }
    .task-label-text {
        font-size: 6.5pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1.8px;
        color: ${PRINT_COLORS.accentDark};
        font-family: Inter, sans-serif;
    }
    .task {
        font-size: 10pt;
        font-weight: 600;
        color: ${PRINT_COLORS.taskText};
        line-height: 1.5;
        font-family: Inter, sans-serif;
    }
    .hint-row {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed rgba(196,132,26,0.3);
    }
    .hint-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${PRINT_COLORS.hintIcon};
        color: ${PRINT_COLORS.white};
        font-size: 8pt;
        font-weight: 900;
        font-family: Inter, sans-serif;
        flex-shrink: 0;
        font-style: normal;
    }
    .hint {
        font-size: 8pt;
        color: ${PRINT_COLORS.hint};
        font-style: italic;
        line-height: 1.55;
    }

    /* ─── QR NAV ─────────────────────────────────────── */
    .qr-nav {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding: 10px 12px;
        background: ${PRINT_COLORS.soft};
        border-radius: 12px;
        border: 1px solid ${PRINT_COLORS.line};
    }
    .qr-nav-label {
        font-size: 6.5pt;
        color: ${PRINT_COLORS.muted};
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-family: Inter, sans-serif;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
        opacity: 0.7;
    }
    .qr-items-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
    }
    .qr-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px 4px 4px;
        border: 1px solid ${PRINT_COLORS.qrBorder};
        border-radius: 8px;
        background: ${PRINT_COLORS.white};
    }
    .qr-item img { border-radius: 4px; background: ${PRINT_COLORS.white}; display: block; flex-shrink: 0; }
    .qr-item span { font-size: 6.5pt; color: ${PRINT_COLORS.qrText}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: Inter, sans-serif; }

    /* ─── ANSWER BOX ─────────────────────────────────── */
    .answer-box {
        padding: 10px 12px;
        border: 1px dashed ${PRINT_COLORS.answerBorder};
        border-radius: 8px;
        background: ${PRINT_COLORS.soft};
        margin-top: 4px;
    }
    .answer-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }
    .answer-label {
        font-size: 6.5pt;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: ${PRINT_COLORS.answerText};
        font-weight: 700;
        font-family: Inter, sans-serif;
    }
    .answer-label-line {
        flex: 1;
        height: 1px;
        background: ${PRINT_COLORS.answerBorder};
    }
    .answer-lines { display: flex; flex-direction: column; gap: 6px; }
    .answer-line { border-bottom: 1px solid ${PRINT_COLORS.answerLine}; height: 28px; }

    /* ─── FOOTER ─────────────────────────────────────── */
    .doc-footer {
        text-align: center;
        margin-top: 48px;
        padding: 20px 24px;
        border-top: 2px solid ${PRINT_COLORS.sectionDivider};
        font-size: 7.5pt;
        color: ${PRINT_COLORS.footerText};
        font-family: Inter, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: ${PRINT_COLORS.soft};
        border-radius: 14px;
    }
    .doc-footer-row {
        display: flex;
        align-items: center;
        gap: 14px;
    }
    .doc-footer-tagline {
        font-size: 7pt;
        color: ${PRINT_COLORS.lineMuted};
        font-style: italic;
        letter-spacing: 0.3px;
    }
    .doc-footer-dot { width: 3px; height: 3px; border-radius: 50%; background: ${PRINT_COLORS.lineMuted}; display: inline-block; vertical-align: middle; }
    .doc-footer-brand { font-weight: 700; color: ${PRINT_COLORS.brand}; font-size: 8pt; }

    /* ─── PRINT OVERRIDES ────────────────────────────── */
    @media print {
        .toolbar { display: none !important; }
        body { background: ${PRINT_COLORS.white}; font-size: 10pt; }
        .sheet { max-width: none; margin: 0; padding: 0; background: ${PRINT_COLORS.white}; box-shadow: none; }
        .cover { border-radius: 14px; box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .step { box-shadow: none; }
        .doc-footer { background: transparent; }
    }

    @media screen {
        .sheet { box-shadow: 0 0 0 1px ${PRINT_COLORS.line}, 0 8px 32px rgba(0,0,0,0.06); }
    }
`;
}
