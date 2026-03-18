// components/belkraj/BelkrajWidget.tsx
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getCountryCodeByCoords } from '@/utils/geoCountry';

interface TravelAddress {
    id: number;
    address: string;
    coord?: string;
    lat?: number;
    lng?: number;
}

type Props = {
    points: TravelAddress[];
    countryCode?: string;
    collapsedHeight?: number; // высота по умолчанию
    expandedHeight?: number;  // высота при развороте
    className?: string;
    allowScroll?: boolean;
    cardsCount?: number; // количество карточек для отображения
};

const BELKRAJ_ORIGIN = 'https://belkraj.by';
const MIN_WIDGET_HEIGHT = 320;

const getEstimatedWidgetHeight = (cardsCount: number) => {
    if (typeof window === 'undefined') {
        return 980;
    }

    const width = window.innerWidth;
    const columns = width <= 470 ? 1 : width <= 700 ? 2 : 3;
    const visibleCards = width > 470 && width <= 700
        ? cardsCount - Math.floor(cardsCount / 3)
        : cardsCount;
    const rows = Math.max(1, Math.ceil(visibleCards / columns));
    const rowHeight = width <= 470 ? 168 : 420;
    const rowGap = width <= 470 ? 12 : 24;
    const topBlockHeight = 88;
    const bottomActionHeight = 88;

    return Math.max(
        MIN_WIDGET_HEIGHT,
        topBlockHeight + (rows * rowHeight) + (Math.max(0, rows - 1) * rowGap) + bottomActionHeight,
    );
};

function BelkrajWidget({
                                          points,
                                          countryCode,
                                          collapsedHeight,
                                          expandedHeight = 1200,
                                          className,
                                          allowScroll = false,
                                          cardsCount = 6,
                                      }: Props) {
    const expanded = false;
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const resizeSyncTimeoutsRef = useRef<number[]>([]);
    const reactId = useId();
    const widgetId = useMemo(() => `metravel-${reactId.replace(/[:]/g, '')}`, [reactId]);

    const calculatedHeight = useMemo(() => getEstimatedWidgetHeight(cardsCount), [cardsCount]);
    const finalCollapsedHeight = collapsedHeight ?? calculatedHeight;
    const [measuredHeight, setMeasuredHeight] = useState(finalCollapsedHeight);

    const firstCoord = useMemo(() => {
        const p = points?.[0];
        if (!p) return null;
        if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng };
        if (p.coord) {
            const [a, b] = p.coord.split(',').map(s => s.trim());
            const lat = Number(a), lng = Number(b);
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
        }
        return null;
    }, [points]);

    // Текущая целевая высота iframe
    const targetHeight = expanded ? expandedHeight : finalCollapsedHeight;
    const finalHeight = allowScroll ? Math.max(targetHeight, measuredHeight) : measuredHeight;

    const isProd =
        typeof process !== 'undefined' &&
        process.env &&
        process.env.NODE_ENV === 'production';

    const resolvedCountryCode = useMemo(() => {
        const normalized = String(countryCode || '').trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(normalized)) return normalized;
        if (!firstCoord) return undefined;
        return getCountryCodeByCoords(firstCoord.lat, firstCoord.lng);
    }, [countryCode, firstCoord]);

    const iframeSrc = useMemo(() => {
        if (!firstCoord) return null;
        const { lat, lng } = firstCoord;
        const params = new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
            term: 'place',
            theme: 'cards',
            partner: 'u180793',
            size: String(cardsCount),
        });
        if (resolvedCountryCode) {
            params.set('country', resolvedCountryCode);
        }
        params.set('widgetId', widgetId);
        return `https://belkraj.by/partner/widget?${params.toString()}`;
    }, [firstCoord, resolvedCountryCode, cardsCount, widgetId]);

    useEffect(() => {
        setMeasuredHeight(finalCollapsedHeight);
    }, [finalCollapsedHeight, iframeSrc]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const syncHeight = () => {
            iframeRef.current?.contentWindow?.postMessage(
                { service: 'tripvenue', widgetId, event: 'getHeight' },
                BELKRAJ_ORIGIN,
            );
        };

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== BELKRAJ_ORIGIN) return;

            const data = event.data;
            if (
                !data ||
                data.service !== 'tripvenue' ||
                data.widgetId !== widgetId ||
                data.event !== 'setHeight'
            ) {
                return;
            }

            const nextHeight = Number(data.payload?.height);
            if (!Number.isFinite(nextHeight)) return;

            setMeasuredHeight(Math.max(MIN_WIDGET_HEIGHT, Math.ceil(nextHeight)));
        };

        const handleResize = () => {
            syncHeight();
        };

        window.addEventListener('message', handleMessage);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('resize', handleResize);
            resizeSyncTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
            resizeSyncTimeoutsRef.current = [];
        };
    }, [widgetId]);

    const handleIframeLoad = () => {
        if (typeof window === 'undefined') return;

        resizeSyncTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        resizeSyncTimeoutsRef.current = [];

        const syncHeight = () => {
            iframeRef.current?.contentWindow?.postMessage(
                { service: 'tripvenue', widgetId, event: 'getHeight' },
                BELKRAJ_ORIGIN,
            );
        };

        syncHeight();
        resizeSyncTimeoutsRef.current = [250, 750].map((delay) => window.setTimeout(syncHeight, delay));
    };

    // Не рендерим ничего, если нет координат
    if (!firstCoord || !isProd || !iframeSrc) return null;

    return (
        <div
            className={className ?? 'belkraj-slot'}
            style={{
                borderRadius: 12,
                overflow: allowScroll ? 'auto' : 'hidden',
                overflowX: 'hidden',
                overflowY: allowScroll ? 'auto' : 'hidden',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                boxShadow: 'var(--shadow-light, 0 1px 4px rgba(0,0,0,0.06))',
                ...(allowScroll ? {
                    height: finalHeight,
                    maxHeight: finalHeight,
                    WebkitOverflowScrolling: 'touch',
                } : null),
            }}
        >
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Belkraj partner offers"
                width="100%"
                height={finalHeight}
                scrolling={allowScroll ? 'yes' : 'no'}
                frameBorder={0}
                onLoad={handleIframeLoad}
                style={{
                    width: '100%',
                    height: `${finalHeight}px`,
                    display: 'block',
                    border: 'none',
                    pointerEvents: 'auto',
                    ...(allowScroll ? { touchAction: 'pan-y' as const } : null),
                }}
            />
        </div>
    );
}

export default React.memo(BelkrajWidget);
