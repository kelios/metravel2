// components/quests/QuestWizard.tsx
import React, {
    memo,
    useEffect,
    useMemo,
    useRef,
    useState,
    lazy,
    Suspense,
} from 'react';
import {
    View, Text, StyleSheet, TextInput, Pressable,
    ScrollView, Platform, Linking,
    Animated, KeyboardAvoidingView, SafeAreaView, Vibration,
    Dimensions, Modal, Image, Keyboard
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';

// ⚡️ Heavy deps lazy-loaded to keep chunk small
const BelkrajWidgetLazy = lazy(() => import("@/components/belkraj/BelkrajWidget"));
const getClipboard = () => import('expo-clipboard');

// Lazy wrapper for expo-av Video (only used on native finale)
const NativeVideoLazy = lazy(() =>
    import('expo-av').then((m) => ({
        default: memo(function NativeVideo(props: {
            source: any; posterSource?: any; usePoster?: boolean;
            style?: any; useNativeControls?: boolean; shouldPlay?: boolean;
            isLooping?: boolean; onError?: () => void;
        }) {
            return (
                <m.Video
                    {...props}
                    resizeMode={m.ResizeMode.CONTAIN}
                    // @ts-ignore
                    playsInline
                />
            );
        }),
    }))
);
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

const QuestFullMap = lazy(() => import("@/components/quests/QuestFullMap"));

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
    /** Callback для синхронизации прогресса с бэкендом */
    onProgressChange?: (data: {
        currentIndex: number; unlockedIndex: number;
        answers: Record<string, string>; attempts: Record<string, number>;
        hints: Record<string, boolean>; showMap: boolean; completed?: boolean;
    }) => void;
    /** Callback при сбросе прогресса */
    onProgressReset?: () => void;
};

// ===================== ТЕМА =====================
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

const useQuestWizardTheme = () => {
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return { colors, styles };
};

// ======== helpers ========
const notify = (msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
    else console.info('[INFO]', msg);
};
const confirmAsync = async (title: string, message: string): Promise<boolean> => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    console.info('[CONFIRM]', title, message);
    return Promise.resolve(true);
};
const resolveUri = (src: any | undefined): string | undefined => {
    if (!src) return undefined;
    if (typeof src === 'string') return src;
    // @ts-ignore
    const u = Image.resolveAssetSource?.(src)?.uri;
    return u;
};
// ===================== ЗУМ КАРТИНОК =====================
const ImageZoomModal = ({ image, visible, onClose }: { image: any; visible: boolean; onClose: () => void; }) => {
    const { styles } = useQuestWizardTheme();
    const scale = useRef(new Animated.Value(1)).current;
    const shouldUseNativeDriver = Platform.OS !== 'web';
    // @ts-ignore
    const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], { useNativeDriver: shouldUseNativeDriver });
    const onPinchStateChange = (e: any) => {
        if (e.nativeEvent.oldState === State.ACTIVE) Animated.spring(scale, { toValue: 1, useNativeDriver: shouldUseNativeDriver }).start();
    };
    if (!visible) return null;
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <GestureHandlerRootView style={styles.gestureContainer}>
                    <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
                        <Animated.View style={styles.animatedContainer}>
                            <Animated.Image source={image} style={[styles.zoomedImage, { transform: [{ scale }] }]} resizeMode="contain" />
                        </Animated.View>
                    </PinchGestureHandler>
                </GestureHandlerRootView>
                <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}><Text style={styles.closeButtonText}>✕</Text></Pressable>
                <View style={styles.zoomHintContainer}><Text style={styles.zoomHint}>Используйте два пальца, чтобы увеличить фото</Text></View>
            </View>
        </Modal>
    );
};

// ===================== КАРТОЧКА ШАГА =====================
type StepCardProps = {
    step: QuestStep; index: number; attempts: number; hintVisible: boolean; savedAnswer?: string;
    onSubmit: (v: string) => void; onWrongAttempt: () => void; onToggleHint: () => void; onSkip: () => void;
    showMap: boolean; onToggleMap: () => void;
};

