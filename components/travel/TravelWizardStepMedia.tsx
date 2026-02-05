import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, Text, ScrollView, findNodeHandle, UIManager } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import YoutubeLinkComponent from '@/components/YoutubeLinkComponent';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import { ValidationSummary } from '@/components/travel/ValidationFeedback';
import { validateStep } from '@/utils/travelWizardValidation';
import { TravelFormData, Travel } from '@/src/types/types';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ConfirmDialog from '@/components/ConfirmDialog';
import { deleteTravelMainImage } from '@/src/api/misc';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

const GallerySectionLazy = Platform.OS === 'web'
    ? React.lazy(() => import('@/components/travel/GallerySection'))
    : null;

// Native (and other platforms) should keep direct rendering for stability.
 
const GallerySectionNative = Platform.OS !== 'web' ? require('@/components/travel/GallerySection').default : null;

interface TravelWizardStepMediaProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
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
    onStepSelect?: (step: number) => void;
    onPreview?: () => void;
    onOpenPublic?: () => void;
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
    onStepSelect,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const [isDeleteCoverDialogVisible, setIsDeleteCoverDialogVisible] = useState(false);
    const [coverDeleted, setCoverDeleted] = useState(false);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);

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

    const handleYoutubeChange = useCallback((value: string) => {
        setFormData(prev => ({ ...(prev as any), youtube_link: value }));
    }, [setFormData]);

    const handleRequestDeleteCover = useCallback(() => {
        if (!formData.id) return;
        setIsDeleteCoverDialogVisible(true);
    }, [formData.id]);

    const handleConfirmDeleteCover = useCallback(async () => {
        if (!formData.id) return;
        try {
            await deleteTravelMainImage(formData.id);

            // Clear cover urls to update preview immediately.
            setCoverDeleted(true);
            setFormData(prev => ({
                ...(prev as any),
                travel_image_thumb_small_url: null,
                travel_image_thumb_url: null,
            }));
        } finally {
            setIsDeleteCoverDialogVisible(false);
        }
    }, [formData.id, setFormData]);

    const coverResetKey = useMemo(() => {
        const url = (formData as any).travel_image_thumb_small_url;
        return url && typeof url === 'string' && url.trim().length > 0 ? `cover:${url}` : 'cover:none';
    }, [formData]);

    const coverSmallUrl = (formData as any).travel_image_thumb_small_url;
    const coverFullUrl = (formData as any).travel_image_thumb_url;

    const handleCoverUpload = useCallback(
        (url: string | null) => {
            // При успешной загрузке или локальном превью обновляем форму,
            // чтобы шаг 6 сразу видел обложку без перезагрузки.
            if (url && typeof url === 'string' && url.trim().length > 0) {
                setCoverDeleted(false);
            }
            setFormData(prev => ({
                ...(prev as any),
                travel_image_thumb_small_url: url || null,
                travel_image_thumb_url: url || null,
            }));
        },
        [setFormData],
    );

    useEffect(() => {
        const hasCover =
            (typeof coverSmallUrl === 'string' && coverSmallUrl.trim().length > 0) ||
            (typeof coverFullUrl === 'string' && coverFullUrl.trim().length > 0);
        if (hasCover) {
            setCoverDeleted(false);
        }
    }, [coverSmallUrl, coverFullUrl]);

    const handleGalleryChange = useCallback(
        (urls: string[]) => {
            // Синхронизируем галерею с формой, чтобы шаг 6 сразу видел фото.
            // Guard: avoid endless update loops when the gallery URLs haven't changed.
            setFormData(prev => {
                const prevGalleryRaw = (prev as any)?.gallery;
                const prevGallery = Array.isArray(prevGalleryRaw) ? prevGalleryRaw : [];
                const nextGallery = Array.isArray(urls) ? urls : [];
                if (prevGallery.length === nextGallery.length && prevGallery.every((v: any, i: number) => v === nextGallery[i])) {
                    return prev;
                }
                return {
                    ...(prev as any),
                    gallery: nextGallery,
                };
            });
        },
        [setFormData],
    );

    // Валидация шага 3
    const validation = useMemo(() => {
        return validateStep(3, formData);
    }, [formData]);

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
                    warningCount={validation.warnings.length}
                    autosaveBadge={autosaveBadge}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? 'К деталям'}
                    onSave={onManualSave}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                />

                {!isMobile && validation.warnings.length > 0 && (
                    <View style={styles.validationSummaryWrapper}>
                        <ValidationSummary
                            errorCount={validation.errors.length}
                            warningCount={validation.warnings.length}
                        />
                    </View>
                )}

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

                            {/* ✅ УЛУЧШЕНИЕ: Рекомендации по загрузке обложки */}
                            <View style={styles.tipsCard}>
                                <View style={styles.tipIconWrapper}>
                                    <Feather name="info" size={18} color={colors.primary} />
                                </View>
                                <View style={styles.tipContent}>
                                    <Text style={styles.tipTitle}>Совет по обложке</Text>
                                    <Text style={styles.tipBody}>
                                        • Лучший формат: горизонтальный 16:9 (минимум 1200×675px){'\n'}
                                        • Избегайте коллажей и текста на изображении{'\n'}
                                        • Используйте качественные фотографии с хорошим освещением
                                    </Text>
                                    <Text style={styles.tipStats}>
                                        Путешествия с обложкой получают в 3 раза больше просмотров
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.coverWrapper}>
                                <PhotoUploadWithPreview
                                    key={coverResetKey}
                                    collection="travelMainImage"
                                    idTravel={formData.id ?? null}
                                    oldImage={
                                        coverDeleted
                                            ? null
                                            :
                                        // ✅ FIX: Приоритет: formData URL > travelDataOld URL
                                        // Проверяем оба поля (thumb_small и thumb) для надежности
                                        ((formData as any).travel_image_thumb_small_url && (formData as any).travel_image_thumb_small_url.trim().length > 0)
                                            ? (formData as any).travel_image_thumb_small_url
                                            : ((formData as any).travel_image_thumb_url && (formData as any).travel_image_thumb_url.trim().length > 0)
                                                ? (formData as any).travel_image_thumb_url
                                                : ((travelDataOld as any)?.travel_image_thumb_small_url && (travelDataOld as any)?.travel_image_thumb_small_url.trim().length > 0)
                                                    ? (travelDataOld as any)?.travel_image_thumb_small_url
                                                    : (travelDataOld as any)?.travel_image_thumb_url ?? null
                                    }
                                    onUpload={handleCoverUpload}
                                    onPreviewChange={handleCoverUpload}
                                    onRequestRemove={handleRequestDeleteCover}
                                    placeholder="Перетащите обложку путешествия"
                                    maxSizeMB={10}
                                />
                                {!formData.id && (
                                    <Text style={styles.infoText}>
                                        Превью будет сохранено. После сохранения черновика фото загрузится на сервер.
                                    </Text>
                                )}
                            </View>
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
                                    <GallerySectionLazy
                                        images={formData.gallery}
                                        travelId={formData.id}
                                        onChange={handleGalleryChange}
                                        isLoading={false}
                                    />
                                </Suspense>
                            ) : GallerySectionNative ? (
                                <GallerySectionNative
                                    images={formData.gallery}
                                    travelId={formData.id}
                                    onChange={handleGalleryChange}
                                    isLoading={false}
                                />
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

                <ConfirmDialog
                    visible={isDeleteCoverDialogVisible}
                    onClose={() => setIsDeleteCoverDialogVisible(false)}
                    onConfirm={handleConfirmDeleteCover}
                    title="Удалить обложку"
                    message="Вы уверены, что хотите удалить главное изображение путешествия?"
                    confirmText="Удалить"
                    cancelText="Отмена"
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    keyboardAvoid: {
        flex: 1
    },
    validationSummaryWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
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
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    lazyFallback: {
        marginTop: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lazyFallbackText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 8,
    },
    coverWrapper: {
        marginTop: 8,
        alignItems: 'center',
    },
    deleteCoverButton: {
        marginTop: 10,
        alignSelf: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    deleteCoverButtonPressed: {
        opacity: 0.85,
    },
    deleteCoverButtonDisabled: {
        opacity: 0.6,
    },
    deleteCoverButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.danger,
        fontWeight: '600',
    },
    infoText: {
        marginTop: 8,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
    },
    // ✅ УЛУЧШЕНИЕ: Стили для карточки с советами
    tipsCard: {
        flexDirection: 'row',
        marginBottom: DESIGN_TOKENS.spacing.md,
        padding: DESIGN_TOKENS.spacing.md,
        backgroundColor: colors.primarySoft,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.primary + '20',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    tipIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tipContent: {
        flex: 1,
    },
    tipTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    tipBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.text,
        lineHeight: 18,
        marginBottom: 6,
    },
    tipStats: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.primary,
        fontWeight: '600',
    },
});

export default React.memo(TravelWizardStepMedia);
