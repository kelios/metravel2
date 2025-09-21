// app/quests/[city]/[questId].tsx
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
// ⚡️ иконки лениво, чтобы не тянуть весь @expo/vector-icons в entry
const Ion = React.lazy(() =>
    import('@expo/vector-icons/Ionicons').then((m: any) => ({ default: m.Ionicons || m.default }))
);
// ⚡️ мастер-компонент тоже лениво (часто тяжёлый)
const QuestWizardLazy = React.lazy(() =>
    import('@/components/quests/QuestWizard').then((m: any) => ({ default: m.QuestWizard || m.default }))
);

import InstantSEO from '@/components/seo/InstantSEO';
// ⚡️ реестр квестов подгружаем по месту (иначе все квесты уедут в entry)
type QuestBundle = {
    title: string;
    steps: any[];
    finale?: any;
    intro?: any;
    storageKey?: string;
    city?: string;
    coverUrl?: string;
};

import { useIsFocused } from '@react-navigation/native';

const UI = {
    text: '#0f172a',
    sub: '#64748b',
    border: '#e5e7eb',
    surface: '#ffffff',
    bg: '#f7fafc',
    primary: '#f59e0b',
};

export default function QuestByIdScreen() {
    const { questId, city } = useLocalSearchParams<{ questId: string; city: string }>();
    const isFocused = useIsFocused();

    const [bundle, setBundle] = useState<QuestBundle | null>(null);
    const [loaded, setLoaded] = useState(false);

    // Лениво грузим реестр и достаём бандл нужного квеста
    useEffect(() => {
        let cancelled = false;
        setLoaded(false);
        setBundle(null);
        (async () => {
            try {
                const mod = await import('@/components/quests/registry');
                const getQuestById: (id: string) => QuestBundle | null = (mod as any).getQuestById;
                const b = questId ? getQuestById(String(questId)) : null;
                if (!cancelled) setBundle(b);
            } catch {
                if (!cancelled) setBundle(null);
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [questId]);

    // SEO тексты
    const { title, description, headKey, ogType } = useMemo(() => {
        if (!loaded) {
            return {
                title: 'Загружаем квест…',
                description: 'Пожалуйста, подождите — готовим маршрут и задания.',
                headKey: `quest-loading-${questId}`,
                ogType: 'website' as const,
            };
        }
        if (!bundle) {
            return {
                title: 'Квест не найден',
                description: 'Проверьте адрес страницы или выберите квест из общего списка.',
                headKey: 'quest-not-found',
                ogType: 'website' as const,
            };
        }
        return {
            title: bundle.title,
            description: `${bundle.title} — офлайн-квест: маршрут, задания и финал.`,
            headKey: `quest-${bundle.storageKey ?? questId}`,
            ogType: 'article' as const,
        };
    }, [loaded, bundle, questId]);

    // LOADING
    if (!loaded) {
        return (
            <View style={[styles.page, { alignItems: 'center', justifyContent: 'center' }]}>
                {isFocused && (
                    <InstantSEO headKey={`quest-loading-${questId}`} title="Загружаем квест…" description="Готовим маршрут и задания." ogType="website" />
                )}
                <ActivityIndicator />
            </View>
        );
    }

    // NOT FOUND
    if (!bundle) {
        return (
            <View style={[styles.page, { alignItems: 'center', justifyContent: 'center' }]}>
                {isFocused && (
                    <InstantSEO headKey="quest-not-found" title="Квест не найден" description="Проверь адрес или выбери квест из списка." ogType="website" />
                )}
                <View style={styles.notFound}>
                    <Suspense fallback={null}>
                        {/* @ts-ignore */}
                        <Ion name="alert-circle" size={28} color={UI.sub} />
                    </Suspense>
                    <Text style={styles.notFoundTitle}>Квест не найден</Text>
                    <Text style={styles.notFoundText}>Проверь адрес или выбери квест из списка.</Text>
                    <Link href="/quests" asChild>
                        <Pressable style={styles.backBtn}>
                            <Suspense fallback={null}>
                                {/* @ts-ignore */}
                                <Ion name="arrow-back" size={16} color="#fff" />
                            </Suspense>
                            <Text style={styles.backBtnTxt}>К списку квестов</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        );
    }

    // READY
    return (
        <View style={styles.page}>
            {isFocused && (
                <InstantSEO headKey={headKey} title={title} description={description} ogType={ogType} />
            )}

            <Suspense fallback={<View style={{ padding: 16 }}><ActivityIndicator /></View>}>
                <QuestWizardLazy
                    title={bundle.title}
                    steps={bundle.steps}
                    finale={bundle.finale}
                    intro={bundle.intro}
                    storageKey={bundle.storageKey}
                    city={bundle.city}
                    // Чтобы не жечь main thread: открываем превью карты не сразу
                    mapPreviewOpenByDefault={false}
                />
            </Suspense>
        </View>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: UI.bg },
    notFound: {
        backgroundColor: UI.surface,
        borderWidth: 1, borderColor: UI.border,
        padding: 16, borderRadius: 16, gap: 8, width: '90%', maxWidth: 480,
        alignItems: 'center',
    },
    notFoundTitle: { color: UI.text, fontWeight: '900', fontSize: 16 },
    notFoundText: { color: UI.sub, textAlign: 'center' },
    backBtn: {
        marginTop: 8, flexDirection: 'row', gap: 6, alignItems: 'center',
        backgroundColor: UI.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    },
    backBtnTxt: { color: '#fff', fontWeight: '800' },
});