const StepCard = memo((props: StepCardProps) => {
    const { step, index, attempts, hintVisible, savedAnswer, onSubmit, onWrongAttempt, onToggleHint, onSkip, showMap, onToggleMap } = props;
    const { colors, styles } = useQuestWizardTheme();

    const [value, setValue] = useState(''); const [error, setError] = useState('');
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [hasOrganic, setHasOrganic] = useState(false); const [hasMapsme, setHasMapsme] = useState(false);
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const shouldUseNativeDriver = Platform.OS !== 'web';

    // flip animation
    const flip = useRef(new Animated.Value(0)).current;
    const triggerFlip = () => { flip.setValue(0); Animated.timing(flip, { toValue: 1, duration: 600, useNativeDriver: shouldUseNativeDriver }).start(() => flip.setValue(0)); };
    const rot = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '180deg', '360deg'] });

    useEffect(() => { setValue(''); setError(''); }, [step.id]);

    useEffect(() => { (async () => {
        try { const om = await Linking.canOpenURL('om://map'); const om2 = await Linking.canOpenURL('organicmaps://'); setHasOrganic(Boolean(om || om2)); } catch { /* ignore missing map handlers */ }
        try { const mm = await Linking.canOpenURL('mapsme://map'); setHasMapsme(Boolean(mm)); } catch { /* ignore missing mapsme */ }
    })(); }, [step.id]);

    const openCandidates = async (cands: Array<string | undefined>) => {
        for (const url of cands) {
            if (!url) continue;
            try { const ok = await Linking.canOpenURL(url); if (ok) { await Linking.openURL(url); return; } } catch { /* ignore failed link open */ }
        }
        notify('Не удалось открыть карты. Проверьте, что установлено нужное приложение.');
    };

    const openInMap = async (app: 'google' | 'apple' | 'yandex' | 'organic' | 'mapsme') => {
        const { lat, lng } = step; const name = encodeURIComponent(step.title || 'Point');
        const urls = {
            google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            apple: `http://maps.apple.com/?ll=${lat},${lng}`,
            yandex: `https://yandex.ru/maps/?pt=${lng},${lat}&z=15`,
            organic_1: `om://map?ll=${lat},${lng}&z=17`,
            organic_2: `organicmaps://map?ll=${lat},${lng}&z=17`,
            organic_web: `https://omaps.app/?lat=${lat}&lon=${lng}&zoom=17`,
            mapsme: `mapsme://map?ll=${lat},${lng}&zoom=17&n=${name}`,
            geo: Platform.OS === 'android' ? `geo:${lat},${lng}?q=${lat},${lng}(${name})` : undefined,
        } as const;
        if (app === 'organic') return openCandidates([urls.organic_1, urls.organic_2, urls.organic_web, urls.geo, urls.google]);
        if (app === 'mapsme')  return openCandidates([urls.mapsme, urls.geo, urls.google]);
        return openCandidates([urls[app]]);
    };

    const copyCoords = async () => { const Clipboard = await getClipboard(); await Clipboard.setStringAsync(`${step.lat.toFixed(6)}, ${step.lng.toFixed(6)}`); notify('Координаты скопированы'); };

    const shake = () => {
        shakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: shouldUseNativeDriver }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: shouldUseNativeDriver }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: shouldUseNativeDriver }),
        ]).start();
    };

    const handleCheck = () => {
        const trimmed = value.trim();
        if (step.id === 'intro') { onSubmit('start'); return; }
        if (!trimmed) { setError('Введите ответ'); shake(); Vibration.vibrate(50); return; }
        const normalized = step.inputType === 'number' ? trimmed.replace(',', '.').trim() : trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
        const ok = step.answer(normalized);
        if (ok) { setError(''); Vibration.vibrate(60); triggerFlip(); setTimeout(() => { onSubmit(trimmed); Keyboard.dismiss(); }, 520); }
        else { setError('Неверный ответ'); onWrongAttempt(); shake(); Vibration.vibrate(200); }
    };

    const isPassed = !!savedAnswer && step.id !== 'intro';
    const showHintAfter = 2;

    return (
        <Animated.View style={[styles.card, { transform: [{ perspective: 800 }, { rotateY: rot }] }]}>
            {/* Заголовок */}
            <View style={styles.cardHeader}>
                <View style={[styles.stepNumber, isPassed && styles.stepNumberCompleted]}>
                    <Text style={styles.stepNumberText}>{step.id === 'intro' ? '0' : index}</Text>
                </View>
                <View style={styles.headerContent}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Pressable onPress={() => openInMap(Platform.OS === 'ios' ? 'apple' : 'google')}>
                        <Text style={styles.location}>{step.location}</Text>
                    </Pressable>
                </View>
                {isPassed && (<View style={styles.completedBadge}><Text style={styles.completedText}>✓</Text></View>)}
            </View>

            {/* Легенда */}
            <View style={styles.section}><Text style={styles.sectionTitle}>Легенда</Text><Text style={styles.storyText}>{step.story}</Text></View>

            {/* Задание */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Задание</Text>
                <Text style={styles.taskText}>{step.task}</Text>

                {step.id !== 'intro' && !isPassed && (
                    step.answer.toString() === '() => true'
                        ? (
                            <Pressable style={styles.primaryButton} onPress={() => onSubmit('ok')} hitSlop={6}>
                                <Text style={styles.buttonText}>Далее</Text>
                            </Pressable>
                        ) : (
                            <>
                                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                                    <TextInput
                                        style={[
                                            styles.input, 
                                            error ? styles.inputError : null,
                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                        ]}
                                        placeholder="Ваш ответ..."
                                        placeholderTextColor={colors.textMuted}
                                        value={value}
                                        onChangeText={setValue}
                                        onSubmitEditing={handleCheck}
                                        returnKeyType="done"
                                        keyboardType={step.inputType === 'number' ? (Platform.OS === 'ios' ? 'number-pad' : 'numeric') : 'default'}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </Animated.View>
                                {error && (
                                    <View style={styles.errorContainer}>
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                )}
                                <View style={styles.actions}>
                                    <Pressable 
                                        style={styles.primaryButton} 
                                        onPress={handleCheck} 
                                        hitSlop={6}
                                        accessibilityRole="button"
                                        accessibilityLabel="Проверить ответ"
                                    >
                                        <Text style={styles.buttonText}>Проверить</Text>
                                    </Pressable>
                                    {step.hint && (
                                        <Pressable 
                                            style={styles.secondaryButton} 
                                            onPress={onToggleHint} 
                                            hitSlop={6}
                                            accessibilityRole="button"
                                            accessibilityLabel={hintVisible ? 'Скрыть подсказку' : 'Показать подсказку'}
                                        >
                                            <Text style={styles.secondaryButtonText}>{hintVisible ? 'Скрыть подсказку' : 'Подсказка'}</Text>
                                        </Pressable>
                                    )}
                                    <Pressable 
                                        style={styles.ghostButton} 
                                        onPress={onSkip} 
                                        hitSlop={6}
                                        accessibilityRole="button"
                                        accessibilityLabel="Пропустить шаг"
                                    >
                                        <Text style={styles.ghostButtonText}>Пропустить</Text>
                                    </Pressable>
                                </View>
                                {step.hint && attempts < showHintAfter && !hintVisible && (
                                    <Text style={styles.hintPrompt}>Подсказка откроется после {showHintAfter - attempts} попыток</Text>
                                )}
                            </>
                        )
                )}

                {hintVisible && step.hint && (<View style={styles.hintContainer}><Text style={styles.hintText}>Подсказка: {step.hint}</Text></View>)}

                {isPassed && (
                    <View style={styles.answerContainer}>
                        <Text style={styles.answerLabel}>Ваш ответ:</Text>
                        <Text style={styles.answerValue}>{savedAnswer}</Text>
                    </View>
                )}
            </View>

            {/* Локация */}
            {step.id !== 'intro' && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Локация</Text>
                    <View style={styles.mapActions}>
                        <Pressable style={styles.mapButton} onPress={() => openInMap('google')} hitSlop={6}><Text style={styles.mapButtonText}>Google Maps</Text></Pressable>
                        {Platform.OS === 'ios' && (<Pressable style={styles.mapButton} onPress={() => openInMap('apple')} hitSlop={6}><Text style={styles.mapButtonText}>Apple Maps</Text></Pressable>)}
                        <Pressable style={styles.mapButton} onPress={() => openInMap('yandex')} hitSlop={6}><Text style={styles.mapButtonText}>Yandex Maps</Text></Pressable>
                        {hasOrganic && (<Pressable style={styles.mapButton} onPress={() => openInMap('organic')} hitSlop={6}><Text style={styles.mapButtonText}>Organic Maps</Text></Pressable>)}
                        {hasMapsme && (<Pressable style={styles.mapButton} onPress={() => openInMap('mapsme')} hitSlop={6}><Text style={styles.mapButtonText}>MAPS.ME</Text></Pressable>)}
                        <Pressable style={styles.mapButton} onPress={copyCoords} hitSlop={6}><Text style={styles.mapButtonText}>Координаты</Text></Pressable>
                        <Pressable style={styles.mapPhotoButton} onPress={onToggleMap} hitSlop={8}><Text style={styles.mapPhotoButtonText}>{showMap ? 'Скрыть фото локации' : 'Показать фото локации'}</Text></Pressable>
                    </View>

                    {showMap && step.image && (
                        <>
                            <Text style={styles.photoHint}>Это статичное фото-подсказка, не интерактивная карта.</Text>
                            <Pressable style={styles.imagePreview} onPress={() => setImageModalVisible(true)}>
                                <Image source={typeof step.image === 'string' ? { uri: step.image } : step.image} style={styles.previewImage} />
                                <View style={styles.imageOverlay}><Text style={styles.overlayText}>Нажмите для увеличения</Text></View>
                            </Pressable>
                        </>
                    )}

                    <ImageZoomModal image={typeof step.image === 'string' ? { uri: step.image } : step.image} visible={imageModalVisible} onClose={() => setImageModalVisible(false)} />
                </View>
            )}

            {step.id === 'intro' && (<Pressable style={styles.startButton} onPress={handleCheck} hitSlop={6}><Text style={styles.startButtonText}>Начать квест</Text></Pressable>)}

            {/* Оверлей сообщения на пике flip */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: flip.interpolate({ inputRange: [0.35, 0.5, 0.65], outputRange: [0, 1, 0] }),
                    },
                    { pointerEvents: 'none' } as any,
                ]}
            >
                <View style={styles.flipBadge}><Text style={styles.flipText}>✓ Правильно!</Text></View>
            </Animated.View>
        </Animated.View>
    );
});

