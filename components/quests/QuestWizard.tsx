// components/quests/QuestWizard.tsx
import React, {
    memo,
    useCallback,
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
    Modal, Image, Keyboard
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';

import { generatePrintableQuest } from './QuestPrintable';
import { DESIGN_TOKENS as _DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { openExternalUrl } from '@/utils/externalLinks';
import { safeGetYoutubeId } from '@/utils/travelDetailsSecure';

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
                    // @ts-ignore -- playsInline is a web-only video attribute not in expo-av Video types
                    playsInline
                />
            );
        }),
    }))
);

// Stable module-level web video component — must NOT be defined inside render
const WebVideo = memo(function WebVideo({ src, poster, onError }: { src?: string; poster?: string; onError: () => void }) {
    useEffect(() => {
        if (src) {
            console.info('[WebVideo] Rendering video with src:', src);
        }
    }, [src]);
    
    // @ts-ignore -- React Native Web allows direct DOM element creation via React.createElement
    return React.createElement('video', {
        src,
        poster,
        controls: true,
        playsInline: true,
        preload: 'metadata',
        // @ts-ignore -- inline style object for web video element, not a RN StyleSheet type
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' },
        onError: (e: any) => {
            console.error('[WebVideo] Video error:', e?.target?.error);
            onError();
        },
        onLoadStart: () => console.info('[WebVideo] Video load started'),
        onLoadedMetadata: () => console.info('[WebVideo] Video metadata loaded'),
        onCanPlay: () => console.info('[WebVideo] Video can play'),
    });
});

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
    // @ts-ignore -- Image.resolveAssetSource is a RN internal API not in public type declarations
    const u = Image.resolveAssetSource?.(src)?.uri;
    return u;
};
// ===================== ЗУМ КАРТИНОК =====================
const ImageZoomModal = ({ image, visible, onClose }: { image: any; visible: boolean; onClose: () => void; }) => {
    const { styles } = useQuestWizardTheme();
    const scale = useRef(new Animated.Value(1)).current;
    const shouldUseNativeDriver = false;
    // @ts-ignore -- Animated.event nativeEvent type narrowing requires explicit cast for pinch gesture
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
                <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Закрыть просмотр фото"><Text style={styles.closeButtonText}>✕</Text></Pressable>
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
    const [navExpanded, setNavExpanded] = useState(false);
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const shouldUseNativeDriver = false;

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
            try {
                const opened = await openExternalUrl(url, {
                    allowedProtocols: ['http:', 'https:', 'geo:', 'om:', 'organicmaps:', 'mapsme:'],
                });
                if (opened) return;
            } catch {
                /* ignore failed link open */
            }
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
                {step.id !== 'intro' && (
                    <View style={[styles.stepNumber, isPassed && styles.stepNumberCompleted]}>
                        <Text style={styles.stepNumberText}>{index}</Text>
                    </View>
                )}
                <View style={styles.headerContent}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Pressable onPress={() => openInMap(Platform.OS === 'ios' ? 'apple' : 'google')} accessibilityRole="button" accessibilityLabel={`Открыть в картах: ${step.location}`}>
                        <Text style={styles.location}>{step.location}</Text>
                    </Pressable>
                </View>
                {isPassed && (<View style={styles.completedBadge}><Text style={styles.completedText}>✓</Text></View>)}
            </View>

            {/* Легенда */}
            <View style={styles.section}><Text style={styles.storyText}>{step.story}</Text></View>

            {/* Задание */}
            <View style={styles.section}>
                <Text style={styles.taskText}>{step.task}</Text>

                {step.id !== 'intro' && !isPassed && (
                    ((step.answer as any)._isAny === true || /\(\)\s*=>\s*true/.test(step.answer.toString()))
                        ? (
                            <Pressable style={styles.primaryButton} onPress={() => onSubmit('ok')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Далее">
                                <Text style={styles.buttonText}>Далее</Text>
                            </Pressable>
                        ) : (
                            <>
                                <View style={styles.inputRow}>
                                    <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: shakeAnim }] }]}>
                                        <TextInput
                                            style={[
                                                styles.input, 
                                                error ? styles.inputError : null,
                                                globalFocusStyles.focusable,
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
                                    <Pressable 
                                        style={styles.checkButton} 
                                        onPress={handleCheck} 
                                        hitSlop={6}
                                        accessibilityRole="button"
                                        accessibilityLabel="Проверить ответ"
                                    >
                                        <Text style={styles.checkButtonText}>→</Text>
                                    </Pressable>
                                </View>
                                {!!error && (
                                    <View style={styles.errorContainer}>
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                )}
                                <View style={styles.inlineActions}>
                                    {step.hint && (
                                        <Pressable 
                                            onPress={onToggleHint} 
                                            hitSlop={8}
                                            accessibilityRole="button"
                                            accessibilityLabel={hintVisible ? 'Скрыть подсказку' : 'Показать подсказку'}
                                        >
                                            <Text style={styles.linkText}>{hintVisible ? 'Скрыть подсказку' : 'Подсказка'}</Text>
                                        </Pressable>
                                    )}
                                    {step.hint && (<Text style={styles.linkSeparator}>·</Text>)}
                                    <Pressable 
                                        onPress={onSkip} 
                                        hitSlop={8}
                                        accessibilityRole="button"
                                        accessibilityLabel="Пропустить шаг"
                                    >
                                        <Text style={styles.linkText}>Пропустить</Text>
                                    </Pressable>
                                </View>
                                {step.hint && attempts < showHintAfter && !hintVisible && (
                                    <Text style={styles.hintPrompt}>Подсказка доступна после {showHintAfter - attempts} попыток</Text>
                                )}
                            </>
                        )
                )}

                {step.hint && (
                    <View style={[styles.hintContainer, !hintVisible && Platform.select({ web: { visibility: 'hidden' } as any, default: { display: 'none' } })]}>
                        <Text style={styles.hintText}>Подсказка: {step.hint}</Text>
                    </View>
                )}

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
                    <View style={styles.navRow}>
                        <Pressable style={styles.navButton} onPress={() => openInMap(Platform.OS === 'ios' ? 'apple' : 'google')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Открыть навигацию">
                            <Text style={styles.navButtonText}>Навигация</Text>
                        </Pressable>
                        <Pressable style={styles.navToggle} onPress={() => setNavExpanded(v => !v)} hitSlop={6} accessibilityRole="button" accessibilityLabel={navExpanded ? 'Скрыть варианты навигации' : 'Показать варианты навигации'}>
                            <Text style={styles.navToggleText}>{navExpanded ? '▲' : '▼'}</Text>
                        </Pressable>
                        <Pressable style={styles.coordsButton} onPress={copyCoords} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Копировать координаты ${step.lat.toFixed(4)}, ${step.lng.toFixed(4)}`}>
                            <Text style={styles.coordsButtonText}>{step.lat.toFixed(4)}, {step.lng.toFixed(4)}</Text>
                        </Pressable>
                        {step.image && (
                            <Pressable style={styles.photoToggle} onPress={onToggleMap} hitSlop={8} accessibilityRole="button" accessibilityLabel={showMap ? 'Скрыть фото' : 'Показать фото'}>
                                <Text style={styles.photoToggleText}>{showMap ? 'Скрыть фото' : 'Фото'}</Text>
                            </Pressable>
                        )}
                    </View>
                    {navExpanded && (
                        <View style={styles.navDropdown}>
                            <Pressable style={styles.navOption} onPress={() => { openInMap('google'); setNavExpanded(false); }}><Text style={styles.navOptionText}>Google Maps</Text></Pressable>
                            {Platform.OS === 'ios' && (<Pressable style={styles.navOption} onPress={() => { openInMap('apple'); setNavExpanded(false); }}><Text style={styles.navOptionText}>Apple Maps</Text></Pressable>)}
                            <Pressable style={styles.navOption} onPress={() => { openInMap('yandex'); setNavExpanded(false); }}><Text style={styles.navOptionText}>Yandex Maps</Text></Pressable>
                            {hasOrganic && (<Pressable style={styles.navOption} onPress={() => { openInMap('organic'); setNavExpanded(false); }}><Text style={styles.navOptionText}>Organic Maps</Text></Pressable>)}
                            {hasMapsme && (<Pressable style={styles.navOption} onPress={() => { openInMap('mapsme'); setNavExpanded(false); }}><Text style={styles.navOptionText}>MAPS.ME</Text></Pressable>)}
                        </View>
                    )}

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
export function QuestWizard({ title, steps, finale, intro, storageKey = 'quest_progress', city, onProgressChange, onProgressReset, initialProgress, onFinaleVideoRetry }: QuestWizardProps) {
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

    // Загрузка прогресса: приоритет — initialProgress (бэкенд), fallback — AsyncStorage
    useEffect(() => {
        const loadProgress = async () => {
            try {
                suppressSave.current = true;
                if (initialProgress) {
                    setCurrentIndex(initialProgress.currentIndex ?? 0);
                    setUnlockedIndex(initialProgress.unlockedIndex ?? 0);
                    setAnswers(initialProgress.answers ?? {});
                    setAttempts(initialProgress.attempts ?? {});
                    setHints(initialProgress.hints ?? {});
                    setShowMap(initialProgress.showMap !== undefined ? initialProgress.showMap : true);
                    // Синхронизируем бэкенд-прогресс в AsyncStorage для офлайн-доступа
                    await AsyncStorage.setItem(storageKey, JSON.stringify({
                        index: initialProgress.currentIndex ?? 0,
                        unlocked: initialProgress.unlockedIndex ?? 0,
                        answers: initialProgress.answers ?? {},
                        attempts: initialProgress.attempts ?? {},
                        hints: initialProgress.hints ?? {},
                        showMap: initialProgress.showMap !== undefined ? initialProgress.showMap : true,
                    })).catch(() => {});
                } else {
                    const saved = await AsyncStorage.getItem(storageKey);
                    if (saved) {
                        // ✅ FIX-010: Используем безопасный парсинг JSON
                        const { safeJsonParseString } = require('@/utils/safeJsonParse');
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
                }
            } catch (e) {
                // ✅ FIX-007: Используем централизованный logger
                const { devError } = require('@/utils/logger');
                devError('Error loading quest progress:', e);
            } finally {
                setTimeout(() => { suppressSave.current = false; }, 0);
            }
        };
        loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey]);

    // Сохранение прогресса (локально + бэкенд)
    useEffect(() => {
        if (suppressSave.current) return;
        AsyncStorage.setItem(storageKey, JSON.stringify({
            index: currentIndex, unlocked: unlockedIndex, answers, attempts, hints, showMap
        })).catch(e => console.error('Error saving progress:', e));
        // Синхронизация с бэкендом
        const completed = steps.length > 0 && steps.every(s => !!answers[s.id]);
        onProgressChange?.({
            currentIndex, unlockedIndex: unlockedIndex, answers, attempts, hints, showMap, completed,
        });
    }, [currentIndex, unlockedIndex, answers, attempts, hints, showMap, storageKey, onProgressChange, steps]);

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
    const videoUri = useMemo(() => {
        const uri = resolveUri(finale.video);
        if (finale.video) {
            console.info('[QuestWizard] Video source:', finale.video);
            console.info('[QuestWizard] Resolved video URI:', uri);
        }
        return uri;
    }, [finale.video]);
    const posterUri = useMemo(() => resolveUri(finale.poster), [finale.poster]);
    const youtubeEmbedUri = useMemo(() => {
        if (!videoUri) {
            console.info('[QuestWizard] No video URI for YouTube check');
            return undefined;
        }
        const youtubeId = safeGetYoutubeId(videoUri);
        if (youtubeId) {
            console.info('[QuestWizard] YouTube ID detected:', youtubeId);
        } else {
            console.info('[QuestWizard] Not a YouTube URL:', videoUri);
        }
        if (!youtubeId) return undefined;
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    }, [videoUri]);
    const handleVideoError = useMemo(() => () => {
        console.error('[QuestWizard] Video playback error');
        setVideoOk(false);
    }, []);
    const handleVideoRetry = useCallback(() => {
        console.info('[QuestWizard] Retrying video playback');
        if (Platform.OS === 'web') {
            onFinaleVideoRetry?.();
        }
        setVideoOk(true);
    }, [onFinaleVideoRetry]);
    useEffect(() => { 
        console.info('[QuestWizard] Video changed, resetting videoOk state');
        setVideoOk(true); 
    }, [finale.video]);

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
                        contentContainerStyle={[{ paddingBottom: SPACING.xl + 96 }, wideDesktop && styles.contentInner]}
                    >
                        <View style={wideDesktop && city && Platform.OS === 'web' ? styles.pageRow : undefined}>
                            {/* Левая колонка: шаги + карта + финал */}
                            <View style={wideDesktop && city && Platform.OS === 'web' ? styles.pageMain : undefined}>
                                {/* Шаги/карты — скрываем, если показываем только финал */}
                                {(!showFinaleOnly) && currentStep && (
                                    <View style={wideDesktop ? styles.desktopRow : undefined}>
                                        <View style={wideDesktop ? styles.desktopMain : undefined}>
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

                                            {Platform.OS === 'web' && (
                                                <View style={styles.printSection}>
                                                    <Text style={styles.printHint}>
                                                        Скачайте подарочную печатную версию: маршрут, задания и место для ответов.
                                                    </Text>
                                                    <Pressable
                                                        style={styles.printButton}
                                                        onPress={() => {
                                                            const questUrl = typeof window !== 'undefined'
                                                                ? window.location.href.replace(/^http:\/\/localhost:\d+/, 'https://metravel.by')
                                                                : undefined;
                                                            generatePrintableQuest({ title, steps, intro, questUrl });
                                                        }}
                                                        hitSlop={6}
                                                    >
                                                        <Text style={styles.printButtonText}>Скачать печатную версию</Text>
                                                    </Pressable>
                                                </View>
                                            )}
                                        </View>

                                        {!!steps.length && (
                                            <View style={[styles.fullMapSection, wideDesktop && styles.desktopSide]}>
                                                <Suspense fallback={<QuestMapSkeleton />}>
                                                    <QuestFullMap
                                                        steps={steps}
                                                        height={wideDesktop ? 520 : 360}
                                                        title={`Карта квеста: ${title}`}
                                                    />
                                                </Suspense>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Экскурсии рядом — на узких экранах под контентом */}
                                {!wideDesktop && (!showFinaleOnly) && currentStep && city && Platform.OS === 'web' && (
                                    <View style={styles.excursionsSection}>
                                        <View style={styles.excursionsDivider} />
                                        <View style={styles.excursionsCard}>
                                            <View style={styles.excursionsHeader}>
                                                <Text style={styles.excursionsTitle}>Экскурсии рядом</Text>
                                                <Text style={styles.excursionsSubtitle}>Откройте больше с местными гидами</Text>
                                            </View>
                                            <Suspense fallback={null}>
                                                <BelkrajWidgetLazy
                                                    points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
                                                    countryCode={city.countryCode}
                                                    collapsedHeight={compactNav ? 520 : 760}
                                                    expandedHeight={compactNav ? 600 : 900}
                                                    className="belkraj-slot"
                                                />
                                            </Suspense>
                                        </View>
                                    </View>
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
                                                    youtubeEmbedUri ? (
                                                        <iframe
                                                            src={youtubeEmbedUri}
                                                            width="100%"
                                                            height="100%"
                                                            style={{ border: 'none', display: 'block' }}
                                                            loading="lazy"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                            allowFullScreen
                                                            title="Видео квеста"
                                                        />
                                                    ) : videoOk ? (
                                                        <WebVideo src={videoUri} poster={posterUri} onError={handleVideoError} />
                                                    ) : (
                                                        <>
                                                            {posterUri ? <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" /> : null}
                                                            <View style={styles.videoFallbackOverlay}>
                                                                <Text style={styles.videoFallbackText}>Не удалось воспроизвести видео. Попробуйте ещё раз.</Text>
                                                                <Pressable onPress={handleVideoRetry} style={styles.videoRetryBtn} hitSlop={8}>
                                                                    <Text style={styles.videoRetryText}>Повторить</Text>
                                                                </Pressable>
                                                            </View>
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
                            </View>

                            {/* Правая колонка: блок экскурсий — постоянно видим на desktop */}
                            {wideDesktop && city && Platform.OS === 'web' && (
                                <View style={styles.excursionsSidebar}>
                                    <View style={styles.excursionsSidebarInner}>
                                        <Text style={styles.excursionsTitle}>Экскурсии рядом</Text>
                                        <Text style={styles.excursionsSubtitle}>Откройте больше с местными гидами</Text>
                                        <View style={styles.excursionsSidebarWidget}>
                                            <Suspense fallback={null}>
                                                <BelkrajWidgetLazy
                                                    points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
                                                    countryCode={city.countryCode}
                                                    collapsedHeight={560}
                                                    expandedHeight={900}
                                                    className="belkraj-slot"
                                                />
                                            </Suspense>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

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
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
        ...Platform.select({ web: { maxWidth: 1140, width: '100%', alignSelf: 'center' } }),
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.md,
        gap: SPACING.sm,
    },
    title: { fontSize: 22, fontWeight: '800', color: colors.text, flex: 1, letterSpacing: -0.5, lineHeight: 28 },
    resetButton: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
    },
    resetText: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
    toggleText: { color: colors.primaryDark, fontWeight: '600', fontSize: 14 },

    progressContainer: { marginBottom: SPACING.sm },
    progressBar: {
        height: 4,
        backgroundColor: colors.borderLight,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
    progressText: { fontSize: 11, color: colors.textMuted, textAlign: 'right', fontWeight: '600' },

    stepsNavigation: { flexDirection: 'row', marginTop: SPACING.sm },
    stepsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.sm, gap: 6 },

    stepPill: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 999,
        paddingVertical: 5, paddingHorizontal: 10,
        backgroundColor: colors.backgroundSecondary,
        maxWidth: 220, marginRight: 6, marginBottom: 6,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    stepPillNarrow: { maxWidth: 130, paddingHorizontal: 8 },
    stepPillUnlocked: { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight },
    stepPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    stepPillDone: { backgroundColor: colors.successSoft, borderColor: colors.successLight },
    stepPillLocked: { opacity: 0.4 },
    stepPillIndex: { fontSize: 11, fontWeight: '700', color: colors.primaryText, marginRight: 5 },
    stepPillTitle: { fontSize: 11, fontWeight: '600', color: colors.text },

    stepDotMini: {
        width: 30, height: 30, borderRadius: 15, marginRight: 5,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    stepDotMiniUnlocked: { opacity: 1 },
    stepDotMiniActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    stepDotMiniDone: { backgroundColor: colors.successSoft, borderColor: colors.successLight },
    stepDotMiniLocked: { opacity: 0.4 },
    stepDotMiniText: { fontSize: 11, fontWeight: '700', color: colors.primaryText },

    navActiveTitle: { marginTop: 5, fontSize: 12, fontWeight: '700', color: colors.text },
    navHint: { fontSize: 11, color: colors.textMuted, marginTop: 5 },

    content: { flex: 1, padding: SPACING.md },
    contentInner: { maxWidth: 1100, alignSelf: 'center', width: '100%' },
    desktopRow: { flexDirection: 'row', gap: SPACING.md },
    desktopMain: { flex: 1, minWidth: 0 },
    desktopSide: { width: 420, flexShrink: 0 },

    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...Platform.select({
            web: { boxShadow: colors.boxShadows.card } as any,
            android: { elevation: 2 },
            ios: {
                shadowColor: colors.shadows.light.shadowColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            },
        }),
        backfaceVisibility: 'hidden',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md, gap: SPACING.sm },
    stepNumber: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: colors.primarySoft,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
    },
    stepNumberCompleted: { backgroundColor: colors.successSoft },
    stepNumberText: { fontSize: 15, fontWeight: '800', color: colors.primaryText },
    headerContent: { flex: 1 },
    stepTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 3, letterSpacing: -0.3, lineHeight: 22 },
    location: {
        fontSize: 13, color: colors.primaryText, fontWeight: '600',
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    completedBadge: {
        backgroundColor: colors.successSoft,
        borderRadius: 8,
        width: 28, height: 28,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
    },
    completedText: { color: colors.success, fontWeight: '800', fontSize: 14 },

    section: { marginBottom: SPACING.md },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
    storyText: { fontSize: 15, lineHeight: 22, color: colors.text },

    taskText: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: SPACING.md, lineHeight: 23, letterSpacing: -0.2 },
    input: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        paddingHorizontal: SPACING.md,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: SPACING.sm,
        color: colors.text,
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...Platform.select({
            web: {
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                outlineStyle: 'none',
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
        backgroundColor: colors.primary,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 13,
        borderRadius: 12,
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
        ...globalFocusStyles.focusable,
        ...Platform.select({
            web: { transition: 'opacity 0.15s ease', cursor: 'pointer' } as any,
        }),
    },
    buttonText: { color: colors.textOnPrimary, fontWeight: '700', textAlign: 'center', fontSize: 15 },

    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm },
    checkButton: {
        backgroundColor: colors.primary,
        width: 48, height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        ...Platform.select({ web: { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any }),
    },
    checkButtonText: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '700' },

    inlineActions: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 12, marginTop: 10, marginBottom: 4,
    },
    linkText: {
        color: colors.textMuted, fontSize: 13, fontWeight: '500',
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    linkSeparator: { color: colors.borderStrong, fontSize: 13 },

    hintPrompt: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xs },
    hintContainer: {
        backgroundColor: colors.successSoft,
        padding: SPACING.md,
        borderRadius: 12,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: colors.successLight,
    },
    hintText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    answerContainer: {
        backgroundColor: colors.successSoft,
        padding: SPACING.md,
        borderRadius: 12,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: colors.successLight,
    },
    answerLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    answerValue: { fontSize: 15, fontWeight: '700', color: colors.text },

    navRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    },
    navButton: {
        backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10,
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

    imagePreview: { borderRadius: 12, overflow: 'hidden', position: 'relative', maxWidth: 480 },
    previewImage: { width: '100%', aspectRatio: 4 / 3, resizeMode: 'contain' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay, padding: 8, alignItems: 'center' },
    overlayText: { color: colors.textOnDark, fontSize: 12, fontWeight: '600' },

    startButton: {
        backgroundColor: colors.primary,
        padding: SPACING.lg,
        borderRadius: 14,
        alignItems: 'center',
        minHeight: 52,
        justifyContent: 'center',
    },
    startButtonText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

    printSection: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 14, padding: SPACING.md,
        marginBottom: SPACING.md, alignItems: 'center',
        borderWidth: 1, borderColor: colors.borderLight,
    },
    printHint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19, marginBottom: SPACING.sm },
    printButton: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: 999, borderWidth: 1, borderColor: colors.border,
        ...Platform.select({ web: { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any }),
    },
    printButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },

    fullMapSection: {
        backgroundColor: colors.surface,
        borderRadius: 14, padding: SPACING.md, marginBottom: SPACING.md,
        borderWidth: 1, borderColor: colors.borderLight,
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
        width: 340,
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
        borderRadius: 14,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...Platform.select({
            web: { boxShadow: colors.boxShadows.light } as any,
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
        borderRadius: 14,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...Platform.select({
            web: { boxShadow: colors.boxShadows.light } as any,
            default: colors.shadows.light,
        }),
    },
    excursionsTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 2,
        letterSpacing: -0.3,
    },
    excursionsSubtitle: {
        fontSize: 12,
        color: colors.textMuted,
    },

    completionScreen: {
        backgroundColor: colors.surface,
        borderRadius: 16, padding: SPACING.lg,
        alignItems: 'center', marginTop: SPACING.md,
        borderWidth: 1, borderColor: colors.borderLight,
        ...Platform.select({ web: { boxShadow: colors.boxShadows.card } as any }),
    },
    completionTitle: {
        fontSize: 22, fontWeight: '800', color: colors.success,
        marginBottom: SPACING.sm, textAlign: 'center', letterSpacing: -0.5,
    },
    completionText: {
        paddingTop: 4, fontSize: 16, color: colors.text,
        textAlign: 'center', lineHeight: 23, marginBottom: SPACING.lg,
    },

    videoFrame: {
        alignSelf: 'center',
        backgroundColor: '#000',
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
    closeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    zoomHintContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
    zoomHint: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.55)', padding: 10, borderRadius: 8 },

    flipBadge: {
        paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
        backgroundColor: colors.success,
        ...Platform.select({
            web: { boxShadow: '0 8px 24px rgba(34,197,94,0.35)' } as any,
            ios: { shadowColor: '#22c55e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
            android: { elevation: 8 },
        }),
    },
    flipText: { color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: -0.3 },
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
