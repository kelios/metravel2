// components/quests/QuestWizard.tsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    View, StyleSheet,
    ScrollView, Platform,
    KeyboardAvoidingView, Keyboard
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generatePrintableQuest } from './QuestPrintable';
import { useQuestFinaleMedia } from './useQuestFinaleMedia';
import { QuestCompactSidebar, QuestHeaderPanel } from './questWizardShell';
import {
    QuestDesktopMapPanel,
    QuestExcursionsInline,
    QuestExcursionsSidebar,
    QuestFinalePanel,
} from './questWizardSections';
import { QuestStepCard } from './questWizardStepCard';
import { useQuestWizardProgress } from './useQuestWizardProgress';
import {
    confirmQuestAsync,
    copyQuestCoords,
    detectQuestMapApps,
    notifyQuest,
    openQuestMap,
} from './questWizardHelpers';

import { useThemedColors } from '@/hooks/useTheme';
import { useQuestWizardResponsiveModel } from './hooks/useQuestWizardResponsiveModel';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

// ===================== ТИПЫ =====================
export type QuestStep = {
    id: string; title: string; location: string; story: string; task: string;
    hint?: string; answer: (input: string) => boolean;
    lat: number; lng: number; mapsUrl: string; image?: any; inputType?: 'number' | 'text';
};
export type QuestCity = { name?: string; lat: number; lng: number; countryCode?: string; };
export type QuestFinale = { text: string; video?: any; poster?: any; };
export type QuestWizardProps = {
    title: string; steps: QuestStep[]; finale: QuestFinale; intro?: QuestStep;
    storageKey?: string; city?: QuestCity;
    coverUrl?: string;
    /** Callback для синхронизации прогресса с бэкендом */
    onProgressChange?: (data: {
        currentIndex: number; unlockedIndex: number;
        answers: Record<string, string>; attempts: Record<string, number>;
        hints: Record<string, boolean>; showMap: boolean; completed?: boolean;
    }) => void;
    /** Callback при сбросе прогресса */
    onProgressReset?: () => void;
    /** Начальный прогресс, загруженный с бэкенда (приоритет над AsyncStorage) */
    initialProgress?: {
        currentIndex: number; unlockedIndex: number;
        answers: Record<string, string>; attempts: Record<string, number>;
        hints: Record<string, boolean>; showMap: boolean;
    };
    /** Web: обновить бандл (и signed video URL) перед повторной попыткой проигрывания */
    onFinaleVideoRetry?: () => void;
};

// ===================== ТЕМА =====================
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

// Modern design constants
const QUEST_DESIGN = {
    // Cinematic gradients
    headerGradient: 'linear-gradient(135deg, var(--color-background) 0%, var(--color-primaryDark) 50%, var(--color-background) 100%)',
    cardGlow: '0 8px 32px rgba(245, 132, 44, 0.08), 0 2px 8px rgba(0,0,0,0.04)',
    cardHoverGlow: '0 16px 48px rgba(245, 132, 44, 0.15), 0 4px 12px rgba(0,0,0,0.08)',
    // Step pill colors
    stepActiveGradient: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brandDark) 100%)',
    stepDoneGradient: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-successDark) 100%)',
    // Typography
    titleSize: 28,
    sectionTitleSize: 11,
    bodySize: 15,
};

