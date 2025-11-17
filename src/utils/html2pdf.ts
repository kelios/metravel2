// WEB-ONLY util: безопасная загрузка html2pdf.bundle + экспорт "сохранить в PDF"

type Html2Pdf = (input: Element | string) => any;

declare global {
    interface Window {
        html2pdf?: Html2Pdf & { (): any };
    }
}

const CDN_SRC =
    'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';

let loadingPromise: Promise<void> | null = null;

async function ensureBundleLoaded() {
    if (typeof window === 'undefined') return; // на всякий
    if (window.html2pdf) return;

    if (!loadingPromise) {
        loadingPromise = new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = CDN_SRC;
            s.defer = true;
            s.onload = () => resolve();
            s.onerror = (e) => reject(new Error('html2pdf bundle load failed'));
            document.head.appendChild(s);
        });
    }
    await loadingPromise;
}

export type SaveOptions = {
    filename?: string;
    margin?: number | number[];
    image?: { type?: 'jpeg' | 'png' | 'webp'; quality?: number };
    html2canvas?: Partial<{
        useCORS: boolean;
        scale: number;
        backgroundColor: string | null;
        allowTaint: boolean;
        logging?: boolean;
        width?: number;
        height?: number;
        windowWidth?: number;
        windowHeight?: number;
        x?: number;
        y?: number;
        scrollX?: number;
        scrollY?: number;
        removeContainer?: boolean;
    }>;
    jsPDF?: Partial<{ unit: 'mm' | 'pt' | 'cm' | 'in'; format: string | any[]; orientation: 'p' | 'portrait' | 'l' | 'landscape' }>;
};

export async function saveHtmlAsPdf(
    node: HTMLElement,
    opts: SaveOptions = {}
) {
    await ensureBundleLoaded();
    const html2pdf = window.html2pdf!;
    const options: any = {
        filename: opts.filename ?? 'metravel-book.pdf',
        margin: opts.margin ?? [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.92, ...(opts.image || {}) },
        html2canvas: {
            useCORS: true,
            backgroundColor: '#ffffff',
            scale: window.devicePixelRatio > 2 ? 2 : 1.5,
            ...(opts.html2canvas || {}),
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            ...(opts.jsPDF || {}),
        },
        pagebreak: { mode: ['css', 'legacy'] }, // уважаем .page-break и т.п.
    };

    await html2pdf().set(options).from(node).save();
}

