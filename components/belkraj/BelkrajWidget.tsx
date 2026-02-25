// components/belkraj/BelkrajWidget.tsx
import React, { useEffect, useMemo, useRef } from 'react';

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
    const containerRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const el = containerRef.current;
        if (!el || !firstCoord) return;

        // В dev-режиме не подгружаем внешний скрипт Belkraj, чтобы не тормозить
        // локальную разработку. На проде (NODE_ENV === 'production') всё работает как раньше.
        const isProd =
            typeof process !== 'undefined' &&
            process.env &&
            process.env.NODE_ENV === 'production';

        if (!isProd) {
            return;
        }

        // чистим перед монтированием/сменой
        el.innerHTML = '';

        const mo = new MutationObserver(() => {
            const ifr = el.querySelector('iframe') as HTMLIFrameElement | null;
            if (ifr) {
                ifr.style.width = '100%';
                ifr.style.height = `${targetHeight}px`; // ключевой момент: задаём высоту самому iframe
                ifr.style.display = 'block';
                ifr.setAttribute('scrolling', 'yes');   // на всякий случай для старых движков
                if (!ifr.getAttribute('title')) {
                    ifr.setAttribute('title', 'Belkraj partner offers');
                }
            }
        });
        mo.observe(el, { childList: true, subtree: true });

        const ctry = (countryCode || 'BY').toUpperCase();
        const { lat, lng } = firstCoord;

        const script = document.createElement('script');
        script.async = false;
        script.src =
            `https://belkraj.by/sites/all/modules/_custom/modules/affiliate/js/widget.js` +
            `?country=${encodeURIComponent(ctry)}` +
            `&lat=${lat}&lng=${lng}` +
            `&term=place&theme=cards&partner=u180793&size=6`;

        el.appendChild(script);

        return () => {
            mo.disconnect();
            el.innerHTML = '';
        };
    }, [firstCoord, countryCode, targetHeight]);

    // Не рендерим ничего, если нет координат
    if (!firstCoord) return null;

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
            <div ref={containerRef} style={{ width: '100%' }} />
        </div>
    );
}

export default React.memo(BelkrajWidget);
