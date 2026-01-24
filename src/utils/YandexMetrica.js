import { useEffect } from 'react';
import { Platform } from 'react-native';
import process from 'process';

const YandexMetrica = {
    init: () => {
        if (Platform.OS !== 'web') return; // Только для Web
        if (typeof window === 'undefined') return;

        if (!window.ym) {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://mc.yandex.ru/metrika/tag.js';
            script.onload = () => {
                window.ym = window.ym || function() {
                    (window.ym.a = window.ym.a || []).push(arguments);
                };
                window.ym.l = 1 * new Date();
                const metrikaId = process.env.EXPO_PUBLIC_METRIKA_ID ? parseInt(process.env.EXPO_PUBLIC_METRIKA_ID, 10) : 62803912;
                window.ym(metrikaId, 'init', {
                    clickmap: true,
                    trackLinks: true,
                    accurateTrackBounce: true,
                    ecommerce: 'dataLayer',
                });
            };
            document.head.appendChild(script);
        }
    },

    sendEvent: (eventName, params = {}) => {
        if (Platform.OS !== 'web' || !window.ym) return;
        const metrikaId = process.env.EXPO_PUBLIC_METRIKA_ID ? parseInt(process.env.EXPO_PUBLIC_METRIKA_ID, 10) : 62803912;
        window.ym(metrikaId, 'reachGoal', eventName, params);
    }
};

const YandexMetricaComponent = () => {
    useEffect(() => {
        YandexMetrica.init();
    }, []);

    return null; // Компонент не рендерит UI, просто добавляет скрипт в head
};

export { YandexMetrica, YandexMetricaComponent };
