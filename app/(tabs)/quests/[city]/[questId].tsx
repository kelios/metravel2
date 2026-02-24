// app/quests/[city]/[questId].tsx
import React, { Suspense, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
// ⚡️ иконки лениво, чтобы не тянуть весь @expo/vector-icons в entry
const Ion = React.lazy(() =>
    import('@expo/vector-icons/Ionicons').then((m: any) => ({ default: m.Ionicons || m.default }))
);
// ⚡️ мастер-компонент тоже лениво (часто тяжёлый)
const QuestWizardLazy = React.lazy<React.ComponentType<any>>(() =>
    import('@/components/quests/QuestWizard').then((m: any) => ({ default: m.QuestWizard || m.default }))
);

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useQuestBundle, useQuestProgressSync } from '@/hooks/useQuestsApi';
import { useAuth } from '@/context/AuthContext';

import { useIsFocused } from '@react-navigation/native';
import { useThemedColors } from '@/hooks/useTheme';

export default function QuestByIdScreen() {
    const { questId, city } = useLocalSearchParams<{ questId: string; city: string }>();
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Загружаем бандл квеста из бэкенда по quest_id
    const { bundle, loading: loaded_loading, error: _error, refetch } = useQuestBundle(questId ? String(questId) : undefined);
    const loaded = !loaded_loading;

    // Синхронизация прогресса с бэкендом для авторизованных пользователей
    const { isAuthenticated } = useAuth();
    const { progress: backendProgress, progressLoading, saveProgress, resetProgress } = useQuestProgressSync(
        questId ? String(questId) : undefined,
        isAuthenticated,
    );
    const initialProgress = useMemo(() => {
        if (!backendProgress) return undefined;
        return {
            currentIndex: backendProgress.current_index,
            unlockedIndex: backendProgress.unlocked_index,
            answers: backendProgress.answers ?? {},
            attempts: backendProgress.attempts ?? {},
            hints: backendProgress.hints ?? {},
            showMap: backendProgress.show_map ?? true,
        };
    }, [backendProgress]);
    const handleProgressChange = useCallback((data: any) => {
        saveProgress(data);
    }, [saveProgress]);
    const handleProgressReset = useCallback(() => {
        resetProgress();
    }, [resetProgress]);

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

    // AUTH GATE — квесты только для зарегистрированных
    if (!isAuthenticated) {
        return (
            <View style={[styles.page, { alignItems: 'center', justifyContent: 'center' }]}>
                {isFocused && (
                    <InstantSEO headKey={`quest-auth-${questId}`} title="Войдите, чтобы пройти квест" description="Для прохождения квестов необходима регистрация." canonical={buildCanonicalUrl(`/quests/${city}/${questId}`)} ogType="website" robots="noindex, nofollow" />
                )}
                <View style={styles.authGate}>
                    <Suspense fallback={null}>
                        {/* @ts-ignore */}
                        <Ion name="lock-closed" size={36} color={colors.primary} />
                    </Suspense>
                    <Text style={styles.authGateTitle}>Войдите, чтобы начать квест</Text>
                    <Text style={styles.authGateText}>
                        Для прохождения квестов нужна учётная запись — так мы сохраним ваш прогресс и результаты.
                    </Text>
                    <Link href="/login" asChild>
                        <Pressable style={styles.backBtn}>
                            <Suspense fallback={null}>
                                {/* @ts-ignore */}
                                <Ion name="log-in-outline" size={18} color={colors.textOnPrimary} />
                            </Suspense>
                            <Text style={styles.backBtnTxt}>Войти или зарегистрироваться</Text>
                        </Pressable>
                    </Link>
                    <Link href="/quests" asChild>
                        <Pressable style={styles.secondaryBtn}>
                            <Text style={styles.secondaryBtnTxt}>К списку квестов</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        );
    }

    // LOADING (bundle or backend progress)
    if (!loaded || progressLoading) {
        return (
            <View style={[styles.page, { alignItems: 'center', justifyContent: 'center' }]}>
                {isFocused && (
                    <InstantSEO headKey={`quest-loading-${questId}`} title="Загружаем квест…" description="Готовим маршрут и задания." canonical={buildCanonicalUrl(`/quests/${city}/${questId}`)} ogType="website" />
                )}
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    // NOT FOUND
    if (!bundle) {
        return (
            <View style={[styles.page, { alignItems: 'center', justifyContent: 'center' }]}>
                {isFocused && (
                    <InstantSEO headKey="quest-not-found" title="Квест не найден" description="Проверь адрес или выбери квест из списка." canonical={buildCanonicalUrl('/quests')} ogType="website" robots="noindex, nofollow" />
                )}
                <View style={styles.notFound}>
                    <Suspense fallback={null}>
                        {/* @ts-ignore */}
                        <Ion name="alert-circle" size={28} color={colors.textMuted} />
                    </Suspense>
                    <Text style={styles.notFoundTitle}>Квест не найден</Text>
                    <Text style={styles.notFoundText}>Проверь адрес или выбери квест из списка.</Text>
                    <Link href="/quests" asChild>
                        <Pressable style={styles.backBtn}>
                            <Suspense fallback={null}>
                                {/* @ts-ignore */}
                                <Ion name="arrow-back" size={16} color={colors.textOnPrimary} />
                            </Suspense>
                            <Text style={styles.backBtnTxt}>К списку квестов</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        );
    }

    // READY (пользователь авторизован)
    return (
        <View style={styles.page}>
            {isFocused && (
                <InstantSEO headKey={headKey} title={title} description={description} canonical={buildCanonicalUrl(`/quests/${city}/${questId}`)} ogType={ogType} />
            )}

            <Suspense fallback={<View style={{ padding: 16 }}><ActivityIndicator color={colors.primary} /></View>}>
                <QuestWizardLazy
                    title={bundle.title}
                    steps={bundle.steps}
                    finale={bundle.finale}
                    intro={bundle.intro}
                    storageKey={bundle.storageKey}
                    city={bundle.city}
                    onProgressChange={handleProgressChange}
                    onProgressReset={handleProgressReset}
                    initialProgress={initialProgress}
                    onFinaleVideoRetry={refetch}
                    mapPreviewOpenByDefault={false}
                />
            </Suspense>
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    notFound: {
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        padding: 16, borderRadius: 16, gap: 8, width: '90%', maxWidth: 480,
        alignItems: 'center',
    },
    notFoundTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
    notFoundText: { color: colors.textMuted, textAlign: 'center' },
    backBtn: {
        marginTop: 8, flexDirection: 'row', gap: 6, alignItems: 'center',
        backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    },
    backBtnTxt: { color: colors.textOnPrimary, fontWeight: '800' },
    authGate: {
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        padding: 24, borderRadius: 16, gap: 12, width: '90%', maxWidth: 420,
        alignItems: 'center',
    },
    authGateTitle: { color: colors.text, fontWeight: '900', fontSize: 18, textAlign: 'center' },
    authGateText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
    secondaryBtn: {
        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    secondaryBtnTxt: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
});
