// components/belkraj/BelkrajWidget.tsx
import React, { useMemo } from 'react';

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
};

function BelkrajWidget({
                                          points,
                                          countryCode = 'BY',
                                          collapsedHeight = 520,
                                          expandedHeight = 1200,
                                          className,
                                      }: Props) {
    const expanded = false;

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
    const targetHeight = expanded ? expandedHeight : collapsedHeight;

    const isProd =
        typeof process !== 'undefined' &&
        process.env &&
        process.env.NODE_ENV === 'production';

    const iframeSrc = useMemo(() => {
        if (!firstCoord) return null;
        const ctry = (countryCode || 'BY').toUpperCase();
        const { lat, lng } = firstCoord;
        return (
            `https://belkraj.by/partner/widget` +
            `?country=${encodeURIComponent(ctry)}` +
            `&lat=${lat}&lng=${lng}` +
            `&term=place&theme=cards&partner=u180793&size=6`
        );
    }, [countryCode, firstCoord]);

    // Не рендерим ничего, если нет координат
    if (!firstCoord || !isProd || !iframeSrc) return null;

    return (
        <div
            className={className ?? 'belkraj-slot'}
            style={{
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid var(--color-border, #e8e4df)',
                background: 'var(--color-surface, #ffffff)',
                boxShadow: 'var(--shadow-light, 0 1px 4px rgba(0,0,0,0.06))',
            }}
        >
            <iframe
                src={iframeSrc}
                title="Belkraj partner offers"
                width="100%"
                height={targetHeight}
                scrolling="yes"
                frameBorder={0}
                style={{
                    width: '100%',
                    height: `${targetHeight}px`,
                    display: 'block',
                    border: 'none',
                }}
            />
        </div>
    );
}

export default React.memo(BelkrajWidget);
