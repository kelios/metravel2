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
import DataFreshnessNotice from '@/components/legal/DataFreshnessNotice';
import { isBikeQuest, isLoopQuest } from '@/utils/questAudience';
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

import { fetchQuestByQuestId } from '@/api/quests';
import { saveQuestOffline } from '@/services/offline/questOfflineAdapter';
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { flushQuestAnswerAttempts } from '@/utils/questAnswerTelemetry';
import { useThemedColors } from '@/hooks/useTheme';
import { useQuestFontScaleStore } from '@/stores/questFontScaleStore';
import { useQuestWizardResponsiveModel } from './hooks/useQuestWizardResponsiveModel';
import { useQuestKeyboardReveal } from './hooks/useQuestKeyboardReveal';
import { createQuestWizardStyles } from './questWizardStyles';
import { useTranslation } from '@/i18n/LocaleProvider';

// ===================== ТИПЫ =====================
export type { QuestStep, QuestCity, QuestFinale } from './types';
import type { QuestStep, QuestCity, QuestFinale } from './types';
import { translate as i18nT } from '@/i18n'

export type QuestWizardProps = {
    title: string; steps: QuestStep[]; finale: QuestFinale; intro?: QuestStep;
    storageKey?: string; city?: QuestCity;
    coverUrl?: string;
    /** Теги квеста (meta.tags): `bike` выбирает веломаршрут, `loop` замыкает его к старту. */
    tags?: string[];
    /** Callback для синхронизации прогресса с бэкендом */
    onProgressChange?: (data: {
        currentIndex: number; unlockedIndex: number;
        answers: Record<string, string>; attempts: Record<string, number>;
        hints: Record<string, boolean>; showMap: boolean; completed?: boolean;
        /** Клиентские времена для слияния между устройствами (на сервер не уходят) */
        updatedAt?: number; answeredAt?: Record<string, number>;
    }) => void;
    /** Callback при сбросе прогресса */
    onProgressReset?: () => void;
    /** Начальный прогресс с бэкенда/гостевого хранилища — сливается с локальным */
    initialProgress?: {
        currentIndex: number; unlockedIndex: number;
        answers: Record<string, string>; attempts: Record<string, number>;
        hints: Record<string, boolean>; showMap: boolean; completed?: boolean;
        updatedAt?: number; answeredAt?: Record<string, number>;
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
export function QuestWizard({ title, steps, finale, intro, storageKey = 'quest_progress', city, coverUrl, tags, onProgressChange, onProgressReset, initialProgress, onFinaleVideoRetry, relatedTravelsSlot, ratingSlot, completionSlot, questId, cityId, questNumericId, guestMode = false, guestFreeSteps = 2, onGuestGate, onGuestLogin, onGuestRegister }: QuestWizardProps) {
    const { t } = useTranslation();
    const allSteps = useMemo(() => intro ? [intro, ...steps] : steps, [intro, steps]);
    // Detail API does not include tags; the list metadata enriches them shortly
    // afterwards. Keep routing paused until that classification is known so a
    // bike/loop quest never flashes or requests a pedestrian, open route first.
    const routeMode = tags ? (isBikeQuest(tags) ? 'bike' : 'foot') : undefined;
    // Кольцевой квест (тег `loop`): карта и все экспорты замыкают маршрут к старту.
    const closeLoopRoute = isLoopQuest(tags);

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

    // Гость прошёл лимит бесплатных точек. Гейт показываем каждый раз, когда игрок
    // упирается в очередную ещё не отвеченную точку сверх лимита: пройденные точки
    // и карта остаются доступны (мягкий гейт, не форсит выход), но новые ответы —
    // только после логина. Одноразовый флаг `guestGateDismissed` снимал гейт до
    // конца сессии, и гость проходил весь квест целиком без регистрации —
    // отсюда завершения квестов в аналитике без пользователя и прогресса.
    const guestAnsweredCount = completedSteps.length;
    const guestReachedLimit = guestMode && guestAnsweredCount >= guestFreeSteps;
    const currentStepAnswered = !!(allSteps[currentIndex] && answers[allSteps[currentIndex].id]);
    const guestGateActive = guestReachedLimit && !showFinaleOnly && !currentStepAnswered;

    const currentStep = allSteps[currentIndex];

    // Каждый шаг (и финал) открываем сверху — иначе на Android контент-ScrollView
    // сохраняет прошлый offset и новый шаг открывается прокрученным вниз.
    const contentScrollRef = useRef<ScrollView>(null);

    // Клавиатура не ужимает окно (edge-to-edge Android / visual viewport на mobile
    // web), поэтому поле ответа надо и подпереть отступом, и домотать до него.
    const {
        keyboardInset,
        handleContentScroll,
        handleInputFocus,
        handleInputBlur,
    } = useQuestKeyboardReveal(contentScrollRef);

    useEffect(() => {
        setDesktopNavExpanded(false);
        // Переход на следующий шаг — штатный момент доставки накопленных попыток
        // (#1276): игрок уже дошёл до сети хотя бы на секунду.
        void flushQuestAnswerAttempts();
        const id = requestAnimationFrame(() => {
            contentScrollRef.current?.scrollTo({ y: 0, animated: false });
        });
        return () => cancelAnimationFrame(id);
    }, [currentStep?.id, showFinaleOnly]);

    // Уход с экрана квеста: дожимаем очередь state-free запросом. Если он не
    // дойдёт (офлайн), события остаются в AsyncStorage до следующего открытия.
    useEffect(() => {
        return () => {
            void flushQuestAnswerAttempts();
        };
    }, []);

    const openCurrentStepInMap = useCallback((app: QuestMapApp) => {
        if (!currentStep) return;
        void openQuestMap(currentStep, app);
    }, [currentStep]);

    const copyCurrentStepCoords = useCallback(() => {
        if (!currentStep) return;
        void copyQuestCoords(currentStep);
    }, [currentStep]);

    const continueFromCurrentStep = useCallback(() => {
        if (currentIndex >= allSteps.length - 1) {
            setShowFinaleOnly(true);
            return;
        }
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
        continueFromCurrentStep();
    }, [continueFromCurrentStep, currentStep, questId, setAnswers, setAttempts, setHints, steps]);

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
        continueFromCurrentStep();
        if (hasNext) notifyQuest(i18nT('quests:components.quests.QuestWizard.shag_propuschen_f8686cda'));
    }, [allSteps.length, continueFromCurrentStep, currentIndex]);

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
        const ok = await confirmQuestAsync(i18nT('quests:components.quests.QuestWizard.sbrosit_progress_ffa455c0'), i18nT('quests:components.quests.QuestWizard.vse_vashi_otvety_budut_udaleny_103ee6ff'));
        if (!ok) return;
        try {
            await resetProgress();
            setShowFinaleOnly(false);
            notifyQuest(i18nT('quests:components.quests.QuestWizard.progress_ochischen_54659954'));
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
        void flushQuestAnswerAttempts();
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

    // Индекс последней РЕАЛЬНО отвеченной точки. `unlockedIndex` для этого не
    // годится: он указывает на следующую (ещё не отвеченную) точку, и «вернуться
    // к пройденным» открывало гостю новую точку вместо старых.
    const lastAnsweredIndex = useMemo(() => {
        for (let i = allSteps.length - 1; i >= 0; i -= 1) {
            const step = allSteps[i];
            if (step && answers[step.id]) return i;
        }
        return 0;
    }, [allSteps, answers]);

    const handleGuestGateDismiss = useCallback(() => {
        // Возвращаем игрока к последней пройденной точке — пройденное доступно.
        setCurrentIndex(lastAnsweredIndex);
    }, [lastAnsweredIndex, setCurrentIndex]);

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
        void generatePrintableQuest({ title, steps, intro, coverUrl, questUrl, finaleText: finale?.text, closeLoop: closeLoopRoute });
    }, [coverUrl, intro, steps, title, finale?.text, closeLoopRoute]);

    const offlineMapPointsCount = useMemo(() => getQuestOfflineMapPoints(steps).length, [steps]);

    const handleOfflineMapDownload = useCallback(() => {
        if (!routeMode) {
            notifyQuest(i18nT('quests:components.quests.QuestFullMap.zagruzka_karty_a7d37b43'));
            return;
        }
        void (async () => {
            try {
                const exported = await exportQuestOfflineMap({ title, steps, closeLoop: closeLoopRoute, routeMode });
                notifyQuest(
                    exported
                        ? routeMode === 'bike'
                          ? i18nT('quests:components.quests.QuestWizard.bikeGpxReady')
                          : i18nT('quests:components.quests.QuestWizard.gpx_s_peshim_marshrutom_kvesta_gotov_dd0919a1')
                        : offlineMapPointsCount >= 2
                          ? routeMode === 'bike'
                            ? i18nT('quests:components.quests.QuestFullMap.routeStatus.bikeBuildFailed')
                            : i18nT('quests:components.quests.QuestWizard.ne_udalos_postroit_realnyy_peshiy_marshrut_d_a06b2056')
                          : i18nT('quests:components.quests.QuestWizard.v_kveste_net_tochek_dlya_karty_e2d9a5ea'),
                );
            } catch {
                notifyQuest(i18nT('quests:components.quests.QuestWizard.ne_udalos_podgotovit_realnyy_marshrut_dlya_o_76e048c3'));
            }
        })();
    }, [offlineMapPointsCount, steps, title, closeLoopRoute, routeMode]);

    const handleOfflineMapOpenInApp = useCallback(() => {
        if (!routeMode) {
            notifyQuest(i18nT('quests:components.quests.QuestFullMap.zagruzka_karty_a7d37b43'));
            return;
        }
        void (async () => {
            try {
                const opened = await openQuestOfflineMapInApp({ title, steps, closeLoop: closeLoopRoute, routeMode });
                if (!opened) {
                    notifyQuest(
                        offlineMapPointsCount >= 2
                            ? routeMode === 'bike'
                              ? i18nT('quests:components.quests.QuestFullMap.routeStatus.bikeBuildFailed')
                              : i18nT('quests:components.quests.QuestWizard.ne_udalos_postroit_realnyy_peshiy_marshrut_d_1a2770b9')
                            : i18nT('quests:components.quests.QuestWizard.v_kveste_net_tochek_dlya_karty_e2d9a5ea'),
                    );
                }
            } catch {
                notifyQuest(i18nT('quests:components.quests.QuestWizard.ne_udalos_otkryt_realnyy_marshrut_v_prilozhe_20204379'));
            }
        })();
    }, [offlineMapPointsCount, steps, title, closeLoopRoute, routeMode]);

    // Скачать весь квест для офлайна: персистим сырой бандл в кэш и прогреваем
    // дисковый кэш фото (шаги + обложка + постер финала), чтобы квест открывался
    // без сети. Частичные фейлы фото не считаем провалом.
    const [offlineQuestState, setOfflineQuestState] = useState<'idle' | 'downloading' | 'done'>('idle');
    const { items: offlineItems } = useOfflineCatalog();
    const questSavedOffline = offlineItems.some(
        (item) => item.type === 'quest' && item.sourceId === String(questId ?? '') && item.pinned,
    );

    useEffect(() => {
        if (questSavedOffline) setOfflineQuestState('done');
    }, [questSavedOffline]);

    const handleOfflineQuestDownload = useCallback(() => {
        if (offlineQuestState === 'downloading') return;
        void (async () => {
            setOfflineQuestState('downloading');
            try {
                if (!questId) throw new Error('OFFLINE_QUEST_ID_MISSING');
                const bundle = await fetchQuestByQuestId(questId);
                const manifest = await saveQuestOffline(bundle, {
                    pinned: true,
                    includePhotos: true,
                    cityId,
                });
                if (!manifest) throw new Error('OFFLINE_QUEST_SAVE_FAILED');
                setOfflineQuestState('done');
                notifyQuest(
                    manifest.assetCount > 0
                        ? i18nT('quests:components.quests.QuestWizard.kvest_sohranen_dlya_oflayna_foto_value1_valu_b0544e7a', { value1: manifest.assetCount, value2: manifest.assetCount })
                        : i18nT('quests:components.quests.QuestWizard.kvest_sohranen_dlya_oflayna_da201f00'),
                );
            } catch {
                setOfflineQuestState('idle');
                notifyQuest(i18nT('quests:components.quests.QuestWizard.ne_udalos_sohranit_kvest_dlya_oflayna_21108b88'));
            }
        })();
    }, [cityId, offlineQuestState, questId]);

    const mainContent = (
        <View style={useWideExcursionsSidebar && city && Platform.OS === 'web' ? styles.pageRow : undefined}>
            {/* Левая колонка: шаги + карта + финал */}
            <View style={useWideExcursionsSidebar && city && Platform.OS === 'web' ? styles.pageMain : undefined}>
                {currentIndex === 0 && !showFinaleOnly && !guestGateActive ? (
                    <DataFreshnessNotice
                        text={t('quests:components.quests.QuestWizard.aiDisclosure')}
                        style={styles.aiDisclosure}
                        testID="quest-ai-disclosure"
                    />
                ) : null}

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
                                continueLabel={currentIndex >= allSteps.length - 1
                                    ? t('quests:components.quests.questWizardStepCard.continueToFinale')
                                    : t('quests:components.quests.questWizardStepCard.continueToNextStep')}
                                onContinue={continueFromCurrentStep}
                                onSubmit={handleCurrentStepAnswer}
                                onWrongAttempt={handleCurrentStepWrongAttempt}
                                onToggleHint={toggleCurrentStepHint}
                                onSkip={skipStep}
                                showMap={showMap}
                                onToggleMap={toggleMap}
                                showLocationControls={!useWideInlineLayout}
                                questNumericId={questNumericId}
                                onAnswerFocus={handleInputFocus}
                                onAnswerBlur={handleInputBlur}
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
                                closeLoopRoute={closeLoopRoute}
                                routeMode={routeMode}
                            />
                        )}
                    </View>
                )}

                {/* Экскурсии рядом — в основном потоке, когда нет отдельной правой колонки */}
                {(Platform.OS !== 'web' || !useWideExcursionsSidebar) && (!showFinaleOnly) && currentStep && city && (
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
                                onOfflineQuestDownload={handleOfflineQuestDownload}
                                offlineQuestState={offlineQuestState}
                                ratingSlot={ratingSlot}
                                completionSlot={completionSlot}
                                showExcursions={false}
                            />

                            <ScrollView
                                ref={contentScrollRef}
                                style={[styles.content, styles.compactMainContent]}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                onScrollBeginDrag={Keyboard.dismiss}
                                onScroll={handleContentScroll}
                                scrollEventThrottle={16}
                                contentContainerStyle={{ paddingBottom: SPACING.xl + 96 + keyboardInset }}
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
                                onOfflineQuestDownload={handleOfflineQuestDownload}
                                offlineQuestState={offlineQuestState}
                                ratingSlot={ratingSlot}
                                completionSlot={completionSlot}
                            />

                            {/* Контент */}
                            <ScrollView
                                ref={contentScrollRef}
                                style={styles.content}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                onScrollBeginDrag={Keyboard.dismiss}
                                onScroll={handleContentScroll}
                                scrollEventThrottle={16}
                                contentContainerStyle={[{ paddingBottom: SPACING.xl + 96 + keyboardInset }, useWideExcursionsSidebar && styles.contentInner]}
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
