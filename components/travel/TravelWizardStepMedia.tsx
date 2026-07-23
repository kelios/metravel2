import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    UIManager,
    View,
    findNodeHandle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteTravelMainImage } from '@/api/misc';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import YoutubeLinkComponent from '@/components/ui/YoutubeLinkComponent';
import type { GalleryValueItem } from '@/components/travel/gallery/types';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import { CollapsibleValidationSummary, ValidationSummary } from '@/components/travel/ValidationFeedback';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import type { Travel, TravelFormData } from '@/types/types';
import { showToastMessage } from '@/utils/toast';
import { validateStep } from '@/utils/travelWizardValidation';
import { WIZARD_KEYBOARD_BEHAVIOR } from '@/components/travel/upsert/wizardKeyboard';
import WizardStepFooter from '@/components/travel/upsert/WizardStepFooter';
import { translate as i18nT } from '@/i18n'


const MEDIA_COVER_ANCHOR_ID = 'travelwizard-media-cover';
const getCoverAdviceItems = () => [
    i18nT('travel:components.travel.TravelWizardStepMedia.coverAdvice.format'),
    i18nT('travel:components.travel.TravelWizardStepMedia.coverAdvice.noCollage'),
    i18nT('travel:components.travel.TravelWizardStepMedia.coverAdvice.quality'),
];

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
    isSaveInFlight?: boolean;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    onStepSelect?: (step: number) => void;
    onPreview?: () => void;
    onOpenPublic?: () => void;
}

type GalleryValueForForm = Array<{ url: string; id?: string | number }>;
type MediaStyles = ReturnType<typeof createStyles>;
type GallerySectionComponent = React.ComponentType<{
    images: TravelFormData['gallery'];
    travelId?: string | number | null;
    onChange?: (items: GalleryValueItem[]) => void;
    isLoading?: boolean;
}>;

const GallerySectionLazy: React.LazyExoticComponent<GallerySectionComponent> | null =
    Platform.OS === 'web' ? React.lazy(() => import('@/components/travel/GallerySection')) : null;
const GallerySectionNative: GallerySectionComponent | null =
    Platform.OS !== 'web' ? require('@/components/travel/GallerySection').default : null;

const hasUrl = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const normalizeUrl = (value: unknown) => (hasUrl(value) ? value.trim() : null);

const getFirstUrl = (...values: unknown[]) => {
    for (const value of values) {
        const url = normalizeUrl(value);
        if (url) return url;
    }
    return null;
};

const getProgressPercent = (progress: number) => {
    const safeProgress = Number.isFinite(progress) ? progress : 0;
    const boundedProgress = Math.min(Math.max(safeProgress, 0), 1);
    return Math.round(boundedProgress * 100);
};

const getCoverResetKey = (resetToken: number) => `cover:${resetToken}`;

const getGallerySignature = (items: unknown) => {
    if (!Array.isArray(items)) return '';

    return items
        .map((item) => {
            if (typeof item === 'string') return `:${item}`;
            if (item && typeof item === 'object') {
                const galleryItem = item as { id?: unknown; url?: unknown; caption?: unknown };
                const id = galleryItem.id != null ? String(galleryItem.id) : '';
                const url = typeof galleryItem.url === 'string' ? galleryItem.url : '';
                const caption = typeof galleryItem.caption === 'string' ? galleryItem.caption : '';
                return `${id}:${url}:${caption}`;
            }
            return '';
        })
        .join('|');
};

const normalizeGalleryItems = (items: GalleryValueItem[]): GalleryValueForForm => {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            const url = normalizeUrl(item?.url);
            if (!url) return null;

            const normalizedItem: { url: string; id?: string | number; caption?: string } = { url };
            if (item.id != null && String(item.id).trim().length > 0) {
                normalizedItem.id = item.id;
            }
            if (typeof item.caption === 'string') {
                normalizedItem.caption = item.caption.slice(0, 500);
            }
            return normalizedItem;
        })
        .filter(Boolean) as GalleryValueForForm;
};