// ===================== ОСНОВНОЙ КОМПОНЕНТ =====================
export function QuestWizard({ title, steps, finale, intro, storageKey = 'quest_progress', city, onProgressChange, onProgressReset }: QuestWizardProps) {
    const { colors, styles } = useQuestWizardTheme();
    const allSteps = useMemo(() => intro ? [intro, ...steps] : steps, [intro, steps]);

    const { width: screenW, height: screenH } = useResponsive();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [unlockedIndex, setUnlockedIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [attempts, setAttempts] = useState<Record<string, number>>({});
    const [hints, setHints] = useState<Record<string, boolean>>({});
    const [showMap, setShowMap] = useState(true);
    const [showFinaleOnly, setShowFinaleOnly] = useState(false);
    const suppressSave = useRef(false);

    const compactNav = screenW < 600;
    const wideDesktop = screenW >= 900;

    // Загрузка прогресса
    useEffect(() => {
        const loadProgress = async () => {
            try {
                suppressSave.current = true;
                const saved = await AsyncStorage.getItem(storageKey);
                if (saved) {
                    // ✅ FIX-010: Используем безопасный парсинг JSON
                    const { safeJsonParseString } = require('@/src/utils/safeJsonParse');
                    const data = safeJsonParseString(saved, { index: 0, unlocked: 0, answers: {}, attempts: {}, hints: {}, showMap: true });
                    setCurrentIndex(data.index ?? 0);
                    setUnlockedIndex(data.unlocked ?? 0);
                    setAnswers(data.answers ?? {});
                    setAttempts(data.attempts ?? {});
                    setHints(data.hints ?? {});
                    setShowMap(data.showMap !== undefined ? data.showMap : true);
                } else {
                    setCurrentIndex(0); setUnlockedIndex(0); setAnswers({}); setAttempts({}); setHints({}); setShowMap(true);
                }
            } catch (e) {
                // ✅ FIX-007: Используем централизованный logger
                const { devError } = require('@/src/utils/logger');
                devError('Error loading quest progress:', e);
            } finally {
                setTimeout(() => { suppressSave.current = false; }, 0);
            }
        };
        loadProgress();
    }, [storageKey]);

    // Сохранение прогресса (локально + бэкенд)
    useEffect(() => {
        if (suppressSave.current) return;
        AsyncStorage.setItem(storageKey, JSON.stringify({
            index: currentIndex, unlocked: unlockedIndex, answers, attempts, hints, showMap
        })).catch(e => console.error('Error saving progress:', e));
        // Синхронизация с бэкендом
        onProgressChange?.({
            currentIndex, unlockedIndex: unlockedIndex, answers, attempts, hints, showMap,
        });
    }, [currentIndex, unlockedIndex, answers, attempts, hints, showMap, storageKey]);

    const completedSteps = steps.filter(s => answers[s.id]);
    const progress = steps.length > 0 ? completedSteps.length / steps.length : 0;
    const allCompleted = completedSteps.length === steps.length;

    // индекс последнего пройденного шага (по answers), игнорируя intro
    const maxAnsweredIndex = useMemo(() => {
        let maxIdx = 0;
        for (let i = 0; i < allSteps.length; i++) {
            const s = allSteps[i];
            if (s.id !== 'intro' && answers[s.id]) maxIdx = Math.max(maxIdx, i);
        }
        return maxIdx;
    }, [allSteps, answers]);

    // держим unlockedIndex не меньше, чем (последний пройденный + 1)
    useEffect(() => {
        const nextReachable = Math.min(maxAnsweredIndex + 1, allSteps.length - 1);
        setUnlockedIndex(prev => Math.max(prev, nextReachable));
    }, [maxAnsweredIndex, allSteps.length]);

    const currentStep = allSteps[currentIndex];

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
        const ok = await confirmAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.');
        if (!ok) return;
        try {
            suppressSave.current = true;
            await AsyncStorage.removeItem(storageKey);
            setCurrentIndex(0); setUnlockedIndex(0); setAnswers({}); setAttempts({}); setHints({}); setShowMap(true); setShowFinaleOnly(false);
            await AsyncStorage.setItem(storageKey, JSON.stringify({ index: 0, unlocked: 0, answers: {}, attempts: {}, hints: {}, showMap: true }));
            onProgressReset?.();
            notify('Прогресс очищен');
        } catch (e) {
            console.error('Error resetting progress:', e);
        } finally {
            setTimeout(() => { suppressSave.current = false; }, 0);
        }
    };

    // Когда всё пройдено
    useEffect(() => {
        if (allCompleted) { setShowFinaleOnly(true); setUnlockedIndex(allSteps.length - 1); }
    }, [allCompleted, allSteps.length]);

    // ====== Навигация: «Финал» ======
    const FinalePill = ({ active }: { active: boolean }) => (
        <Pressable onPress={() => setShowFinaleOnly(true)}
                   style={[styles.stepPill, active ? styles.stepPillActive : styles.stepPillUnlocked]} hitSlop={6}>
            <Text style={[styles.stepPillIndex, active && { color: colors.textOnPrimary }]}></Text>
            <Text style={[styles.stepPillTitle, active && { color: colors.textOnPrimary }]} numberOfLines={1}>Финал</Text>
        </Pressable>
    );
    const FinaleDot = ({ active }: { active: boolean }) => (
        <Pressable onPress={() => setShowFinaleOnly(true)}
                   style={[styles.stepDotMini, active ? styles.stepDotMiniActive : styles.stepDotMiniUnlocked]} hitSlop={6}>
            <Text style={[styles.stepDotMiniText, active && { color: colors.textOnPrimary }]}>Ф</Text>
        </Pressable>
    );

    // ====== размеры видео-рамки (адаптив 16:9 + ограничение по высоте)
    const videoMaxWidth = 960;
    const horizontalPadding = SPACING.md * 2;
    const footerReserve = 88;
    const headerReserve = 220;
    const maxFrameHeight = Math.max(180, screenH - headerReserve - footerReserve);
    let frameW = Math.min(Math.max(screenW - horizontalPadding, 240), videoMaxWidth);
    let frameH = (frameW * 9) / 16;
    if (frameH > maxFrameHeight) { frameH = maxFrameHeight; frameW = (frameH * 16) / 9; }

    // ====== видео веб/нэйтив
    const [videoOk, setVideoOk] = useState(true);
    const videoUri = useMemo(() => resolveUri(finale.video), [finale.video]);
    const posterUri = useMemo(() => resolveUri(finale.poster), [finale.poster]);

    // нативный WEB <video>
    const WebVideo = ({ src, poster }: { src?: string; poster?: string }) => {
        // @ts-ignore - RNW позволяет напрямую создавать DOM-элементы
        return React.createElement('video', {
            src,
            poster,
            controls: true,
            playsInline: true,
            // @ts-ignore
            style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' },
            onError: () => setVideoOk(false),
        });
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    {/* Шапка */}
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <Text style={styles.title}>{title}</Text>
                            <Pressable onPress={resetQuest} style={styles.resetButton} hitSlop={6}>
                                <Text style={styles.resetText}>Сбросить</Text>
                            </Pressable>
                        </View>

                        {/* Прогресс */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
                            <Text style={styles.progressText}>{completedSteps.length} / {steps.length} завершено</Text>
                        </View>

                        {/* Навигация по шагам + Финал */}
                        {wideDesktop ? (
                            <View style={styles.stepsGrid}>
                                {allSteps.map((s, i) => {
                                    const isActive = i === currentIndex && !showFinaleOnly;
                                    const isDone = !!answers[s.id] && s.id !== 'intro';
                                    const isUnlocked = (i <= unlockedIndex) || !!answers[s.id] || allCompleted;
                                    return (
                                        <Pressable key={s.id} onPress={() => { if (isUnlocked) goToStep(i); }}
                                                   style={[styles.stepPill, styles.stepPillUnlocked, isActive && styles.stepPillActive, isDone && styles.stepPillDone, !isUnlocked && styles.stepPillLocked]}
                                                   hitSlop={6}>
                                            <Text style={[styles.stepPillIndex, (isActive || isDone) && { color: colors.textOnPrimary }]}>{s.id === 'intro' ? '' : i}</Text>
                                            <Text style={[styles.stepPillTitle, (isActive || isDone) && { color: colors.textOnPrimary }]} numberOfLines={1}>
                                                {s.id === 'intro' ? 'Старт' : s.title}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                                <FinalePill active={showFinaleOnly} />
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepsNavigation} contentContainerStyle={{ paddingRight: 8, paddingLeft: 2 }}>
                                {allSteps.map((s, i) => {
                                    const isActive = i === currentIndex && !showFinaleOnly;
                                    const isUnlocked = (i <= unlockedIndex) || !!answers[s.id] || allCompleted;
                                    const isDone = !!answers[s.id] && s.id !== 'intro';

                                    if (screenW < 600) {
                                        return (
                                            <Pressable key={s.id} onPress={() => { if (isUnlocked) goToStep(i); }}
                                                       style={[styles.stepDotMini, isUnlocked && styles.stepDotMiniUnlocked, isActive && styles.stepDotMiniActive, isDone && styles.stepDotMiniDone, !isUnlocked && styles.stepDotMiniLocked]}
                                                       hitSlop={6}>
                                                <Text style={[styles.stepDotMiniText, (isActive || isDone) && { color: colors.textOnPrimary }]}>{s.id === 'intro' ? '0' : i}</Text>
                                            </Pressable>
                                        );
                                    }

                                    return (
                                        <Pressable key={s.id} onPress={() => { if (isUnlocked) goToStep(i); }}
                                                   style={[styles.stepPill, styles.stepPillUnlocked, styles.stepPillNarrow, isActive && styles.stepPillActive, isDone && styles.stepPillDone, !isUnlocked && styles.stepPillLocked]}
                                                   hitSlop={6}>
                                            <Text style={[styles.stepPillIndex, (isActive || isDone) && { color: colors.textOnPrimary }]}>{s.id === 'intro' ? '' : i}</Text>
                                            <Text style={[styles.stepPillTitle, (isActive || isDone) && { color: colors.textOnPrimary }]} numberOfLines={1}>
                                                {s.id === 'intro' ? 'Старт' : s.title}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                                {compactNav ? <FinaleDot active={showFinaleOnly} /> : <FinalePill active={showFinaleOnly} />}
                            </ScrollView>
                        )}
                        {compactNav ? (
                            <Text style={styles.navActiveTitle} numberOfLines={1}>
                                {showFinaleOnly ? 'Финал' : (currentIndex === 0 ? 'Старт' : allSteps[currentIndex]?.title)}
                            </Text>
                        ) : (
                            <Text style={styles.navHint}>Нажмите на шаг (или «Финал»), чтобы перейти</Text>
                        )}
                    </View>

                    {/* Контент */}
                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={Keyboard.dismiss}
                        contentContainerStyle={{ paddingBottom: SPACING.xl + 96 }}
                    >
                        {/* Шаги/карты — скрываем, если показываем только финал */}
                        {(!showFinaleOnly) && currentStep && (
                            <>
                                <StepCard
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
                                />

                                {!!steps.length && (
                                    <View style={styles.fullMapSection}>
                                        <Text style={styles.sectionTitle}>Полный маршрут квеста</Text>
                                        <Suspense fallback={<QuestMapSkeleton />}>
                                            <QuestFullMap
                                                steps={steps}
                                                height={300}
                                                title={`Карта квеста: ${title}`}
                                            />
                                        </Suspense>
                                    </View>
                                )}

                                {city && <View style={{ height: SPACING.xl - 4 }} />}
                                {city && (
                                    <Suspense fallback={null}>
                                        <BelkrajWidgetLazy
                                            points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
                                            countryCode={city.countryCode ?? 'BY'}
                                            collapsedHeight={520}
                                            expandedHeight={1200}
                                            className="belkraj-slot"
                                        />
                                    </Suspense>
                                )}
                            </>
                        )}

                        {/* Финал — доступен всегда; видео — когда всё пройдено */}
                        {showFinaleOnly && (
                            <View style={styles.completionScreen}>
                                {allCompleted ? (
                                    <>
                                        <Text style={styles.completionTitle}>Квест завершен!</Text>

                                        {/* Видео: web = DOM <video>, native = expo-av */}
                                        {finale.video && (
                                            <View style={[styles.videoFrame, { width: frameW, height: frameH }]}>
                                                {Platform.OS === 'web' ? (
                                                    videoOk ? (
                                                        <WebVideo src={videoUri} poster={posterUri} />
                                                    ) : (
                                                        <>
                                                            {posterUri ? <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" /> : null}
                                                            {videoUri && (
                                                                <Pressable onPress={() => Linking.openURL(videoUri)} style={styles.openExternBtn} hitSlop={8}>
                                                                    <Text style={styles.openExternText}>Открыть видео</Text>
                                                                </Pressable>
                                                            )}
                                                        </>
                                                    )
                                                ) : (
                                                    <Suspense fallback={null}>
                                                        <NativeVideoLazy
                                                            source={typeof finale.video === 'string' ? { uri: finale.video } : finale.video}
                                                            posterSource={typeof finale.poster === 'string' ? { uri: finale.poster } : finale.poster}
                                                            usePoster={!!finale.poster}
                                                            style={StyleSheet.absoluteFill}
                                                            useNativeControls
                                                            shouldPlay={false}
                                                            isLooping={false}
                                                            onError={() => setVideoOk(false)}
                                                        />
                                                    </Suspense>
                                                )}
                                            </View>
                                        )}

                                        <Text style={styles.completionText}>{finale.text}</Text>
                                    </>
                                ) : (
                                    <Text style={[styles.completionText, { opacity: 0.8 }]}>
                                        Чтобы открыть приз/видео — завершите все шаги ({completedSteps.length} из {steps.length}).
                                    </Text>
                                )}
                            </View>
                        )}

                        <View style={{ height: SPACING.xl }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

// ===================== СТИЛИ =====================
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
        backgroundColor: colors.surface,
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 },
    resetButton: { padding: SPACING.xs },
    resetText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
    toggleText: { color: colors.primaryDark, fontWeight: '600', fontSize: 14 },

    progressContainer: { marginBottom: SPACING.sm },
    progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.xs },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    progressText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

    stepsNavigation: { flexDirection: 'row', marginTop: 6 },
    stepsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },

    stepPill: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 999,
        paddingVertical: 6, paddingHorizontal: 10, // ✅ УЛУЧШЕНИЕ: Убрана граница
        backgroundColor: colors.surface, maxWidth: 260, marginRight: 6, marginBottom: 6,
        shadowColor: colors.shadows.light.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    stepPillNarrow: { maxWidth: 140, paddingHorizontal: 8, paddingVertical: 6 },
    stepPillUnlocked: { backgroundColor: colors.surface },
    stepPillActive: { backgroundColor: colors.primary }, // ✅ УЛУЧШЕНИЕ: Убрана граница
    stepPillDone: { backgroundColor: colors.primary }, // ✅ УЛУЧШЕНИЕ: Убрана граница
    stepPillLocked: { opacity: 0.5 },
    stepPillIndex: { fontSize: 12, fontWeight: '700', color: colors.primary, marginRight: 6 },
    stepPillTitle: { fontSize: 12, fontWeight: '600', color: colors.text },

    stepDotMini: {
        width: 32, height: 32, borderRadius: 16, marginRight: 6,
        alignItems: 'center', justifyContent: 'center',
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
        backgroundColor: colors.surface,
        shadowColor: colors.shadows.light.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    stepDotMiniUnlocked: { opacity: 1 },
    stepDotMiniActive: { backgroundColor: colors.primary }, // ✅ УЛУЧШЕНИЕ: Убрана граница
    stepDotMiniDone: { backgroundColor: colors.primary }, // ✅ УЛУЧШЕНИЕ: Убрана граница
    stepDotMiniLocked: { opacity: 0.45 },
    stepDotMiniText: { fontSize: 12, fontWeight: '700', color: colors.primary },

    navActiveTitle: { marginTop: 6, fontSize: 12, fontWeight: '600', color: colors.text, opacity: 0.9 },
    navHint: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },

    content: { flex: 1, padding: SPACING.md },

    card: {
        backgroundColor: colors.surface, borderRadius: 12, padding: SPACING.lg, marginBottom: SPACING.md,
        shadowColor: colors.shadows.medium.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 1,
        backfaceVisibility: 'hidden',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    stepNumber: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center',
        marginRight: SPACING.md
    },
    stepNumberCompleted: { backgroundColor: colors.successSoft },
    stepNumberText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    headerContent: { flex: 1 },
    stepTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 2 },
    location: { fontSize: 14, color: colors.primary, fontWeight: '500' },
    completedBadge: { backgroundColor: colors.success, borderRadius: 12, padding: 4, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    completedText: { color: colors.textOnPrimary, fontWeight: 'bold', fontSize: 12 },

    section: { marginBottom: SPACING.lg },
    sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
    storyText: { fontSize: 14, lineHeight: 20, color: colors.text },

    taskText: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: SPACING.md, lineHeight: 22 },
    input: { 
        backgroundColor: colors.surface, 
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        borderRadius: DESIGN_TOKENS.radii.sm, 
        padding: SPACING.md, 
        fontSize: 16, 
        marginBottom: SPACING.sm,
        color: colors.text,
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        shadowColor: colors.shadows.light.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
        ...Platform.select({
            web: {
                transition: 'box-shadow 0.2s ease',
                boxShadow: '0 1px 3px rgba(31, 31, 31, 0.04)',
            },
        }),
    },
    inputError: { 
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон и тень
        backgroundColor: 'rgba(239, 68, 68, 0.05)', // ✅ ИСПРАВЛЕНИЕ: Светло-красный фон для ошибок
        ...Platform.select({
            web: {
                boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.3), 0 1px 3px rgba(31, 31, 31, 0.04)',
            },
        }),
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        marginBottom: SPACING.md,
        padding: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)', // ✅ ИСПРАВЛЕНИЕ: Светло-красный фон
        borderRadius: 6,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    },
    errorText: { 
        color: colors.danger, 
        fontSize: 13, // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для читаемости
        fontWeight: '500', // ✅ ИСПРАВЛЕНИЕ: Добавлен font-weight
        flex: 1,
    },

    actions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.sm, gap: 8 },
    primaryButton: { 
        backgroundColor: colors.primary, 
        paddingHorizontal: SPACING.lg, 
        paddingVertical: 12, 
        borderRadius: DESIGN_TOKENS.radii.md, 
        flex: 1, 
        minWidth: '45%',
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        justifyContent: 'center',
        alignItems: 'center',
        ...globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        ...Platform.select({
            web: {
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.primaryDark,
                    transform: 'translateY(-1px)',
                },
                ':active': {
                    transform: 'translateY(0)',
                },
            },
        }),
    },
    buttonText: { color: colors.textOnPrimary, fontWeight: '600', textAlign: 'center', fontSize: 14 },
    secondaryButton: { 
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        paddingHorizontal: SPACING.lg, 
        paddingVertical: 12, 
        borderRadius: DESIGN_TOKENS.radii.md, 
        backgroundColor: colors.surface, 
        flex: 1, 
        minWidth: '45%',
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.shadows.light.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        ...globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        ...Platform.select({
            web: {
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                boxShadow: colors.boxShadows.light,
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.primarySoft,
                },
            },
        }),
    },
    secondaryButtonText: { color: colors.text, fontWeight: '600', textAlign: 'center', fontSize: 14 },
    ghostButton: { 
        paddingHorizontal: SPACING.lg, 
        paddingVertical: 12, 
        borderRadius: DESIGN_TOKENS.radii.md, 
        flex: 1, 
        minWidth: '45%',
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        justifyContent: 'center',
        alignItems: 'center',
        ...globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        ...Platform.select({
            web: {
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.primarySoft,
                },
            },
        }),
    },
    ghostButtonText: { color: colors.textMuted, fontWeight: '600', textAlign: 'center', fontSize: 14 },

    hintPrompt: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.xs },
    hintContainer: { backgroundColor: colors.successSoft, padding: SPACING.md, borderRadius: 8, marginTop: SPACING.md },
    hintText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    answerContainer: { backgroundColor: colors.successSoft, padding: SPACING.md, borderRadius: 8, marginTop: SPACING.md },
    answerLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    answerValue: { fontSize: 16, fontWeight: '600', color: colors.text },

    mapActions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.md },
    mapButton: { backgroundColor: colors.surface, // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, minWidth: 110, marginRight: 6, marginBottom: 6,
        shadowColor: colors.shadows.light.shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
    mapButtonText: { color: colors.text, fontSize: 12, fontWeight: '500', textAlign: 'center' },

    mapPhotoButton: { // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
        backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999,
        shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    mapPhotoButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: '700', textAlign: 'center' },

    photoHint: { fontSize: 12, color: colors.textSecondary, marginBottom: SPACING.xs },

    imagePreview: { height: 120, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    previewImage: { width: '100%', height: '100%' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay, padding: 6, alignItems: 'center' },
    overlayText: { color: colors.textOnDark, fontSize: 12, fontWeight: '500' },

    startButton: { backgroundColor: colors.primary, padding: SPACING.lg, borderRadius: 10, alignItems: 'center' },
    startButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '700' },

    fullMapSection: { backgroundColor: colors.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md },

    completionScreen: { backgroundColor: colors.surface, borderRadius: 12, padding: SPACING.lg, alignItems: 'center', marginTop: SPACING.md },
    completionTitle: { fontSize: 20, fontWeight: '700', color: colors.success, marginBottom: SPACING.md, textAlign: 'center' },
    completionText: { paddingTop: 5, fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.lg },

    // Видео рамка (адаптив 16:9)
    videoFrame: {
        alignSelf: 'center',
        backgroundColor: colors.backgroundTertiary,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        position: 'relative',
    },
    openExternBtn: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: colors.overlay,
        borderRadius: 8,
    },
    openExternText: { color: colors.textOnDark, fontWeight: '700', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' },
    gestureContainer: { flex: 1, width: '100%' },
    animatedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    zoomedImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
    closeButton: { position: 'absolute', top: 50, right: 20, backgroundColor: colors.overlay, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    closeButtonText: { color: colors.textOnDark, fontSize: 18, fontWeight: 'bold' },
    zoomHintContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
    zoomHint: { color: colors.textOnDark, fontSize: 14, backgroundColor: colors.overlay, padding: 8, borderRadius: 6 },

    // flip badge
    flipBadge: {
        paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
        backgroundColor: colors.success,
        shadowColor: colors.shadows.heavy.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 6,
    },
    flipText: { color: colors.textOnDark, fontWeight: '800', fontSize: 16 },
});

const QuestMapSkeleton = () => {
    const colors = useThemedColors();
    return (
        <View style={{ height: 300, borderRadius: 16, backgroundColor: colors.backgroundSecondary, overflow: 'hidden' }}>
            <View style={{ flex: 1, opacity: 0.6, backgroundColor: colors.borderLight }} />
        </View>
    );
};

export default QuestWizard;
