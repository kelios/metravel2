// app/quests/map.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
    Platform,
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuestsList } from '@/hooks/useQuestsApi';
import { useThemedColors } from '@/hooks/useTheme';

type Point = {
    id?: number;
    coord: string;               // "lat,lng"
    address: string;
    travelImageThumbUrl: string; // абсолютный URL картинки
    categoryName: string;
    articleUrl?: string;
    urlTravel?: string;
};

export default function QuestsMapScreen() {
    const router = useRouter();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { quests, loading: questsLoading } = useQuestsList();

    const [MapPageComponent, setMapPageComponent] = useState<React.ComponentType<any> | null>(null);
    const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

    useEffect(() => {
        let mounted = true;
        if (!isWeb) return;

        (async () => {
            try {
                const mod = await import('@/components/MapPage/Map');
                const Comp = (mod as any).default ?? (mod as any);
                if (mounted) setMapPageComponent(() => Comp);
            } catch {
                if (mounted) setMapPageComponent(null);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isWeb]);

    const travel = useMemo(() => {
        const data: Point[] = quests.map((m) => {
            const coverUri = typeof m.cover === 'string' ? m.cover : '';

            return {
                id: undefined,
                coord: `${m.lat},${m.lng}`,
                address: m.title,
                travelImageThumbUrl: coverUri,
                categoryName: 'Квест',
                urlTravel: `/quests/${m.cityId}/${m.id}`,
                articleUrl: undefined,
            };
        });
        return { data };
    }, [quests]);

    const [routePoints, setRoutePoints] = useState<[number, number][]>([]);

    const handleBack = () => {
        router.replace('/quests'); // всегда уходим на страницу квестов
    };

    if (!isWeb || !MapPageComponent) {
        return (
            <View style={styles.fallback}>
                <Text style={styles.fallbackText}>Карта доступна в веб-версии</Text>
                <Pressable onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.backBtnTxt}>Назад</Text>
                </Pressable>
            </View>
        );
    }

    if (questsLoading) {
        return (
            <View style={styles.fallback}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <MapPageComponent
                travel={travel}
                coordinates={{ latitude: 53.9, longitude: 27.56 }}
                mode="radius"
                transportMode="foot"
                routePoints={routePoints}
                setRoutePoints={setRoutePoints}
                onMapClick={() => {}}
                setRouteDistance={() => {}}
                setFullRouteCoords={() => {}}
            />

            {/* Плавающая кнопка Назад поверх карты */}
            <Pressable
                onPress={handleBack}
                style={styles.fabBack}
                accessibilityRole="button"
                accessibilityLabel="Назад"
            >
                <Ionicons name="arrow-back" size={18} color={colors.text} />
            </Pressable>
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    fabBack: {
        position: 'absolute',
        top: 12,
        left: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        ...Platform.select({
            ios: {
                ...colors.shadows.medium,
            },
            android: { elevation: colors.shadows.medium.elevation },
            web: {
                boxShadow: colors.boxShadows.light,
            } as any,
            default: {
                ...colors.shadows.medium,
            },
        }),
    },
    fallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
    },
    fallbackText: { color: colors.textMuted, fontSize: 16 },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    backBtnTxt: { color: colors.textOnPrimary, fontWeight: '700' },
});