function useMediaAnchorScroll(focusAnchorId?: string | null, onAnchorHandled?: () => void) {
    const scrollRef = useRef<ScrollView | null>(null);
    const coverAnchorRef = useRef<View | null>(null);

    useEffect(() => {
        if (focusAnchorId !== MEDIA_COVER_ANCHOR_ID) return;

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

        const timerId = setTimeout(() => {
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

        return () => clearTimeout(timerId);
    }, [focusAnchorId, onAnchorHandled]);

    return { scrollRef, coverAnchorRef };
}

function useCoverDeletion(travelId: string | null | undefined, setFormData: TravelWizardStepMediaProps['setFormData']) {
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isCoverDeleted, setCoverDeleted] = useState(false);
    const [coverResetToken, setCoverResetToken] = useState(0);
    const hardDeletedRef = useRef(false);
    const isDeletingRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const clearCoverUrls = useCallback(() => {
        setFormData((prev) => ({
            ...prev,
            travel_image_thumb_small_url: null,
            travel_image_thumb_url: null,
        }));
    }, [setFormData]);

    const requestDeleteCover = useCallback(() => {
        if (!travelId) {
            hardDeletedRef.current = true;
            setCoverDeleted(true);
            setCoverResetToken((prev) => prev + 1);
            clearCoverUrls();
            return;
        }
        setDeleteDialogOpen(true);
    }, [clearCoverUrls, travelId]);

    const closeDeleteDialog = useCallback(() => {
        setDeleteDialogOpen(false);
    }, []);

    const markCoverAvailable = useCallback(() => {
        hardDeletedRef.current = false;
        setCoverDeleted(false);
    }, []);

    const syncCoverAvailability = useCallback(() => {
        if (hardDeletedRef.current) return;
        setCoverDeleted(false);
    }, []);

    const confirmDeleteCover = useCallback(async () => {
        if (!travelId) {
            closeDeleteDialog();
            return;
        }

        if (isDeletingRef.current) return;
        isDeletingRef.current = true;

        try {
            await deleteTravelMainImage(travelId);
            hardDeletedRef.current = true;
            if (mountedRef.current) {
                setCoverDeleted(true);
                setCoverResetToken((prev) => prev + 1);
                clearCoverUrls();
            }
        } catch {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.TravelWizardStepMedia.ne_udalos_udalit_oblozhku_5506754e'),
                text2: i18nT('travel:components.travel.TravelWizardStepMedia.proverte_soedinenie_i_poprobuyte_esche_raz_900a3e83'),
            });
        } finally {
            isDeletingRef.current = false;
            if (mountedRef.current) {
                closeDeleteDialog();
            }
        }
    }, [clearCoverUrls, closeDeleteDialog, travelId]);

    return {
        isCoverDeleted,
        isDeleteDialogOpen,
        coverResetToken,
        requestDeleteCover,
        closeDeleteDialog,
        confirmDeleteCover,
        markCoverAvailable,
        syncCoverAvailability,
    };
}

interface MediaValidationSummaryProps {
    isMobile: boolean;
    styles: MediaStyles;
    errorMessages: string[];
    warningMessages: string[];
}

const MediaValidationSummary = React.memo(function MediaValidationSummary({
    isMobile,
    styles,
    errorMessages,
    warningMessages,
}: MediaValidationSummaryProps) {
    if (errorMessages.length === 0 && warningMessages.length === 0) return null;

    return (
        <View style={styles.validationSummaryWrapper}>
            {isMobile ? (
                <CollapsibleValidationSummary
                    errorCount={errorMessages.length}
                    warningCount={warningMessages.length}
                    errorMessages={errorMessages}
                    warningMessages={warningMessages}
                />
            ) : (
                <ValidationSummary
                    errorCount={errorMessages.length}
                    warningCount={warningMessages.length}
                    errorMessages={errorMessages}
                    warningMessages={warningMessages}
                />
            )}
        </View>
    );
});

interface CoverAdviceCardProps {
    styles: MediaStyles;
    primaryColor: string;
}

