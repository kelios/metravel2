import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, Text, ScrollView, findNodeHandle, UIManager, LayoutChangeEvent } from 'react-native';

import YoutubeLinkComponent from '@/components/YoutubeLinkComponent';
import ImageUploadComponent from '@/components/imageUpload/ImageUploadComponent';
import { TravelFormData, Travel } from '@/src/types/types';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const GallerySectionLazy = Platform.OS === 'web'
    ? React.lazy(() => import('@/components/travel/GallerySection'))
    : null;

// Native (and other platforms) should keep direct rendering for stability.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GallerySectionNative = Platform.OS !== 'web' ? require('@/components/travel/GallerySection').default : null;

interface TravelWizardStepMediaProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    travelDataOld: Travel | null;
    onManualSave: () => Promise<TravelFormData | void>;
    onBack: () => void;
    onNext: () => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
}

const TravelWizardStepMedia: React.FC<TravelWizardStepMediaProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    travelDataOld,
    onManualSave,
    onBack,
    onNext,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
}) => {
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const [footerHeight, setFooterHeight] = useState(0);

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setFooterHeight(prev => (prev === next ? prev : next));
    }, []);

    const contentPaddingBottom = useMemo(() => {
        return footerHeight > 0 ? footerHeight + 16 : 180;
    }, [footerHeight]);

    const scrollRef = useRef<ScrollView | null>(null);
    const coverAnchorRef = useRef<View | null>(null);

    useEffect(() => {
        if (!focusAnchorId) return;
        if (focusAnchorId !== 'travelwizard-media-cover') return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = coverAnchorRef.current;
        if (!scrollNode || !anchorNode) {
            onAnchorHandled?.();
            return;
        }

        const scrollHandle = findNodeHandle(scrollNode);
        const anchorHandle = findNodeHandle(anchorNode);
        if (!scrollHandle || !anchorHandle) {
            onAnchorHandled?.();
            return;
        }

        setTimeout(() => {
            UIManager.measureLayout(
                anchorHandle,
                scrollHandle,
                () => onAnchorHandled?.(),
                (_x, y) => {
                    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
                    onAnchorHandled?.();
                },
            );
        }, 50);
    }, [focusAnchorId, onAnchorHandled]);

    const handleYoutubeChange = (value: string) => {
        setFormData({ ...formData, youtube_link: value });
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onBack}
                    title={stepMeta?.title ?? 'Медиа путешествия'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    autosaveBadge={autosaveBadge}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                />

                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                        <View ref={coverAnchorRef} style={styles.section} nativeID="travelwizard-media-cover">
                            <Text style={styles.sectionTitle}>Главное изображение</Text>
                            <Text style={styles.sectionHint}>
                                Обложка маршрута, которая будет показываться в списках и на странице путешествия.
                            </Text>
                            {formData.id ? (
                                <View style={styles.coverWrapper}>
                                    <ImageUploadComponent
                                        collection="travelMainImage"
                                        idTravel={formData.id}
                                        oldImage={
                                            (formData as any).travel_image_thumb_small_url?.length
                                                ? (formData as any).travel_image_thumb_small_url
                                                : (travelDataOld as any)?.travel_image_thumb_small_url ?? null
                                        }
                                    />
                                </View>
                            ) : (
                                <Text style={styles.infoText}>
                                    Чтобы добавить обложку, сначала сохраните черновик (кнопка «Сохранить» внизу).
                                </Text>
                            )}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Галерея путешествия</Text>
                            <Text style={styles.sectionHint}>
                                Фотографии повышают доверие и помогают читателям лучше понять маршрут. Рекомендуем добавить 3–10 снимков.
                            </Text>
                            {Platform.OS === 'web' && GallerySectionLazy ? (
                                <Suspense
                                    fallback={
                                        <View style={styles.lazyFallback}>
                                            <Text style={styles.lazyFallbackText}>Загрузка галереи…</Text>
                                        </View>
                                    }
                                >
                                    <GallerySectionLazy formData={formData} travelDataOld={travelDataOld} />
                                </Suspense>
                            ) : GallerySectionNative ? (
                                <GallerySectionNative formData={formData} travelDataOld={travelDataOld} />
                            ) : null}
                        </View>

                        <View style={styles.section}>
                            <YoutubeLinkComponent
                                label="Видео о путешествии (YouTube-ссылка)"
                                value={formData.youtube_link ?? ''}
                                onChange={handleYoutubeChange}
                                hint="Вставьте ссылку на ролик на YouTube, например: https://www.youtube.com/watch?v=..."
                            />
                        </View>
                    </View>
                </ScrollView>

                <TravelWizardFooter
                    canGoBack={false}
                    onPrimary={onNext}
                    onSave={onManualSave}
                    primaryLabel="К деталям"
                    onLayout={handleFooterLayout}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
    keyboardAvoid: { flex: 1 },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 8,
        paddingBottom: 0,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    section: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    lazyFallback: {
        marginTop: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lazyFallbackText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        marginBottom: 8,
    },
    coverWrapper: {
        marginTop: 8,
        alignItems: 'center',
    },
    infoText: {
        marginTop: 8,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
    },
});

export default React.memo(TravelWizardStepMedia);
