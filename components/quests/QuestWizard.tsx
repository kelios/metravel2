// components/quests/QuestWizard.tsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
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
    QuestNativeAffiliateSection,
} from './questWizardSections';
import { QuestStepCard } from './questWizardStepCard';
import QuestGuestGate from './QuestGuestGate';
import { useQuestWizardProgress } from './useQuestWizardProgress';
import { useQuestReminder } from './useQuestReminder';
import { useQuestGeofence } from './useQuestGeofence';
import {
    confirmQuestAsync,
    copyQuestCoords,
    notifyQuest,
    openQuestMap,
    type QuestMapApp,
} from './questWizardHelpers';
import { exportQuestOfflineMap, getQuestOfflineMapPoints, openQuestOfflineMapInApp } from './questOfflineMapExport';

import { queueAnalyticsEvent } from '@/utils/analytics';
import { useThemedColors } from '@/hooks/useTheme';
import { useQuestFontScaleStore } from '@/stores/questFontScaleStore';
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
    /** Доп. блок под экскурсиями (напр. «Путешествия по этому городу») */
    relatedTravelsSlot?: React.ReactNode;
    /** Readonly-рейтинг квеста под заголовком в шапке */
    ratingSlot?: React.ReactNode;
    /** Бейдж «Пройден» + «Пройдено N раз» под заголовком в шапке */
    completionSlot?: React.ReactNode;
    /** Native: id города/квеста для deep-link локального напоминания о незавершённом квесте */
    questId?: string;
    cityId?: string;
    /** Числовой PK квеста (для отзыва после прохождения) */
    questNumericId?: number;
    /** Гостевой режим: первые N точек доступны без логина, дальше — мягкий гейт */
    guestMode?: boolean;
    /** Сколько «настоящих» точек (без intro) гость проходит до гейта */
    guestFreeSteps?: number;
    /** Гость дошёл до гейта (для аналитики quest_guest_gate_view) */
    onGuestGate?: (passedCount: number) => void;
    /** Гость нажал «Войти» в гейте */
    onGuestLogin?: () => void;
    /** Гость нажал «Зарегистрироваться» в гейте */
    onGuestRegister?: () => void;
};

// ===================== ТЕМА =====================
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