const CoverAdviceCard = React.memo(function CoverAdviceCard({ styles, primaryColor }: CoverAdviceCardProps) {
    return (
        <View style={styles.tipsCard}>
            <View style={styles.tipIconWrapper}>
                <Feather name="info" size={18} color={primaryColor} />
            </View>
            <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{i18nT('travel:components.travel.TravelWizardStepMedia.sovet_po_oblozhke_f3c29ca4')}</Text>
                <View style={styles.tipList} {...(Platform.OS === 'web' ? ({ role: 'list' } as any) : {})}>
                    {getCoverAdviceItems().map((item) => (
                        <Text
                            key={item}
                            style={styles.tipBody}
                            {...(Platform.OS === 'web' ? ({ role: 'listitem' } as any) : {})}
                        >
                            {`• ${item}`}
                        </Text>
                    ))}
                </View>
                <Text style={styles.tipStats}>{i18nT('travel:components.travel.TravelWizardStepMedia.puteshestviya_s_oblozhkoy_poluchayut_v_3_raz_adb656d4')}</Text>
            </View>
        </View>
    );
});

interface CoverSectionProps {
    styles: MediaStyles;
    anchorRef: React.RefObject<View | null>;
    coverResetKey: string;
    coverUrl: string | null;
    onCoverChange: (url: string | null) => void;
    onRequestDeleteCover?: () => void;
    primaryColor: string;
    showDraftHint: boolean;
    travelId: string | null;
}

const CoverSection = React.memo(function CoverSection({
    styles,
    anchorRef,
    coverResetKey,
    coverUrl,
    onCoverChange,
    onRequestDeleteCover,
    primaryColor,
    showDraftHint,
    travelId,
}: CoverSectionProps) {
    return (
        <View ref={anchorRef} style={styles.section} nativeID={MEDIA_COVER_ANCHOR_ID}>
            <Text style={styles.sectionTitle}>{i18nT('travel:components.travel.TravelWizardStepMedia.glavnoe_izobrazhenie_ad4b6cfb')}</Text>
            <Text style={styles.sectionHint}>
                {i18nT('travel:components.travel.TravelWizardStepMedia.oblozhka_marshruta_kotoraya_budet_pokazyvats_c7c655e3')}</Text>

            <CoverAdviceCard styles={styles} primaryColor={primaryColor} />

            <View style={styles.coverWrapper}>
                <PhotoUploadWithPreview
                    key={coverResetKey}
                    collection="travelMainImage"
                    idTravel={travelId}
                    oldImage={coverUrl}
                    onUpload={onCoverChange}
                    onPreviewChange={onCoverChange}
                    onRequestRemove={onRequestDeleteCover}
                    placeholder={i18nT('travel:components.travel.TravelWizardStepMedia.peretaschite_oblozhku_puteshestviya_83cdbe65')}
                    maxSizeMB={10}
                />
                {showDraftHint && (
                    <Text style={styles.infoText}>
                        {i18nT('travel:components.travel.TravelWizardStepMedia.prevyu_budet_sohraneno_posle_sohraneniya_che_e84e022d')}</Text>
                )}
            </View>
        </View>
    );
});

interface GalleryMediaSectionProps {
    styles: MediaStyles;
    gallery: TravelFormData['gallery'];
    travelId: string | null;
    onGalleryChange: (items: GalleryValueItem[]) => void;
}

const GalleryMediaSection = React.memo(function GalleryMediaSection({
    styles,
    gallery,
    travelId,
    onGalleryChange,
}: GalleryMediaSectionProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{i18nT('travel:components.travel.TravelWizardStepMedia.galereya_puteshestviya_0e6981ba')}</Text>
            <Text style={styles.sectionHint}>
                {i18nT('travel:components.travel.TravelWizardStepMedia.fotografii_povyshayut_doverie_i_pomogayut_ch_bc746649')}</Text>
            {Platform.OS === 'web' && GallerySectionLazy ? (
                <Suspense
                    fallback={
                        <View style={styles.lazyFallback}>
                            <Text style={styles.lazyFallbackText}>{i18nT('travel:components.travel.TravelWizardStepMedia.zagruzka_galerei_2f46ef0d')}</Text>
                        </View>
                    }
                >
                    <GallerySectionLazy images={gallery} travelId={travelId} onChange={onGalleryChange} isLoading={false} />
                </Suspense>
            ) : GallerySectionNative ? (
                <GallerySectionNative images={gallery} travelId={travelId} onChange={onGalleryChange} isLoading={false} />
            ) : null}
        </View>
    );
});

