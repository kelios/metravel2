// components/belkraj/BelkrajWidget.tsx
import React, { useMemo } from 'react';
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
};

function BelkrajWidget({
                                          points,
                                          countryCode,
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
            size: '6',
        });
        if (resolvedCountryCode) {
            params.set('country', resolvedCountryCode);
        }
        return `https://belkraj.by/partner/widget?${params.toString()}`;
    }, [firstCoord, resolvedCountryCode]);

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
                scrolling="no"
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
