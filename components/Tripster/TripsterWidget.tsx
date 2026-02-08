import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { normalize, transliterate, CITY_ALIASES, TRIPSTER_CITY_NAMES } from "@/utils/CityUtils";
import { useInView } from 'react-intersection-observer';

const OUTER_STYLE = { width: '100%', marginBottom: 32 } as const;
const INNER_STYLE = { width: '100%', minHeight: 300 } as const;

type Props = {
    points: {
        id: string;
        address: string;
    }[];
};

function findCityName(term: string): string | null {
    const cleanTerm = term.replace(/\s*\(.*?\)\s*/g, '').trim();
    const lowerTerm = cleanTerm.toLowerCase();
    const normalized = normalize(lowerTerm);
    const transliterated = transliterate(lowerTerm);
    const formsToTry = [lowerTerm, normalized, transliterated.toLowerCase()];

    for (const form of formsToTry) {
        if (TRIPSTER_CITY_NAMES[form]) {
            return TRIPSTER_CITY_NAMES[form];
        }
    }

    for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
        if ([city, ...aliases].some(alias => formsToTry.includes(alias.toLowerCase()))) {
            const name = TRIPSTER_CITY_NAMES[city];
            if (name) return name;
        }
    }

    return null;
}

function TripsterWidget({ points }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    const firstAddress = points?.[0]?.address || '';
    const parts = firstAddress.split(',').map(p => p.trim());
    let validCity: string | null = null;
    for (const part of parts) {
        const city = findCityName(part);
        if (city) {
            validCity = city;
            break;
        }
    }

    const [inViewRef, inView] = useInView({
        triggerOnce: true,
        rootMargin: '200px',
    });

    // Адаптер для рефа: react-intersection-observer ожидает DOM Element
    const setViewRef = useCallback(
        (node: View | null) => {
            if (Platform.OS !== 'web') return;
            (inViewRef as unknown as (node?: Element | null) => void)(node as unknown as Element | null);
        },
        [inViewRef]
    );

    useEffect(() => {
        if (Platform.OS !== 'web' || !validCity || !containerRef.current || !inView) return;

        containerRef.current.innerHTML = '';
        document.getElementById('tripster-widget-script')?.remove();

        const script = document.createElement('script');
        script.id = 'tripster-widget-script';
        script.async = true;
        script.src =
            `https://experience.tripster.ru/partner/widget.js?` +
            `city=${encodeURIComponent(validCity)}` +
            `&view=experience&template=horizontal&mobile=list&order=top` +
            `&width=100%25&num=3&version=2&partner=metravel&features=logo` +
            `&script_id=tripster-widget-script`;

        containerRef.current.appendChild(script);
    }, [validCity, inView]);

    if (Platform.OS !== 'web' || !validCity) return null;

    return (
        <View ref={setViewRef} style={OUTER_STYLE}>
            <View style={INNER_STYLE}>
                {inView && <div ref={containerRef} />}
            </View>
        </View>
    );
}

export default React.memo(TripsterWidget);