export async function getPdfBlob(
    node: HTMLElement,
    opts: SaveOptions = {}
): Promise<Blob> {
    await ensureBundleLoaded();
    if (!window.html2pdf) {
        throw new Error('html2pdf is not available');
    }
    const html2pdf = window.html2pdf!;
    
    // ✅ ИСПРАВЛЕНИЕ: Правильно мержим опции, чтобы переданные опции переопределяли дефолтные
    const defaultOptions: any = {
        filename: 'metravel-book.pdf',
        margin: [10, 10, 14, 10],
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: { 
            useCORS: true, 
            backgroundColor: '#ffffff', 
            scale: 1.5,
            allowTaint: false,
            logging: false,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
    };
    
    // Глубокое слияние опций
    const options: any = {
        ...defaultOptions,
        ...opts,
        margin: opts.margin ?? defaultOptions.margin,
        image: { ...defaultOptions.image, ...(opts.image || {}) },
        html2canvas: { ...defaultOptions.html2canvas, ...(opts.html2canvas || {}) },
        jsPDF: { ...defaultOptions.jsPDF, ...(opts.jsPDF || {}) },
    };

    // ✅ ИСПРАВЛЕНИЕ: Валидируем все опции, чтобы избежать undefined
    // Удаляем undefined значения из опций
    const cleanOptions: any = {
        filename: options.filename || defaultOptions.filename,
        margin: Array.isArray(options.margin) ? options.margin : defaultOptions.margin,
        image: {
            type: options.image?.type || defaultOptions.image.type,
            quality: typeof options.image?.quality === 'number' ? options.image.quality : defaultOptions.image.quality,
        },
        html2canvas: {
            useCORS: options.html2canvas?.useCORS !== undefined ? options.html2canvas.useCORS : defaultOptions.html2canvas.useCORS,
            backgroundColor: options.html2canvas?.backgroundColor || defaultOptions.html2canvas.backgroundColor,
            scale: typeof options.html2canvas?.scale === 'number' ? options.html2canvas.scale : defaultOptions.html2canvas.scale,
            allowTaint: options.html2canvas?.allowTaint !== undefined ? options.html2canvas.allowTaint : defaultOptions.html2canvas.allowTaint,
            logging: options.html2canvas?.logging !== undefined ? options.html2canvas.logging : defaultOptions.html2canvas.logging,
            width: typeof options.html2canvas?.width === 'number' ? options.html2canvas.width : undefined,
            height: typeof options.html2canvas?.height === 'number' ? options.html2canvas.height : undefined,
            windowWidth: typeof options.html2canvas?.windowWidth === 'number' ? options.html2canvas.windowWidth : undefined,
            windowHeight: typeof options.html2canvas?.windowHeight === 'number' ? options.html2canvas.windowHeight : undefined,
            x: typeof options.html2canvas?.x === 'number' ? options.html2canvas.x : 0,
            y: typeof options.html2canvas?.y === 'number' ? options.html2canvas.y : 0,
            scrollX: typeof options.html2canvas?.scrollX === 'number' ? options.html2canvas.scrollX : 0,
            scrollY: typeof options.html2canvas?.scrollY === 'number' ? options.html2canvas.scrollY : 0,
            removeContainer: options.html2canvas?.removeContainer !== undefined ? options.html2canvas.removeContainer : false,
        },
        jsPDF: {
            unit: options.jsPDF?.unit || defaultOptions.jsPDF.unit,
            // ✅ КРИТИЧНО: Убеждаемся что format это строка и валидное значение
            format: (() => {
                const fmt = options.jsPDF?.format || defaultOptions.jsPDF.format;
                if (typeof fmt === 'string') {
                    const lower = fmt.toLowerCase();
                    // html2pdf поддерживает: 'a4', 'letter', 'legal', 'tabloid', 'ledger', 'a3', 'a5'
                    return ['a4', 'letter', 'legal', 'tabloid', 'ledger', 'a3', 'a5'].includes(lower) ? lower : 'a4';
                }
                return 'a4';
            })(),
            // ✅ КРИТИЧНО: Убеждаемся что orientation это строка и валидное значение
            orientation: (() => {
                const orient = options.jsPDF?.orientation || defaultOptions.jsPDF.orientation;
                if (typeof orient === 'string') {
                    const lower = orient.toLowerCase();
                    // html2pdf поддерживает: 'portrait'/'p' или 'landscape'/'l'
                    if (lower === 'p' || lower === 'portrait') return 'portrait';
                    if (lower === 'l' || lower === 'landscape') return 'landscape';
                }
                return 'portrait';
            })(),
        },
        pagebreak: options.pagebreak || defaultOptions.pagebreak,
    };

    // Удаляем undefined значения из html2canvas
    Object.keys(cleanOptions.html2canvas).forEach(key => {
        if (cleanOptions.html2canvas[key] === undefined) {
            delete cleanOptions.html2canvas[key];
        }
    });

    // ✅ КРИТИЧНО: Финальная проверка - убеждаемся что нет undefined значений
    const finalOptions: any = JSON.parse(JSON.stringify(cleanOptions)); // Глубокая копия без undefined
    
    // Проверяем что все критичные значения определены
    if (!finalOptions.jsPDF.format || typeof finalOptions.jsPDF.format !== 'string') {
        console.warn('[getPdfBlob] Invalid format, using default:', finalOptions.jsPDF.format);
        finalOptions.jsPDF.format = 'a4';
    }
    if (!finalOptions.jsPDF.orientation || typeof finalOptions.jsPDF.orientation !== 'string') {
        console.warn('[getPdfBlob] Invalid orientation, using default:', finalOptions.jsPDF.orientation);
        finalOptions.jsPDF.orientation = 'portrait';
    }
    if (!Array.isArray(finalOptions.margin)) {
        console.warn('[getPdfBlob] Invalid margin, using default:', finalOptions.margin);
        finalOptions.margin = [10, 10, 14, 10];
    }

    console.log('[getPdfBlob] Final options:', JSON.stringify(finalOptions, null, 2));

    try {
        const worker = html2pdf().set(finalOptions).from(node);
        // @ts-ignore – у html2pdf есть метод outputPdf, но типов нет
        const blob: Blob = await worker.outputPdf('blob');
        
        if (!blob || blob.size === 0) {
            throw new Error('Generated PDF blob is empty');
        }
        
        return blob;
    } catch (error) {
        console.error('[getPdfBlob] Error generating PDF:', error);
        console.error('[getPdfBlob] Options used:', JSON.stringify(finalOptions, null, 2));
        console.error('[getPdfBlob] Node:', node);
        console.error('[getPdfBlob] Node children:', node.children.length);
        console.error('[getPdfBlob] Node innerHTML length:', node.innerHTML?.length || 0);
        throw error;
    }
}
