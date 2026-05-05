// components/quests/QuestWizard.tsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    View,
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
import { createQuestWizardStyles } from './questWizardStyles';

// ===================== ТИПЫ =====================
export type { QuestStep, QuestCity, QuestFinale } from './types';
import type { QuestStep, QuestCity, QuestFinale } from './types';
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

const useQuestWizardTheme = (isMobile: boolean, screenW: number) => {
    const colors = useThemedColors();
    const styles = useMemo(() => createQuestWizardStyles(colors, isMobile, screenW), [colors, isMobile, screenW]);
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


export default QuestWizard;