const useQuestWizardTheme = (isMobile: boolean, screenW: number) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors, isMobile, screenW), [colors, isMobile, screenW]);
    return { colors, styles };
};
// ===================== ОСНОВНОЙ КОМПОНЕНТ =====================
export function QuestWizard({ title, steps, finale, intro, storageKey = 'quest_progress', city, coverUrl, onProgressChange, onProgressReset, initialProgress, onFinaleVideoRetry }: QuestWizardProps) {
    const allSteps = useMemo(() => intro ? [intro, ...steps] : steps, [intro, steps]);

    const wizardModel = useQuestWizardResponsiveModel();
    const {
        screenW, screenH, isMobile,
        compactNav, compactDesktopLayout,
        useWideInlineLayout, useWideExcursionsSidebar,
    } = wizardModel;

    const { colors, styles } = useQuestWizardTheme(isMobile, screenW);

    const {
        currentIndex,
        setCurrentIndex,
        unlockedIndex,
        setUnlockedIndex,
        answers,
        setAnswers,
        attempts,
        setAttempts,
        hints,
        setHints,
        showMap,
        setShowMap,
        completedSteps,
        progress,
        allCompleted,
        resetProgress,
    } = useQuestWizardProgress({
        allSteps,
        steps,
        storageKey,
        initialProgress,
        onProgressChange,
        onProgressReset,
    });
    const [showFinaleOnly, setShowFinaleOnly] = useState(false);
    const [desktopNavExpanded, setDesktopNavExpanded] = useState(false);
    const [desktopHasOrganic, setDesktopHasOrganic] = useState(false);
    const [desktopHasMapsme, setDesktopHasMapsme] = useState(false);

    const currentStep = allSteps[currentIndex];

    useEffect(() => {
        setDesktopNavExpanded(false);
    }, [currentStep?.id]);

    useEffect(() => {
        if (!useWideInlineLayout || !currentStep || currentStep.id === 'intro') {
            setDesktopHasOrganic(false);
            setDesktopHasMapsme(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const detected = await detectQuestMapApps();
            if (!cancelled) {
                setDesktopHasOrganic(detected.hasOrganic);
                setDesktopHasMapsme(detected.hasMapsme);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [currentStep, useWideInlineLayout]);

    const openCurrentStepInMap = useCallback(async (app: 'google' | 'apple' | 'yandex' | 'organic' | 'mapsme') => {
        if (!currentStep) return;
        return openQuestMap(currentStep, app);
    }, [currentStep]);

    const copyCurrentStepCoords = useCallback(async () => {
        if (!currentStep) return;
        await copyQuestCoords(currentStep);
    }, [currentStep]);

    // === уведомление + переход
    const handleAnswer = async (step: QuestStep, answer: string) => {
        setAnswers(prev => ({ ...prev, [step.id]: answer }));
        setAttempts(prev => ({ ...prev, [step.id]: 0 }));
        setHints(prev => ({ ...prev, [step.id]: false }));
        const nextIndex = Math.min(currentIndex + 1, allSteps.length - 1);
        setCurrentIndex(nextIndex);
        setUnlockedIndex(prev => Math.max(prev, nextIndex));
    };

    const handleWrongAttempt = (step: QuestStep) => setAttempts(prev => ({ ...prev, [step.id]: (prev[step.id] || 0) + 1 }));
    const toggleHint = (step: QuestStep) => setHints(prev => ({ ...prev, [step.id]: !prev[step.id] }));
    const toggleMap = () => setShowMap(prev => !prev);
    const skipStep = () => { const nextIndex = Math.min(currentIndex + 1, allSteps.length - 1); setCurrentIndex(nextIndex); setUnlockedIndex(prev => Math.max(prev, nextIndex)); };
    const goToStep = (index: number) => { const s = allSteps[index]; const isAnswered = !!(s && answers[s.id]); if (index <= unlockedIndex || isAnswered || allCompleted) { setShowFinaleOnly(false); setCurrentIndex(index); } };

    const resetQuest = async () => {
        const ok = await confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.');
        if (!ok) return;
        try {
            await resetProgress();
            setShowFinaleOnly(false);
            notifyQuest('Прогресс очищен');
        } catch (e) {
            console.error('Error resetting progress:', e);
        }
    };

    // Когда всё пройдено
    useEffect(() => {
        if (allCompleted) { setShowFinaleOnly(true); setUnlockedIndex(allSteps.length - 1); }
    }, [allCompleted, allSteps.length, setUnlockedIndex]);

    const {
        frameW,
        videoOk,
        setVideoOk,
        videoUri,
        posterUri,
        coverUri: _coverUri,
        youtubeEmbedUri,
        handleVideoError,
        handleVideoRetry,
    } = useQuestFinaleMedia({
        finaleVideo: finale.video,
        finalePoster: finale.poster,
        coverUrl,
        screenW,
        screenH,
        onFinaleVideoRetry,
    });

    const handlePrintDownload = useCallback(() => {
        const questUrl = typeof window !== 'undefined'
            ? window.location.href.replace(/^http:\/\/localhost:\d+/, 'https://metravel.by')
            : undefined;
        void generatePrintableQuest({ title, steps, intro, coverUrl, questUrl });
    }, [coverUrl, intro, steps, title]);

    const mainContent = (
        <View style={useWideExcursionsSidebar && city && Platform.OS === 'web' ? styles.pageRow : undefined}>
            {/* Левая колонка: шаги + карта + финал */}
            <View style={useWideExcursionsSidebar && city && Platform.OS === 'web' ? styles.pageMain : undefined}>
                {/* Шаги/карты — скрываем, если показываем только финал */}
                {(!showFinaleOnly) && currentStep && (
                    <View style={useWideInlineLayout ? styles.desktopRow : undefined}>
                        <View style={useWideInlineLayout ? styles.desktopMain : undefined}>
                            <QuestStepCard
                                colors={colors}
                                styles={styles}
                                step={currentStep}
                                index={currentIndex}
                                attempts={attempts[currentStep.id] || 0}
                                hintVisible={hints[currentStep.id] || false}
                                savedAnswer={answers[currentStep.id]}
                                onSubmit={(a) => handleAnswer(currentStep, a)}
                                onWrongAttempt={() => handleWrongAttempt(currentStep)}
                                onToggleHint={() => toggleHint(currentStep)}
                                onSkip={skipStep}
                                showMap={showMap}
                                onToggleMap={toggleMap}
                                showLocationControls={!useWideInlineLayout}
                            />
                        </View>

                        {!!steps.length && (
                            <QuestDesktopMapPanel
                                colors={colors}
                                styles={styles}
                                currentStep={currentStep}
                                steps={steps}
                                compactDesktopLayout={compactDesktopLayout}
                                useWideInlineLayout={useWideInlineLayout}
                                desktopNavExpanded={desktopNavExpanded}
                                setDesktopNavExpanded={setDesktopNavExpanded}
                                desktopHasOrganic={desktopHasOrganic}
                                desktopHasMapsme={desktopHasMapsme}
                                showMap={showMap}
                                toggleMap={toggleMap}
                                openCurrentStepInMap={openCurrentStepInMap as any}
                                copyCurrentStepCoords={copyCurrentStepCoords}
                                activeStepIndex={currentIndex > 0 ? currentIndex - 1 : undefined}
                            />
                        )}
                    </View>
                )}

                {/* Экскурсии рядом — на узких экранах под контентом */}
                {!useWideExcursionsSidebar && !compactDesktopLayout && (!showFinaleOnly) && currentStep && city && Platform.OS === 'web' && (
                    <QuestExcursionsInline
                        colors={colors}
                        styles={styles}
                        city={city}
                        title={title}
                    />
                )}

                {/* Финал — доступен всегда; видео — когда всё пройдено */}
                {showFinaleOnly && (
                    <QuestFinalePanel
                        colors={colors}
                        styles={styles}
                        finale={finale}
                        allCompleted={allCompleted}
                        completedCount={completedSteps.length}
                        stepsCount={steps.length}
                        frameW={frameW}
                        youtubeEmbedUri={youtubeEmbedUri}
                        videoOk={videoOk}
                        videoUri={videoUri}
                        posterUri={posterUri}
                        handleVideoError={handleVideoError}
                        handleVideoRetry={handleVideoRetry}
                        setVideoOk={setVideoOk}
                    />
                )}

            </View>

            {/* Правая колонка: блок экскурсий — постоянно видим на desktop */}
            {useWideExcursionsSidebar && city && Platform.OS === 'web' && (
                <QuestExcursionsSidebar
                    colors={colors}
                    styles={styles}
                    city={city}
                    title={title}
                />
            )}
        </View>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    {compactDesktopLayout ? (
                        <View style={styles.compactShell}>
                            <QuestCompactSidebar
                                colors={colors}
                                styles={styles}
                                title={title}
                                progress={progress}
                                completedCount={completedSteps.length}
                                stepsCount={steps.length}
                                allSteps={allSteps}
                                answers={answers}
                                currentIndex={currentIndex}
                                unlockedIndex={unlockedIndex}
                                allCompleted={allCompleted}
                                showFinaleOnly={showFinaleOnly}
                                goToStep={goToStep}
                                onShowFinale={() => setShowFinaleOnly(true)}
                                city={city}
                                onReset={resetQuest}
                                onPrintDownload={handlePrintDownload}
                            />

                            <ScrollView
                                style={[styles.content, styles.compactMainContent]}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                onScrollBeginDrag={Keyboard.dismiss}
                                contentContainerStyle={{ paddingBottom: SPACING.xl + 96 }}
                            >
                                {mainContent}
                                <View style={{ height: SPACING.xl }} />
                            </ScrollView>
                        </View>
                    ) : (
                        <>
                            <QuestHeaderPanel
                                colors={colors}
                                styles={styles}
                                title={title}
                                progress={progress}
                                completedCount={completedSteps.length}
                                stepsCount={steps.length}
                                allSteps={allSteps}
                                answers={answers}
                                currentIndex={currentIndex}
                                unlockedIndex={unlockedIndex}
                                allCompleted={allCompleted}
                                showFinaleOnly={showFinaleOnly}
                                goToStep={goToStep}
                                onShowFinale={() => setShowFinaleOnly(true)}
                                isMobile={isMobile}
                                screenW={screenW}
                                compactNav={compactNav}
                                onReset={resetQuest}
                                onPrintDownload={handlePrintDownload}
                            />

                            {/* Контент */}
                            <ScrollView
                                style={styles.content}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                onScrollBeginDrag={Keyboard.dismiss}
                                contentContainerStyle={[{ paddingBottom: SPACING.xl + 96 }, useWideExcursionsSidebar && styles.contentInner]}
                            >
                                {mainContent}
                                <View style={{ height: SPACING.xl }} />
                            </ScrollView>
                        </>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

// ===================== СТИЛИ =====================
const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile = false, screenW = 400) => StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: colors.background,
    },

    header: {
        backgroundColor: colors.surface,
        paddingHorizontal: isMobile ? SPACING.md : SPACING.lg,
        paddingTop: isMobile ? SPACING.sm : SPACING.sm,
        paddingBottom: isMobile ? SPACING.xs : SPACING.xs,
        borderBottomWidth: 0,
        ...Platform.select({
            web: {
                maxWidth: 1200,
                width: '100%',
                alignSelf: 'center',
                borderRadius: 0,
                boxShadow: '0 1px 0 0 rgba(0,0,0,0.03)',
            } as any,
        }),
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
        gap: SPACING.sm,
    },
    headerRowMobile: {
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    headerIdentity: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: isMobile ? 17 : 20,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
        letterSpacing: -0.3,
        lineHeight: isMobile ? 22 : 26,
    },
    titleMobile: {
        fontSize: 16,
        lineHeight: 20,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 0,
        backgroundColor: 'transparent',
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'color 0.15s ease',
            } as any,
        }),
    },
    resetText: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
    toggleText: { color: colors.primaryDark, fontWeight: '600', fontSize: 14 },

    progressContainer: { marginBottom: SPACING.xs },
    progressBar: {
        height: 3,
        backgroundColor: colors.backgroundTertiary,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: { 
        height: '100%', 
        borderRadius: 2,
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            } as any,
            default: { backgroundColor: colors.brand },
        }),
    },
    progressText: {
        fontSize: 11,
        color: colors.textMuted,
        textAlign: 'right',
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    progressCompact: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
        letterSpacing: -0.1,
        marginTop: 1,
    },

    stepsNavigation: {
        flexDirection: 'row',
        marginTop: SPACING.xs,
        marginBottom: SPACING.xs,
        ...Platform.select({
            web: {
                maskImage: 'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 32px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 32px), transparent 100%)',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
            } as any,
        }),
    },
    stepsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: SPACING.xs,
        gap: 5,
        marginBottom: SPACING.xs,
    },

    stepPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: colors.backgroundSecondary,
        maxWidth: 140,
        marginRight: 0,
        marginBottom: 0,
        borderWidth: 0,
        minHeight: 28,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            } as any,
        }),
    },
    stepPillNarrow: { maxWidth: 120, paddingHorizontal: 8 },
    stepPillUnlocked: { 
        backgroundColor: colors.backgroundSecondary,
        ...Platform.select({
            web: {
                ':hover': { transform: 'translateY(-1px)' },
            } as any,
        }),
    },
    stepPillActive: { 
        backgroundColor: colors.brand,
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                boxShadow: '0 2px 10px rgba(245, 132, 44, 0.35)',
                transform: 'scale(1.04)',
            } as any,
        }),
    },
    stepPillDone: { 
        backgroundColor: colors.successSoft,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.12) 0%, rgba(66, 109, 86, 0.08) 100%)',
            } as any,
        }),
    },
    stepPillLocked: { opacity: 0.35 },
    stepPillIndex: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.brandText,
        marginRight: 5,
        minWidth: 12,
    },
    stepPillTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.text,
        flexShrink: 1,
        letterSpacing: -0.2,
    },

    stepDotMini: {
        width: isMobile ? 26 : 32,
        height: isMobile ? 26 : 32,
        borderRadius: isMobile ? 13 : 16,
        marginRight: isMobile ? 3 : 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 0,
        // Touch area extended via hitSlop in QuestStepDot component
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            } as any,
        }),
    },
    stepDotMiniUnlocked: { opacity: 1 },
    stepDotMiniActive: { 
        backgroundColor: colors.brand,
        transform: [{ scale: 1.15 }],
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                boxShadow: '0 2px 10px rgba(245, 132, 44, 0.4)',
                transform: 'scale(1.15)',
            } as any,
        }),
    },
    stepDotMiniDone: { 
        backgroundColor: colors.successSoft,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.15) 0%, rgba(66, 109, 86, 0.1) 100%)',
            } as any,
        }),
    },
    stepDotMiniLocked: { opacity: 0.35 },
    stepDotMiniText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: colors.brandText },

    navActiveTitle: {
        marginTop: 6,
        marginBottom: isMobile ? SPACING.xs : 0,
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.3,
    },
    navHint: { 
        fontSize: 12, 
        color: colors.textMuted, 
        marginTop: 6,
        letterSpacing: -0.1,
    },

    compactShell: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: colors.background,
        ...Platform.select({
            web: {
                maxWidth: 1400,
                width: '100%',
                alignSelf: 'center',
            } as any,
        }),
    },
    compactSidebar: {
        width: 300,
        flexShrink: 0,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.borderLight,
        paddingHorizontal: SPACING.sm,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.sm,
    },
    compactSidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    compactSidebarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    compactIconButton: {
        width: 34,
        height: 34,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundSecondary,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    compactSidebarTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        lineHeight: 22,
        letterSpacing: -0.2,
    },
    compactStepsList: {
        flex: 1,
        marginTop: SPACING.sm,
    },
    compactStepsListContent: {
        paddingRight: 2,
        paddingBottom: SPACING.md,
    },
    compactStepPill: {
        width: '100%',
        maxWidth: '100%',
        marginRight: 0,
        marginBottom: 8,
        borderRadius: 12,
        minHeight: 44,
    },
    compactExcursionsSection: {
        marginTop: SPACING.md,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    compactExcursionsHeader: {
        marginBottom: SPACING.sm,
    },

    content: { flex: 1, padding: isMobile ? SPACING.md : SPACING.lg },
    compactMainContent: {
        paddingTop: SPACING.md,
    },
    contentInner: { maxWidth: 1160, alignSelf: 'center', width: '100%' },
    desktopRow: { flexDirection: 'row', gap: SPACING.lg },
    desktopMain: { flex: 1, minWidth: 0 },
    desktopSide: { width: 400, flexShrink: 0 },
    compactDesktopSide: { width: 340, flexShrink: 0 },

    card: {
        backgroundColor: colors.surface,
        borderRadius: isMobile ? 14 : 16,
        padding: isMobile ? SPACING.md : SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 0,
        ...Platform.select({
            web: { 
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease',
            } as any,
            android: { elevation: 2 },
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
            },
        }),
        backfaceVisibility: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: isMobile ? SPACING.md : SPACING.lg,
        gap: isMobile ? SPACING.sm : SPACING.md,
    },
    stepNumber: {
        width: isMobile ? 38 : 44,
        height: isMobile ? 38 : 44,
        borderRadius: isMobile ? 11 : 14,
        alignItems: 'center', 
        justifyContent: 'center',
        flexShrink: 0,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(245, 132, 44, 0.12) 0%, rgba(224, 112, 32, 0.08) 100%)',
            } as any,
            default: { backgroundColor: colors.brandSoft },
        }),
    },
    stepNumberCompleted: { 
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.15) 0%, rgba(66, 109, 86, 0.1) 100%)',
            } as any,
            default: { backgroundColor: colors.successSoft },
        }),
    },
    stepNumberText: { fontSize: isMobile ? 14 : 17, fontWeight: '800', color: colors.brandText },
    headerContent: { flex: 1 },
    stepTitle: {
        fontSize: isMobile ? 17 : 20,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
        letterSpacing: -0.4,
        lineHeight: isMobile ? 23 : 26,
    },
    location: {
        fontSize: 14, 
        color: colors.brandText, 
        fontWeight: '600',
        ...Platform.select({ 
            web: { 
                cursor: 'pointer',
                transition: 'color 0.2s ease',
            } as any,
        }),
    },
    completedBadge: {
        borderRadius: 10,
        width: isMobile ? 32 : 36,
        height: isMobile ? 32 : 36,
        alignItems: 'center', 
        justifyContent: 'center',
        flexShrink: 0,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.2) 0%, rgba(66, 109, 86, 0.15) 100%)',
            } as any,
            default: { backgroundColor: colors.successSoft },
        }),
    },
    completedText: { color: colors.success, fontWeight: '800', fontSize: 16 },

    section: { marginBottom: isMobile ? SPACING.md : SPACING.lg },
    sectionTitle: { 
        fontSize: QUEST_DESIGN.sectionTitleSize, 
        fontWeight: '700', 
        color: colors.textMuted, 
        marginBottom: SPACING.sm, 
        textTransform: 'uppercase', 
        letterSpacing: 1.2,
    },
    storyText: {
        fontSize: isMobile ? 14 : QUEST_DESIGN.bodySize,
        lineHeight: isMobile ? 22 : 24,
        color: colors.text,
        letterSpacing: -0.1,
    },

    taskText: {
        fontSize: isMobile ? 15 : 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: isMobile ? SPACING.md : SPACING.lg,
        lineHeight: isMobile ? 22 : 25,
        letterSpacing: -0.3,
    },
    input: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 14,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: SPACING.sm,
        color: colors.text,
        minHeight: 52,
        borderWidth: 0,
        ...Platform.select({
            web: {
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                outlineStyle: 'none',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
                ':focus': {
                    boxShadow: '0 0 0 3px rgba(245, 132, 44, 0.15), inset 0 1px 3px rgba(0,0,0,0.04)',
                },
            } as any,
        }),
    },
    inputError: {
        borderColor: colors.danger,
        backgroundColor: 'rgba(239,68,68,0.04)',
        ...Platform.select({
            web: { boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' } as any,
        }),
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        marginBottom: SPACING.sm,
        padding: 10,
        backgroundColor: 'rgba(239,68,68,0.07)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.15)',
    },
    errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', flex: 1 },

    primaryButton: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: 14,
        borderRadius: 14,
        minHeight: 52,
        justifyContent: 'center',
        alignItems: 'center',
        ...globalFocusStyles.focusable,
        ...Platform.select({
            web: { 
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 14px rgba(245, 132, 44, 0.3)',
            } as any,
            default: { backgroundColor: colors.brand },
        }),
    },
    buttonText: { color: colors.textOnPrimary, fontWeight: '700', textAlign: 'center', fontSize: 16 },

    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: isMobile ? SPACING.sm : SPACING.md },
    checkButton: {
        width: 52, 
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        ...Platform.select({ 
            web: { 
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                cursor: 'pointer', 
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(245, 132, 44, 0.3)',
            } as any,
            default: { backgroundColor: colors.brand },
        }),
    },
    checkButtonText: { color: colors.textOnPrimary, fontSize: 24, fontWeight: '700' },

    inlineActions: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap', gap: 12, marginTop: 8, marginBottom: 4,
    },
    linkText: {
        color: colors.textMuted, fontSize: 13, fontWeight: '500',
        minHeight: 44, lineHeight: 44,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    linkSeparator: { color: colors.borderStrong, fontSize: 13 },

    hintPrompt: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xs },
    hintContainer: {
        backgroundColor: colors.successSoft,
        paddingHorizontal: SPACING.md,
        paddingVertical: isMobile ? SPACING.sm : SPACING.md,
        borderRadius: 12,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: colors.successLight,
    },
    hintText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    answerMapSplit: {
        flexDirection: 'column',
        gap: SPACING.md,
    },
    answerMapSplitWithAnswer: {
        ...Platform.select({
            web: !isMobile ? {
                flexDirection: 'row',
                alignItems: 'stretch',
            } : {} as any,
        }),
    },
    answerMapPane: {
        minWidth: 0,
    },
    answerPane: {
        ...Platform.select({
            web: {
                width: isMobile ? undefined : 260,
                flexShrink: isMobile ? undefined : 0,
            } as any,
        }),
    },
    mapPane: {
        flex: 1,
    },
    answerContainer: {
        backgroundColor: colors.successSoft,
        padding: SPACING.md,
        borderRadius: 12,
        marginTop: 0,
        borderWidth: 1,
        borderColor: colors.successLight,
    },
    answerLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    answerValue: { fontSize: 15, fontWeight: '700', color: colors.text },

    navRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    },
    navButton: {
        backgroundColor: colors.primary, paddingHorizontal: isMobile ? 12 : 16, paddingVertical: 10,
        borderRadius: 999, minHeight: 40, justifyContent: 'center', alignItems: 'center',
        ...Platform.select({ web: { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any }),
    },
    navButtonText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
    navToggle: {
        backgroundColor: colors.backgroundSecondary,
        width: 36, height: 36, borderRadius: 999,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.borderLight,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    navToggleText: { fontSize: 10, color: colors.textMuted },
    coordsButton: {
        backgroundColor: colors.backgroundSecondary,
        paddingHorizontal: 10, paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    coordsButtonText: { color: colors.textMuted, fontSize: 11, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
    photoToggle: {
        backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 999,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    photoToggleText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
    navDropdown: {
        marginTop: 8, backgroundColor: colors.surface, borderRadius: 12,
        borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
        ...Platform.select({ web: { boxShadow: colors.boxShadows.medium } as any }),
    },
    navOption: {
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    navOptionText: { color: colors.text, fontSize: 14 },

    photoHint: { fontSize: 12, color: colors.textMuted, marginBottom: SPACING.xs },

    imagePreview: { borderRadius: 12, overflow: 'hidden', position: 'relative', width: '100%', maxWidth: isMobile ? screenW - 64 : 480 },
    previewImage: { width: '100%', aspectRatio: 4 / 3, resizeMode: 'contain' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay, padding: 8, alignItems: 'center' },
    overlayText: { color: colors.textOnDark, fontSize: 12, fontWeight: '600' },

    startButton: {
        padding: SPACING.lg,
        borderRadius: 16,
        alignItems: 'center',
        alignSelf: 'stretch',
        minHeight: 56,
        justifyContent: 'center',
        ...Platform.select({ 
            web: { 
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                boxShadow: '0 8px 24px rgba(245, 132, 44, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            } as any,
            default: { backgroundColor: colors.brand },
        }),
    },
    startButtonText: { 
        color: colors.textOnPrimary, 
        fontSize: 18, 
        fontWeight: '800', 
        letterSpacing: -0.3,
    },

    headerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },

    fullMapSection: {
        backgroundColor: colors.surface,
        borderRadius: isMobile ? 12 : 16,
        padding: SPACING.sm,
        marginBottom: isMobile ? SPACING.sm : SPACING.md,
        borderWidth: 0,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            } as any,
        }),
    },
    mapTopControls: {
        marginBottom: SPACING.sm,
    },

    pageRow: {
        flexDirection: 'row',
        gap: SPACING.lg,
        alignItems: 'flex-start',
    },
    pageMain: {
        flex: 1,
        minWidth: 0,
    },
    excursionsSidebar: {
        width: 300,
        flexShrink: 0,
        ...Platform.select({
            web: {
                position: 'sticky' as any,
                top: SPACING.md,
                alignSelf: 'flex-start',
            },
        }),
    },
    excursionsSidebarInner: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: SPACING.lg,
        borderWidth: 0,
        ...Platform.select({
            web: { 
                boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
            } as any,
            default: colors.shadows.light,
        }),
    },
    excursionsSidebarWidget: {
        marginTop: SPACING.sm,
    },

    excursionsSection: {
        marginTop: SPACING.xl,
    },
    excursionsDivider: {
        height: 1,
        backgroundColor: colors.borderLight,
        marginBottom: SPACING.lg,
    },
    excursionsHeader: {
        marginBottom: SPACING.md,
    },
    excursionsCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: SPACING.lg,
        borderWidth: 0,
        ...Platform.select({
            web: { 
                boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
            } as any,
            default: colors.shadows.light,
        }),
    },
    excursionsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
        letterSpacing: -0.4,
    },
    excursionsSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        letterSpacing: -0.1,
    },

    completionScreen: {
        backgroundColor: colors.surface,
        borderRadius: isMobile ? 14 : 16,
        padding: isMobile ? SPACING.md : SPACING.lg,
        alignItems: 'center',
        marginTop: isMobile ? SPACING.xs : SPACING.md,
        borderWidth: 0,
        ...Platform.select({ 
            web: { 
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            } as any,
        }),
    },
    completionTitle: {
        fontSize: isMobile ? 22 : 28,
        fontWeight: '800',
        color: colors.success,
        marginBottom: isMobile ? SPACING.sm : SPACING.md,
        textAlign: 'center',
        letterSpacing: -0.6,
    },
    completionText: {
        paddingTop: 4,
        fontSize: isMobile ? 15 : 17,
        color: colors.text,
        textAlign: 'center',
        lineHeight: isMobile ? 23 : 26,
        marginBottom: isMobile ? SPACING.lg : SPACING.xl,
        maxWidth: isMobile ? screenW - 64 : 480,
    },

    videoFrame: {
        alignSelf: 'center',
        backgroundColor: colors.text,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        position: 'relative',
    },
    videoFallbackOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.overlay,
        paddingHorizontal: SPACING.md,
        gap: 10,
    },
    videoFallbackText: {
        color: colors.textOnDark,
        fontWeight: '600',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    videoRetryBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: 10,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    videoRetryText: { color: colors.text, fontWeight: '700', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    gestureContainer: { flex: 1, width: '100%' },
    animatedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    zoomedImage: { width: '100%', height: '100%' },
    closeButton: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    closeButtonText: { color: colors.textOnDark, fontSize: 18, fontWeight: 'bold' },
    zoomHintContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
    zoomHint: { color: colors.textOnDark, fontSize: 14, backgroundColor: 'rgba(0,0,0,0.55)', padding: 10, borderRadius: 8 },

    flipBadge: {
        paddingHorizontal: 28, 
        paddingVertical: 14, 
        borderRadius: 999,
        ...Platform.select({
            web: { 
                backgroundImage: QUEST_DESIGN.stepDoneGradient,
                boxShadow: '0 12px 32px rgba(82, 125, 102, 0.4)',
            } as any,
            ios: { 
                backgroundColor: colors.success,
                shadowColor: colors.success, 
                shadowOffset: { width: 0, height: 8 }, 
                shadowOpacity: 0.35, 
                shadowRadius: 20,
            },
            android: { 
                backgroundColor: colors.success,
                elevation: 10,
            },
        }),
    },
    flipText: { 
        color: colors.textOnDark, 
        fontWeight: '800', 
        fontSize: 18, 
        letterSpacing: -0.3,
    },
});

export default QuestWizard;