interface VideoSectionProps {
    styles: MediaStyles;
    value: string;
    onChange: (value: string) => void;
}

const VideoSection = React.memo(function VideoSection({ styles, value, onChange }: VideoSectionProps) {
    return (
        <View style={styles.section}>
            <YoutubeLinkComponent
                label={i18nT('travel:components.travel.TravelWizardStepMedia.video_o_puteshestvii_youtube_ssylka_75ad25b1')}
                value={value}
                onChange={onChange}
                hint={i18nT('travel:components.travel.TravelWizardStepMedia.vstavte_ssylku_na_rolik_na_youtube_naprimer__9b6841ff')}
            />
        </View>
    );
});

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
    isSaveInFlight,
    focusAnchorId,
    onAnchorHandled,
    onStepSelect,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors();
    const insets = useSafeAreaInsets();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile]);
    // На native нижний таб-бар (BottomDock) — фиксированный оверлей высотой
    // tabBarHeight + safe-area-inset-bottom, поэтому к статическому отступу
    // добавляем реальный inset, иначе CTA «Загрузить фото» уходит под док.
    const contentBottomPadding = useMemo(
        () => (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl + (Platform.OS === 'web' ? 0 : insets.bottom),
        [insets.bottom],
    );
    const { scrollRef, coverAnchorRef } = useMediaAnchorScroll(focusAnchorId, onAnchorHandled);

    const travelId = formData.id ?? null;
    const coverSmallUrl = formData.travel_image_thumb_small_url ?? null;
    const coverFullUrl = formData.travel_image_thumb_url ?? null;
    const oldCoverSmallUrl = travelDataOld?.travel_image_thumb_small_url ?? null;
    const oldCoverFullUrl = travelDataOld?.travel_image_thumb_url ?? null;
    const gallery = formData.gallery ?? [];
    const youtubeLink = formData.youtube_link ?? '';

    const {
        isCoverDeleted,
        isDeleteDialogOpen,
        coverResetToken,
        requestDeleteCover,
        closeDeleteDialog,
        confirmDeleteCover,
        markCoverAvailable,
        syncCoverAvailability,
    } = useCoverDeletion(travelId, setFormData);

    useEffect(() => {
        if (hasUrl(coverSmallUrl) || hasUrl(coverFullUrl)) {
            syncCoverAvailability();
        }
    }, [coverFullUrl, coverSmallUrl, syncCoverAvailability]);

    const coverUrl = useMemo(
        () => (isCoverDeleted ? null : getFirstUrl(coverSmallUrl, coverFullUrl, oldCoverSmallUrl, oldCoverFullUrl)),
        [coverFullUrl, coverSmallUrl, isCoverDeleted, oldCoverFullUrl, oldCoverSmallUrl],
    );

    const coverResetKey = useMemo(() => getCoverResetKey(coverResetToken), [coverResetToken]);

    const handleCoverChange = useCallback(
        (url: string | null) => {
            const nextUrl = normalizeUrl(url);
            if (nextUrl) {
                markCoverAvailable();
            }

            setFormData((prev) => ({
                ...prev,
                travel_image_thumb_small_url: nextUrl,
                travel_image_thumb_url: nextUrl,
            }));
        },
        [markCoverAvailable, setFormData],
    );

    const handleYoutubeChange = useCallback(
        (value: string) => {
            setFormData((prev) => ({ ...prev, youtube_link: value }));
        },
        [setFormData],
    );

    const handleGalleryChange = useCallback(
        (items: GalleryValueItem[]) => {
            const nextGallery = normalizeGalleryItems(items);
            const nextSignature = getGallerySignature(nextGallery);

            setFormData((prev) => {
                if (getGallerySignature(prev.gallery) === nextSignature) {
                    return prev;
                }

                return {
                    ...prev,
                    gallery: nextGallery as TravelFormData['gallery'],
                };
            });
        },
        [setFormData],
    );

    const validation = useMemo(() => validateStep(3, formData), [formData]);
    const validationMessages = useMemo(
        () => ({
            errors: validation.errors.map((error) => error.message),
            warnings: validation.warnings.map((warning) => warning.message),
        }),
        [validation.errors, validation.warnings],
    );

    return (
        <SafeAreaView style={styles.safeContainer} edges={['left', 'right', 'bottom']}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={WIZARD_KEYBOARD_BEHAVIOR}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack
                    onBack={onBack}
                    title={stepMeta?.title ?? i18nT('travel:components.travel.TravelWizardStepMedia.defaultTitle')}
                    subtitle={stepMeta?.subtitle ?? i18nT('travel:common.stepProgress', { value1: currentStep, value2: totalSteps })}
                    progressPercent={getProgressPercent(progress)}
                    errorCount={validation.errors.length}
                    warningCount={validation.warnings.length}
                    autosaveBadge={autosaveBadge}
                    isSaveInFlight={isSaveInFlight}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? i18nT('travel:components.travel.TravelWizardStepMedia.defaultNext')}
                    onSave={onManualSave}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                />

                <MediaValidationSummary
                    isMobile={isMobile}
                    styles={styles}
                    errorMessages={validationMessages.errors}
                    warningMessages={validationMessages.warnings}
                />

                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentBottomPadding }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                        <CoverSection
                            styles={styles}
                            anchorRef={coverAnchorRef}
                            coverResetKey={coverResetKey}
                            coverUrl={coverUrl}
                            onCoverChange={handleCoverChange}
                            onRequestDeleteCover={travelId ? requestDeleteCover : undefined}
                            primaryColor={colors.primary}
                            showDraftHint={!travelId}
                            travelId={travelId}
                        />

                        <GalleryMediaSection
                            styles={styles}
                            gallery={gallery}
                            travelId={travelId}
                            onGalleryChange={handleGalleryChange}
                        />

                        <VideoSection styles={styles} value={youtubeLink} onChange={handleYoutubeChange} />
                    </View>
                </ScrollView>
                <WizardStepFooter
                    onBack={onBack}
                    onPrimary={onNext}
                    primaryLabel={stepMeta?.nextLabel ?? i18nT('travel:components.travel.TravelWizardStepMedia.defaultNext')}
                />

                <ConfirmDialog
                    visible={isDeleteDialogOpen}
                    onClose={closeDeleteDialog}
                    onConfirm={confirmDeleteCover}
                    title={i18nT('travel:components.travel.TravelWizardStepMedia.udalit_oblozhku_a2bdb3d5')}
                    message={i18nT('travel:components.travel.TravelWizardStepMedia.vy_uvereny_chto_hotite_udalit_glavnoe_izobra_4d548581')}
                    confirmText={i18nT('travel:components.travel.TravelWizardStepMedia.udalit_71f38991')}
                    cancelText={i18nT('travel:components.travel.TravelWizardStepMedia.otmena_bd4b67b1')}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile = false) => StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardAvoid: {
        flex: 1,
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
        // paddingBottom задаётся динамически (tabBarHeight + safe-area-inset-bottom)
        // через contentBottomPadding в contentContainerStyle ScrollView.
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    section: {
        marginTop: isMobile ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.lg,
        padding: isMobile ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
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
    infoText: {
        marginTop: 8,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
    },
    tipsCard: {
        flexDirection: 'row',
        marginBottom: DESIGN_TOKENS.spacing.md,
        padding: DESIGN_TOKENS.spacing.md,
        backgroundColor: colors.primarySoft,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.primaryAlpha30,
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
    },
    tipList: {
        marginBottom: 6,
    },
    tipStats: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.primaryText,
        fontWeight: '600',
    },
});

export default React.memo(TravelWizardStepMedia);