const useQuestWizardTheme = (isMobile: boolean, screenW: number) => {
    const colors = useThemedColors();
    const fontScale = useQuestFontScaleStore((s) => s.fontScale);
    const styles = useMemo(() => createQuestWizardStyles(colors, isMobile, screenW, fontScale), [colors, isMobile, screenW, fontScale]);
    return { colors, styles };
};
// ===================== ОСНОВНОЙ КОМПОНЕНТ =====================
export function QuestWizard({ title, steps, finale, intro, storageKey = 'quest_progress', city, coverUrl, onProgressChange, onProgressReset, initialProgress, onFinaleVideoRetry, relatedTravelsSlot, ratingSlot, completionSlot, questId, cityId, questNumericId, guestMode = false, guestFreeSteps = 2, onGuestGate, onGuestLogin, onGuestRegister }: QuestWizardProps) {
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
        requiredCount,
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
    useQuestReminder({
        questId,
        cityId,
        title,
        completedCount: completedSteps.length,
        totalCount: requiredCount,
        allCompleted,
    });
    useQuestGeofence({
        questId,
        cityId,
        title,
        steps,
        answers,
        allCompleted,
    });

    const [showFinaleOnly, setShowFinaleOnly] = useState(false);
    const [desktopNavExpanded, setDesktopNavExpanded] = useState(false);
    const [guestGateDismissed, setGuestGateDismissed] = useState(false);

    // Гость прошёл лимит бесплатных точек. Гейт показываем, только когда игрок
    // упирается в следующую (ещё не отвеченную) точку сверх лимита — уже
    // пройденные точки остаются доступны (мягкий гейт, не форсит выход).
    const guestAnsweredCount = completedSteps.length;
    const guestReachedLimit = guestMode && guestAnsweredCount >= guestFreeSteps;
    const currentStepAnswered = !!(allSteps[currentIndex] && answers[allSteps[currentIndex].id]);
    const guestGateActive =
        guestReachedLimit && !guestGateDismissed && !showFinaleOnly && !currentStepAnswered;

    const currentStep = allSteps[currentIndex];

    useEffect(() => {
        setDesktopNavExpanded(false);
    }, [currentStep?.id]);

    const openCurrentStepInMap = useCallback((app: QuestMapApp) => {
        if (!currentStep) return;
        void openQuestMap(currentStep, app);
    }, [currentStep]);

    const copyCurrentStepCoords = useCallback(() => {
        if (!currentStep) return;
        void copyQuestCoords(currentStep);
    }, [currentStep]);

    const advanceToNextStep = useCallback(() => {
        const nextIndex = Math.min(currentIndex + 1, allSteps.length - 1);
        setCurrentIndex(nextIndex);
        setUnlockedIndex(prev => Math.max(prev, nextIndex));
    }, [allSteps.length, currentIndex, setCurrentIndex, setUnlockedIndex]);

    const handleCurrentStepAnswer = useCallback((answer: string) => {
        if (!currentStep) return;
        setAnswers(prev => ({ ...prev, [currentStep.id]: answer }));
        setAttempts(prev => ({ ...prev, [currentStep.id]: 0 }));
        setHints(prev => ({ ...prev, [currentStep.id]: false }));
        queueAnalyticsEvent('quest_point_done', {
            quest_id: questId,
            step_index: steps.findIndex(step => step.id === currentStep.id),
        });
        advanceToNextStep();
    }, [advanceToNextStep, currentStep, questId, setAnswers, setAttempts, setHints, steps]);

    const handleCurrentStepWrongAttempt = useCallback(() => {
        if (!currentStep) return;
        setAttempts(prev => ({ ...prev, [currentStep.id]: (prev[currentStep.id] || 0) + 1 }));
    }, [currentStep, setAttempts]);

    const toggleCurrentStepHint = useCallback(() => {
        if (!currentStep) return;
        setHints(prev => ({ ...prev, [currentStep.id]: !prev[currentStep.id] }));
    }, [currentStep, setHints]);

    const toggleMap = useCallback(() => {
        setShowMap(prev => !prev);
    }, [setShowMap]);

    const skipStep = useCallback(() => {
        const hasNext = currentIndex < allSteps.length - 1;
        advanceToNextStep();
        if (hasNext) notifyQuest('Шаг пропущен');
    }, [advanceToNextStep, allSteps.length, currentIndex]);

    const goToStep = useCallback((index: number) => {
        const step = allSteps[index];
        const isAnswered = !!(step && answers[step.id]);
        if (index <= unlockedIndex || isAnswered || allCompleted) {
            setShowFinaleOnly(false);
            setCurrentIndex(index);
        }
    }, [allCompleted, allSteps, answers, setCurrentIndex, unlockedIndex]);

    const showFinale = useCallback(() => {
        setShowFinaleOnly(true);
    }, []);

    const resetQuest = useCallback(async () => {
        const ok = await confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.');
        if (!ok) return;
        try {
            await resetProgress();
            setShowFinaleOnly(false);
            notifyQuest('Прогресс очищен');
        } catch (e) {
            console.error('Error resetting progress:', e);
        }
    }, [resetProgress]);

    const questStartTrackedRef = useRef(false);
    useEffect(() => {
        if (questStartTrackedRef.current) return;
        const isRealStep = !!currentStep && currentStep.id !== intro?.id;
        if (!isRealStep) return;
        questStartTrackedRef.current = true;
        queueAnalyticsEvent('quest_start', {
            quest_id: questId,
            city: cityId,
        });
    }, [cityId, currentStep, intro?.id, questId]);

    const questFinishTrackedRef = useRef(false);
    useEffect(() => {
        if (!allCompleted || questFinishTrackedRef.current) return;
        questFinishTrackedRef.current = true;
        queueAnalyticsEvent('quest_finish', { quest_id: questId });
    }, [allCompleted, questId]);

    const guestGateTrackedRef = useRef(false);
    useEffect(() => {
        if (!guestGateActive || guestGateTrackedRef.current) return;
        guestGateTrackedRef.current = true;
        queueAnalyticsEvent('quest_guest_gate_view', {
            quest_id: questId,
            city: cityId,
            passed_count: guestAnsweredCount,
        });
        onGuestGate?.(guestAnsweredCount);
    }, [cityId, guestAnsweredCount, guestGateActive, onGuestGate, questId]);

    const handleGuestGateDismiss = useCallback(() => {
        setGuestGateDismissed(true);
        // Возвращаем игрока к последней пройденной точке — пройденное доступно.
        const lastAnsweredIndex = Math.max(0, unlockedIndex);
        setCurrentIndex(lastAnsweredIndex);
    }, [setCurrentIndex, unlockedIndex]);

    useEffect(() => {
        if (allCompleted) { setShowFinaleOnly(true); setUnlockedIndex(allSteps.length - 1); }
    }, [allCompleted, allSteps.length, setUnlockedIndex]);

    const {
        frameW,
        videoOk,
        setVideoOk,
        videoUri,
        posterUri,
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

    const offlineMapPointsCount = useMemo(() => getQuestOfflineMapPoints(steps).length, [steps]);

    const handleOfflineMapDownload = useCallback(() => {
        void (async () => {
            try {
                const exported = await exportQuestOfflineMap({ title, steps });
                notifyQuest(exported ? 'Файл с точками квеста готов' : 'В квесте нет точек для карты');
            } catch {
                notifyQuest('Не удалось подготовить точки для офлайн-карты');
            }
        })();
    }, [steps, title]);

    const handleOfflineMapOpenInApp = useCallback(() => {
        void (async () => {
            try {
                const opened = await openQuestOfflineMapInApp({ title, steps });
                if (!opened) notifyQuest('В квесте нет точек для карты');
            } catch {
                notifyQuest('Не удалось открыть точки в приложении карт');
            }
        })();
    }, [steps, title]);

    const mainContent = (
        <View style={useWideExcursionsSidebar && city && Platform.OS === 'web' ? styles.pageRow : undefined}>
            {/* Левая колонка: шаги + карта + финал */}
            <View style={useWideExcursionsSidebar && city && Platform.OS === 'web' ? styles.pageMain : undefined}>
                {/* Гостевой мягкий гейт после лимита бесплатных точек */}
                {guestGateActive && (
                    <QuestGuestGate
                        passedCount={guestAnsweredCount}
                        onLogin={() => onGuestLogin?.()}
                        onRegister={() => onGuestRegister?.()}
                        onDismiss={handleGuestGateDismiss}
                        testID="quest-guest-gate"
                    />
                )}

                {/* Шаги/карты — скрываем, если показываем только финал или активен гостевой гейт */}
                {(!showFinaleOnly) && !guestGateActive && currentStep && (
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
                                onSubmit={handleCurrentStepAnswer}
                                onWrongAttempt={handleCurrentStepWrongAttempt}
                                onToggleHint={toggleCurrentStepHint}
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
                                showMap={showMap}
                                toggleMap={toggleMap}
                                openCurrentStepInMap={openCurrentStepInMap}
                                copyCurrentStepCoords={copyCurrentStepCoords}
                                activeStepIndex={currentIndex > 0 ? currentIndex - 1 : undefined}
                            />
                        )}
                    </View>
                )}

                {/* Экскурсии рядом — в основном потоке, когда нет отдельной правой колонки */}
                {!useWideExcursionsSidebar && (!showFinaleOnly) && currentStep && city && Platform.OS === 'web' && (
                    <QuestExcursionsInline
                        colors={colors}
                        styles={styles}
                        city={city}
                        title={title}
                    />
                )}

                {Platform.OS !== 'web' && (!showFinaleOnly) && currentStep && city && (
                    <QuestNativeAffiliateSection
                        colors={colors}
                        styles={styles}
                        city={city}
                        questId={questId}
                    />
                )}

                {/* Путешествия по этому городу — обратная перелинковка квест → travel */}
                {!showFinaleOnly && relatedTravelsSlot}

                {/* Финал — доступен всегда; видео — когда всё пройдено */}
                {showFinaleOnly && (
                    <QuestFinalePanel
                        colors={colors}
                        styles={styles}
                        finale={finale}
                        allCompleted={allCompleted}
                        completedCount={completedSteps.length}
                        stepsCount={requiredCount}
                        frameW={frameW}
                        youtubeEmbedUri={youtubeEmbedUri}
                        videoOk={videoOk}
                        videoUri={videoUri}
                        posterUri={posterUri}
                        handleVideoError={handleVideoError}
                        handleVideoRetry={handleVideoRetry}
                        setVideoOk={setVideoOk}
                        onContinue={() => setShowFinaleOnly(false)}
                        questId={questId}
                        questNumericId={questNumericId}
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
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    {compactDesktopLayout ? (
                        <View style={styles.compactShell}>
                            <QuestCompactSidebar
                                colors={colors}
                                styles={styles}
                                title={title}
                                progress={progress}
                                completedCount={completedSteps.length}
                                stepsCount={requiredCount}
                                allSteps={allSteps}
                                answers={answers}
                                currentIndex={currentIndex}
                                unlockedIndex={unlockedIndex}
                                allCompleted={allCompleted}
                                showFinaleOnly={showFinaleOnly}
                                goToStep={goToStep}
                                onShowFinale={showFinale}
                                city={city}
                                onReset={resetQuest}
                                onPrintDownload={handlePrintDownload}
                                onOfflineMapDownload={handleOfflineMapDownload}
                                onOfflineMapOpenInApp={handleOfflineMapOpenInApp}
                                offlineMapPointsCount={offlineMapPointsCount}
                                ratingSlot={ratingSlot}
                                completionSlot={completionSlot}
                                showExcursions={false}
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
                                stepsCount={requiredCount}
                                allSteps={allSteps}
                                answers={answers}
                                currentIndex={currentIndex}
                                unlockedIndex={unlockedIndex}
                                allCompleted={allCompleted}
                                showFinaleOnly={showFinaleOnly}
                                goToStep={goToStep}
                                onShowFinale={showFinale}
                                isMobile={isMobile}
                                screenW={screenW}
                                compactNav={compactNav}
                                onReset={resetQuest}
                                onPrintDownload={handlePrintDownload}
                                onOfflineMapDownload={handleOfflineMapDownload}
                                onOfflineMapOpenInApp={handleOfflineMapOpenInApp}
                                offlineMapPointsCount={offlineMapPointsCount}
                                ratingSlot={ratingSlot}
                                completionSlot={completionSlot}
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
