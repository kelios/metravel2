// components/belkraj/BelkrajWidget.tsx
import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
    canRenderBelkrajWidget,
    parseBelkrajCoord,
    resolveBelkrajCountryCode,
} from './belkrajAvailability';
import { BELKRAJ_WIDGET_SURFACE } from './belkrajWidgetSurface';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsiveWidth } from '@/hooks/useResponsive';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';


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
const DARK_THEME_CTA_HEIGHT = 160;

// width приходит из useResponsiveWidth (hydration-safe): на сервере и до конца
// гидрации он 0 → возвращаем стабильный fallback 980, совпадающий с SSR-HTML.
// После гидрации width становится реальным и высота пересчитывается.
const getEstimatedWidgetHeight = (cardsCount: number, width: number) => {
    if (!width || width <= 0) {
        return 980;
    }

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
    const { isDark } = useTheme();
    const colors = useThemedColors();
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const resizeSyncTimeoutsRef = useRef<number[]>([]);
    const reactId = useId();
    // Defer the third-party iframe (belkraj.by → tripvenue, ~165 KB + widget JS)
    // until the slot scrolls near the viewport. The Excursions section sits below
    // the fold, so eager-mounting it competed for bandwidth during LCP (FE-1).
    const [shouldLoad, setShouldLoad] = useState(false);
    const widgetId = useMemo(() => `metravel-${reactId.replace(/[:]/g, '')}`, [reactId]);

    const responsiveWidth = useResponsiveWidth();
    const calculatedHeight = useMemo(
        () => getEstimatedWidgetHeight(cardsCount, responsiveWidth),
        [cardsCount, responsiveWidth],
    );
    const finalCollapsedHeight = collapsedHeight ?? calculatedHeight;
    const [measuredHeight, setMeasuredHeight] = useState(finalCollapsedHeight);

    const firstCoord = useMemo(() => {
        return parseBelkrajCoord(points?.[0]);
    }, [points]);

    // Текущая целевая высота iframe
    const targetHeight = expanded ? expandedHeight : finalCollapsedHeight;
    const finalHeight = allowScroll ? Math.max(targetHeight, measuredHeight) : measuredHeight;

    const resolvedCountryCode = useMemo(
        () => resolveBelkrajCountryCode(points, countryCode),
        [countryCode, points],
    );

    // Гейт тот же, что спрашивают секции вокруг виджета: расходиться им нельзя.
    const canRender = useMemo(
        () => canRenderBelkrajWidget(points, countryCode),
        [countryCode, points],
    );

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

    const handleOpenPartnerCatalog = useCallback(() => {
        if (!iframeSrc) return;
        void openExternalUrlInNewTab(iframeSrc, {
            allowedProtocols: ['https:'],
            windowFeatures: 'noopener',
        });
    }, [iframeSrc]);

    useEffect(() => {
        if (isDark) return;
        setMeasuredHeight(finalCollapsedHeight);
    }, [finalCollapsedHeight, iframeSrc, isDark]);

    useEffect(() => {
        if (isDark || !canRender || typeof window === 'undefined' || shouldLoad) return undefined;
        const node = containerRef.current;
        if (!node) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            setShouldLoad(true);
            return undefined;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setShouldLoad(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '300px' },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [canRender, iframeSrc, isDark, shouldLoad]);

    useEffect(() => {
        if (isDark || !canRender || typeof window === 'undefined') return undefined;

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
    }, [canRender, isDark, widgetId]);

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

    // Не рендерим ничего, если нет координат либо страна вне каталога партнёра
    if (!canRender || !iframeSrc) return null;

    // Belkraj отдаёт cross-origin страницу с фиксированной светлой палитрой и не
    // поддерживает dark scheme. В web-тёмной теме не рисуем большое белое полотно:
    // компактная app-owned CTA сохраняет доступ к тому же city-level каталогу.
    // Светлая тема продолжает показывать полноценный iframe; native живёт в
    // BelkrajWidget.native.tsx и сохраняет собственный контракт читаемости.
    const rendersDarkThemeCta = isDark;
    const contentHeight = rendersDarkThemeCta ? DARK_THEME_CTA_HEIGHT : finalHeight;

    return (
        <div
            ref={containerRef}
            className={className ?? 'belkraj-slot'}
            style={{
                borderRadius: 12,
                overflow: allowScroll ? 'auto' : 'hidden',
                overflowX: 'hidden',
                overflowY: allowScroll ? 'auto' : 'hidden',
                border: '1px solid var(--color-border)',
                background: rendersDarkThemeCta ? colors.surface : BELKRAJ_WIDGET_SURFACE,
                colorScheme: rendersDarkThemeCta ? 'dark' : 'light',
                boxShadow: 'var(--shadow-light, 0 1px 4px rgba(0,0,0,0.06))',
                ...(allowScroll ? {
                    height: contentHeight,
                    maxHeight: contentHeight,
                    WebkitOverflowScrolling: 'touch',
                } : { height: contentHeight }),
            }}
        >
            {rendersDarkThemeCta ? (
                <View
                    testID="belkraj-dark-theme-cta"
                    style={{
                        minHeight: DARK_THEME_CTA_HEIGHT,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: DESIGN_TOKENS.spacing.lg,
                        backgroundColor: colors.surface,
                    }}
                >
                    <Button
                        testID="belkraj-open-partner-catalog"
                        label={t('sharedStatic:affiliate.tours.cta')}
                        onPress={handleOpenPartnerCatalog}
                        icon={<Feather name="external-link" size={18} color={colors.textOnPrimary} />}
                    />
                </View>
            ) : shouldLoad ? (
                <iframe
                    ref={iframeRef}
                    src={iframeSrc}
                    title={i18nT('shared:components.belkraj.BelkrajWidget.belkraj_partner_offers_b193ce0d')}
                    width="100%"
                    height={contentHeight}
                    loading="lazy"
                    scrolling={allowScroll ? 'yes' : 'no'}
                    frameBorder={0}
                    onLoad={handleIframeLoad}
                    style={{
                        width: '100%',
                        height: `${contentHeight}px`,
                        display: 'block',
                        border: 'none',
                        pointerEvents: 'auto',
                        ...(allowScroll ? { touchAction: 'pan-y' as const } : null),
                    }}
                />
            ) : null}
        </div>
    );
}

export default React.memo(BelkrajWidget);
