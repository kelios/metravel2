import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Share,
    ScrollView,
    View,
    Text,
    TextInput,
    StyleSheet,
    findNodeHandle,
    UIManager,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/ui/paper';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { publishTravelToInstagram } from '@/api/instagramPublish';
import { sendMessage } from '@/api/messages';
import { devError } from '@/utils/logger';
import { hapticNotification } from '@/utils/haptics';
import { QualityIndicator } from '@/components/travel/ValidationFeedback';
import { TravelFormData } from '@/types/types';
import Button from '@/components/ui/Button';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { getModerationIssues, type ModerationIssue } from '@/utils/formValidation';
import { trackWizardEvent } from '@/utils/analytics';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';
import { useTravelPublishChecklist } from '@/components/travel/useTravelPublishChecklist';
import PublishChecklistCard from '@/components/travel/PublishChecklistCard';
import {
    buildFinalInstagramText,
    buildInstagramPublicationDraft,
    clampInstagramCaption,
    getInstagramAccountOptions,
    INSTAGRAM_CAPTION_MAX_LENGTH,
    INSTAGRAM_HASHTAG_MAX_COUNT,
    parseInstagramHashtags,
} from '@/utils/instagramPublish';

async function showToastMessage(payload: any) {
    await showToast(payload);
}

const hasToastBeenShown = (error: unknown): boolean =>
    error instanceof Error && (error as Error & { toastShown?: boolean }).toastShown === true;

interface TravelWizardStepPublishProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    countries?: Array<{
        country_id: string;
        title_ru: string;
        title_en?: string;
        title?: string;
        name?: string;
    }>;
    // ✅ FIX: Унифицированная сигнатура setFormData для совместимости с другими шагами
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>> | ((data: TravelFormData) => void);
    isSuperAdmin: boolean;
    onManualSave: (data?: TravelFormData) => Promise<TravelFormData | void>;
    onGoBack: () => void;
    onFinish: () => void;
    onNavigateToIssue?: (issue: ModerationIssue) => void;
    onStepSelect?: (step: number) => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    onPreview?: () => void;
    onOpenPublic?: () => void;
}

const TravelWizardStepPublish: React.FC<TravelWizardStepPublishProps> = ({
    currentStep,
    totalSteps,
    formData,
    countries = [],
    setFormData,
    isSuperAdmin,
    onManualSave,
    onGoBack,
    onFinish: _onFinish,
    onNavigateToIssue,
    onStepSelect,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors();
    const router = useRouter();
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const actionPendingRef = useRef(false);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const startAction = useCallback(() => {
        if (actionPendingRef.current) return false;
        actionPendingRef.current = true;
        return true;
    }, []);

    const finishAction = useCallback(() => {
        actionPendingRef.current = false;
    }, []);
    const [status, setStatus] = useState<'draft' | 'moderation'>(
        formData.moderation || formData.publish ? 'moderation' : 'draft',
    );

    // ✅ FIX: Синхронизация status с formData при изменении (например, при редактировании)
    useEffect(() => {
        const newStatus = formData.moderation || formData.publish ? 'moderation' : 'draft';
        setStatus(newStatus);
    }, [formData.moderation, formData.publish]);

    const currentBackendStatus = useMemo(() => {
        if (formData.moderation) return { label: 'Опубликовано', tone: 'success' } as const;
        if (formData.publish) return { label: 'Отправлено на модерацию', tone: 'warning' } as const;
        return { label: 'Черновик', tone: 'muted' } as const;
    }, [formData.moderation, formData.publish]);

    const isUser = !isSuperAdmin;
    const pendingModeration = formData.publish && !formData.moderation;
    const userPendingModeration = isUser && pendingModeration;

    const {
        routePoints,
        galleryItems,
        requiredChecklist,
        recommendedChecklist,
        checklist,
        moderationIssuesByKey,
        qualityScore,
    } = useTravelPublishChecklist(formData);

    const [missingForModeration, setMissingForModeration] = useState<ModerationIssue[]>([]);
    const [rejectionComment, setRejectionComment] = useState('');
    const [selectedInstagramAccount, setSelectedInstagramAccount] = useState('');
    const [editableInstagramCaption, setEditableInstagramCaption] = useState('');
    const [editableInstagramHashtags, setEditableInstagramHashtags] = useState('');
    const [editableInstagramImages, setEditableInstagramImages] = useState<string[]>([]);
    const [draggedInstagramImageIndex, setDraggedInstagramImageIndex] = useState<number | null>(null);
    const isNew = !formData.id;

    const scrollRef = useRef<ScrollView | null>(null);
    const missingBannerAnchorRef = useRef<View | null>(null);
    const buttonErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [primaryOverrideLabel, setPrimaryOverrideLabel] = useState<string | null>(null);

    const contentPaddingBottom = useMemo(() => DESIGN_TOKENS.spacing.xl, []);
    const instagramAccountOptions = useMemo(
        () => getInstagramAccountOptions(process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS),
        []
    );
    const instagramDraft = useMemo(
        () => buildInstagramPublicationDraft({ formData, countries }),
        [countries, formData]
    );
    const instagramDraftHashtagsText = useMemo(
        () => instagramDraft.hashtags.join(' '),
        [instagramDraft.hashtags]
    );
    const instagramDraftImagesKey = useMemo(
        () => instagramDraft.imageUrls.join('|'),
        [instagramDraft.imageUrls]
    );
    const parsedInstagramHashtags = useMemo(
        () => parseInstagramHashtags(editableInstagramHashtags),
        [editableInstagramHashtags]
    );
    const finalInstagramText = useMemo(
        () => buildFinalInstagramText(editableInstagramCaption, parsedInstagramHashtags),
        [editableInstagramCaption, parsedInstagramHashtags]
    );
    const instagramCaptionLength = editableInstagramCaption.length;
    const instagramHashtagCount = parsedInstagramHashtags.length;
    const instagramFinalLength = finalInstagramText.length;
    const isInstagramCaptionTooLong = instagramFinalLength > INSTAGRAM_CAPTION_MAX_LENGTH;
    const isInstagramHashtagCountTooHigh = instagramHashtagCount > INSTAGRAM_HASHTAG_MAX_COUNT;
    const canPublishToInstagram =
        isSuperAdmin &&
        !!formData.id &&
        editableInstagramImages.length > 0 &&
        !isInstagramCaptionTooLong &&
        !isInstagramHashtagCountTooHigh;

    useEffect(() => {
        trackWizardEvent('wizard_step_view', {
            step: currentStep,
        });
    }, [currentStep]);

    useEffect(() => {
        if (instagramAccountOptions.length === 0) {
            setSelectedInstagramAccount('');
            return;
        }

        setSelectedInstagramAccount((currentValue) => {
            if (instagramAccountOptions.some((option) => option.key === currentValue)) {
                return currentValue;
            }
            return instagramAccountOptions[0]?.key ?? '';
        });
    }, [instagramAccountOptions]);

    useEffect(() => {
        setEditableInstagramCaption((currentValue) =>
            currentValue === instagramDraft.caption ? currentValue : instagramDraft.caption
        );
        setEditableInstagramHashtags((currentValue) =>
            currentValue === instagramDraftHashtagsText ? currentValue : instagramDraftHashtagsText
        );
        setEditableInstagramImages((currentValue) =>
            currentValue.join('|') === instagramDraftImagesKey ? currentValue : instagramDraft.imageUrls
        );
    }, [instagramDraft.caption, instagramDraftHashtagsText, instagramDraftImagesKey, instagramDraft.imageUrls]);

    const handleReorderInstagramImage = useCallback((fromIndex: number, toIndex: number) => {
        setEditableInstagramImages((currentImages) => {
            if (fromIndex < 0 || fromIndex >= currentImages.length) return currentImages;
            if (toIndex < 0 || toIndex >= currentImages.length) return currentImages;
            if (fromIndex === toIndex) return currentImages;
            const nextImages = [...currentImages];
            const [movedImage] = nextImages.splice(fromIndex, 1);
            nextImages.splice(toIndex, 0, movedImage);
            return nextImages;
        });
    }, []);

    const handleMoveInstagramImage = useCallback((index: number, direction: -1 | 1) => {
        handleReorderInstagramImage(index, index + direction);
    }, [handleReorderInstagramImage]);

    const handleRemoveInstagramImage = useCallback((index: number) => {
        setEditableInstagramImages((currentImages) => currentImages.filter((_, currentIndex) => currentIndex !== index));
        setDraggedInstagramImageIndex((currentIndex) => {
            if (currentIndex == null) return currentIndex;
            if (currentIndex === index) return null;
            if (currentIndex > index) return currentIndex - 1;
            return currentIndex;
        });
    }, []);

    const handleInstagramDragStart = useCallback((index: number) => {
        if (Platform.OS !== 'web') return;
        setDraggedInstagramImageIndex(index);
    }, []);

    const handleInstagramDrop = useCallback((targetIndex: number) => {
        if (Platform.OS !== 'web') return;
        if (draggedInstagramImageIndex == null) return;
        handleReorderInstagramImage(draggedInstagramImageIndex, targetIndex);
        setDraggedInstagramImageIndex(null);
    }, [draggedInstagramImageIndex, handleReorderInstagramImage]);

    const handleInstagramDragEnd = useCallback(() => {
        if (Platform.OS !== 'web') return;
        setDraggedInstagramImageIndex(null);
    }, []);

    useEffect(() => {
        return () => {
            if (buttonErrorTimeoutRef.current) {
                clearTimeout(buttonErrorTimeoutRef.current);
                buttonErrorTimeoutRef.current = null;
            }
        };
    }, []);

    const pulsePrimaryError = useCallback((label: string) => {
        setPrimaryOverrideLabel(label);
        if (buttonErrorTimeoutRef.current) clearTimeout(buttonErrorTimeoutRef.current);
        buttonErrorTimeoutRef.current = setTimeout(() => {
            setPrimaryOverrideLabel(null);
            buttonErrorTimeoutRef.current = null;
        }, 2500);
    }, []);

    const scrollToMissingBanner = useCallback(() => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const el = document.getElementById('travelwizard-publish-missing-banner');
            if (el && typeof (el as any).scrollIntoView === 'function') {
                (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = missingBannerAnchorRef.current;
        if (!scrollNode || !anchorNode) return;

        const scrollHandle = findNodeHandle(scrollNode);
        const anchorHandle = findNodeHandle(anchorNode);
        if (!scrollHandle || !anchorHandle) return;

        setTimeout(() => {
            UIManager.measureLayout(
                anchorHandle,
                scrollHandle,
                () => undefined,
                (_x, y) => {
                    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
                },
            );
        }, 50);
    }, []);

    const handleSaveDraft = async () => {
        // ✅ FIX: Предотвращаем одновременные операции
        if (!startAction()) return;
        const previousForm = formData;

        try {
            const nextForm = {
                ...formData,
                publish: false,
                moderation: false,
            };
            setFormData(nextForm);
            setMissingForModeration([]);
            const saved = await onManualSave(nextForm);
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;

            const hasName = !!nextForm.name && nextForm.name.trim().length > 0;
            const hasDescription = !!nextForm.description && nextForm.description.trim().length > 0;
            const hasCountries = Array.isArray(nextForm.countries) && nextForm.countries.length > 0;
            const hasRoute = routePoints.length > 0;
            const galleryArr = galleryItems;
            const hasCover = !!nextForm.travel_image_thumb_small_url;
            const hasPhotos = hasCover || galleryArr.length > 0;

            await trackWizardEvent('wizard_draft_saved', {
                travel_id: resolvedId,
                step: currentStep,
                fields_filled: {
                    name: hasName,
                    description: hasDescription,
                    countries: hasCountries,
                    markers: hasRoute,
                    photos: hasPhotos,
                },
            });

            hapticNotification('success');

            // После сохранения на последнем шаге логично вывести пользователя из мастера
            // в раздел "Мои путешествия", где он увидит черновик.
            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Ошибка сохранения',
                    text2: error instanceof Error ? error.message : 'Попробуйте ещё раз',
                });
            }
        } finally {
            finishAction();
        }
    };

    const handleSendToModeration = async () => {
        if (!startAction()) return;
        const criticalMissing = getModerationIssues({
            name: formData.name ?? '',
            description: formData.description ?? '',
            countries: formData.countries ?? [],
            categories: formData.categories ?? [],
            coordsMeTravel: routePoints,
            gallery: galleryItems,
            travel_image_thumb_small_url: formData.travel_image_thumb_small_url ?? null,
        });
        const missingLabels = criticalMissing.map(i => i.label);

        await trackWizardEvent('wizard_moderation_attempt', {
            missing_fields: missingLabels,
            is_new: isNew,
            is_edit: !isNew,
            travel_id: formData.id ?? null,
        });

        if (criticalMissing.length > 0) {
            setMissingForModeration(criticalMissing);
            hapticNotification('warning');
            pulsePrimaryError('Нельзя отправить: исправьте ошибки');
            scrollToMissingBanner();
            finishAction();
            return;
        }

        setMissingForModeration([]);
        const previousForm = formData;
        const nextForm = {
            ...formData,
            moderation: false,
            publish: true, // пользователь отправляет на модерацию: publish=true, moderation остаётся false до решения админа
        };
        setFormData(nextForm);

        // Сохраняем статус на бэкенд (отсюда триггерятся уведомления)
        try {
            const saved = await onManualSave(nextForm);
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
            if (!resolvedId) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось отправить',
                    text2: 'Сохранение не удалось. Проверьте интернет и попробуйте ещё раз.',
                });
                return;
            }

            await trackWizardEvent('wizard_moderation_success', {
                travel_id: resolvedId,
                filled_checklist_count: checklist.filter(item => item.ok).length,
                total_checklist_count: checklist.length,
            });

            void showToastMessage({
                type: 'success',
                text1: 'Маршрут отправлен на модерацию',
                text2: 'После одобрения он появится в разделе "Мои путешествия".',
            });

            hapticNotification('success');

            // Навигация без повторного сохранения (чтобы не перезаписать publish=false старым стейтом)
            // Используем replace, чтобы мастер точно размонтировался и не продолжал автосохранение.
            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось отправить',
                    text2: error instanceof Error ? error.message : 'Проверьте интернет и попробуйте ещё раз.',
                });
            }
        } finally {
            finishAction();
        }
    };

    const handleApproveModeration = async () => {
        if (!startAction()) return;
        const previousForm = formData;
        const nextForm = {
            ...formData,
            moderation: true,
            publish: true,
        };
        setFormData(nextForm);

        try {
            const saved = await onManualSave(nextForm);
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
            if (!resolvedId) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: 'Проверьте интернет-соединение и попробуйте ещё раз',
                });
                return;
            }

            await trackWizardEvent('admin_moderation_approved', {
                travel_id: resolvedId,
            });

            void showToastMessage({
                type: 'success',
                text1: 'Модерация одобрена',
                text2: 'Маршрут опубликован и доступен всем пользователям.',
            });

            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: error instanceof Error ? error.message : 'Проверьте интернет-соединение и попробуйте ещё раз',
                });
            }
        } finally {
            finishAction();
        }
    };

    const handleRejectModeration = async () => {
        if (!startAction()) return;
        const previousForm = formData;
        const nextForm = {
            ...formData,
            moderation: false,
            publish: false,
        };
        setFormData(nextForm);

        try {
            const saved = await onManualSave(nextForm);
            const resolvedId = (saved as any)?.id ?? (nextForm as any)?.id ?? null;
            if (!resolvedId) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: 'Проверьте интернет-соединение и попробуйте ещё раз',
                });
                return;
            }

            // Send rejection comment as a message to the travel author
            const authorId =
                (formData as any)?.user?.id ??
                (formData as any)?.userId ??
                (formData as any)?.user_id ??
                null;
            const commentText = rejectionComment.trim();
            if (authorId && commentText) {
                try {
                    const travelName = formData.name || 'Без названия';
                    const messageText = `Модерация отклонена для "${travelName}": ${commentText}`;
                    await sendMessage({
                        participants: [Number(authorId)],
                        text: messageText,
                    });
                } catch (msgError) {
                    devError('Failed to send rejection message:', msgError);
                }
            }

            await trackWizardEvent('admin_moderation_rejected', {
                travel_id: resolvedId,
                has_comment: !!commentText,
            });

            void showToastMessage({
                type: 'info',
                text1: 'Модерация отклонена',
                text2: commentText
                    ? 'Маршрут возвращен в черновики. Комментарий отправлен автору.'
                    : 'Маршрут возвращен в черновики.',
            });

            setRejectionComment('');
            router.replace('/metravel');
        } catch (error) {
            setFormData(previousForm);
            hapticNotification('error');
            if (!hasToastBeenShown(error)) {
                void showToastMessage({
                    type: 'error',
                    text1: 'Не удалось сохранить',
                    text2: error instanceof Error ? error.message : 'Проверьте интернет-соединение и попробуйте ещё раз',
                });
            }
        } finally {
            finishAction();
        }
    };

    const handlePrimaryAction = () => {
        if (userPendingModeration) return;
        if (status === 'draft') {
            void handleSaveDraft();
        } else {
            void handleSendToModeration();
        }
    };

    const handleCopyInstagramText = useCallback(async () => {
        const finalText = finalInstagramText;
        if (!finalText) return;
        await Clipboard.setStringAsync(finalText);
        void showToastMessage({
            type: 'success',
            text1: 'Текст для Instagram скопирован',
        });
    }, [finalInstagramText]);

    const handleShareToOwnInstagram = useCallback(async () => {
        if (!finalInstagramText) {
            void showToastMessage({
                type: 'error',
                text1: 'Нет текста для публикации',
                text2: 'Добавьте описание маршрута, чтобы подготовить Instagram caption.',
            });
            return;
        }

        await Clipboard.setStringAsync(finalInstagramText);

        try {
            if (Platform.OS === 'web') {
                if (typeof navigator !== 'undefined' && navigator.share) {
                    await navigator.share({
                        title: formData.name?.trim() || 'Путешествие на Metravel',
                        text: finalInstagramText,
                    });
                }

                void showToastMessage({
                    type: 'success',
                    text1: 'Текст скопирован',
                    text2: 'Откройте Instagram и вставьте готовый caption в свой пост.',
                });
                return;
            }

            await Share.share(
                Platform.OS === 'ios'
                    ? { message: finalInstagramText }
                    : { message: finalInstagramText, title: formData.name?.trim() || 'Пост для Instagram' },
                { dialogTitle: 'Поделиться в Instagram' }
            );

            void showToastMessage({
                type: 'success',
                text1: 'Текст скопирован',
                text2: 'Выберите Instagram в меню и вставьте caption в свой пост.',
            });
        } catch (error) {
            void showToastMessage({
                type: 'error',
                text1: 'Не удалось открыть меню публикации',
                text2: error instanceof Error ? error.message : 'Попробуйте ещё раз.',
            });
        }
    }, [finalInstagramText, formData.name]);

    const handleInstagramCaptionChange = useCallback((nextValue: string) => {
        setEditableInstagramCaption(clampInstagramCaption(nextValue, parsedInstagramHashtags));
    }, [parsedInstagramHashtags]);

    const handleInstagramHashtagsChange = useCallback((nextValue: string) => {
        const normalizedHashtags = parseInstagramHashtags(nextValue);
        setEditableInstagramHashtags(normalizedHashtags.join(' '));
        setEditableInstagramCaption((currentCaption) => clampInstagramCaption(currentCaption, normalizedHashtags));
    }, []);

    const handlePublishToInstagram = useCallback(async () => {
        if (!canPublishToInstagram) {
            const validationMessage = isInstagramHashtagCountTooHigh
                ? `Сейчас ${instagramHashtagCount} тегов, максимум ${INSTAGRAM_HASHTAG_MAX_COUNT}.`
                : isInstagramCaptionTooLong
                ? `Сейчас ${instagramFinalLength} символов, максимум ${INSTAGRAM_CAPTION_MAX_LENGTH}.`
                : 'Нужен сохранённый маршрут и хотя бы одно фото в галерее.';
            void showToastMessage({
                type: 'error',
                text1: 'Не хватает данных для публикации',
                text2: validationMessage,
            });
            return;
        }

        if (!selectedInstagramAccount) {
            void showToastMessage({
                type: 'error',
                text1: 'Выберите Instagram-аккаунт',
                text2: 'Добавьте аккаунты в EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS.',
            });
            return;
        }

        try {
            const result = await publishTravelToInstagram({
                travelId: Number(formData.id),
                accountKey: selectedInstagramAccount,
                caption: editableInstagramCaption.trim(),
                hashtags: parsedInstagramHashtags,
                imageUrls: editableInstagramImages,
            });

            void showToastMessage({
                type: 'success',
                text1: 'Публикация запущена',
                text2: result?.postUrl
                    ? `Пост создан: ${result.postUrl}`
                    : 'Backend принял задачу на публикацию в Instagram.',
            });
        } catch (error) {
            void showToastMessage({
                type: 'error',
                text1: 'Не удалось опубликовать в Instagram',
                text2: error instanceof Error ? error.message : 'Проверьте backend endpoint и конфигурацию аккаунтов.',
            });
        }
    }, [
        canPublishToInstagram,
        formData.id,
        editableInstagramCaption,
        editableInstagramImages,
        instagramFinalLength,
        instagramHashtagCount,
        isInstagramCaptionTooLong,
        isInstagramHashtagCountTooHigh,
        parsedInstagramHashtags,
        selectedInstagramAccount,
    ]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onGoBack}
                    title={stepMeta?.title ?? 'Публикация путешествия'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    autosaveBadge={autosaveBadge}
                    onPrimary={handlePrimaryAction}
                    primaryLabel={
                        primaryOverrideLabel ??
                        (pendingModeration
                            ? 'Отправлено на модерацию'
                            : status === 'draft'
                            ? 'Сохранить'
                            : 'Отправить на модерацию')
                    }
                    primaryTestID="primary-button"
                    primaryDisabled={pendingModeration}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                />
                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                    <View style={[styles.card, styles.statusChipCard]}>
                        <Text style={styles.cardTitle}>Текущий статус</Text>
                        <View style={styles.statusChipRow}>
                            <View
                                style={[
                                    styles.statusChip,
                                    currentBackendStatus.tone === 'success' && styles.statusChipSuccess,
                                    currentBackendStatus.tone === 'warning' && styles.statusChipWarning,
                                    currentBackendStatus.tone === 'muted' && styles.statusChipMuted,
                                ]}
                            >
                                <Text style={styles.statusChipText}>{currentBackendStatus.label}</Text>
                            </View>
                            <Text style={styles.statusChipHint}>
                                {pendingModeration
                                    ? 'Маршрут отправлен на модерацию, ожидает решения администратора.'
                                    : 'Это статус, который уже сохранён. Ниже вы можете выбрать новый (черновик или модерация).'}
                            </Text>
                        </View>
                    </View>

                    {!pendingModeration && (
                        <View style={[styles.card, styles.statusCard]}>
                            <Text style={styles.cardTitle}>Статус публикации</Text>
                            <View style={styles.statusOptions}>
                                <CardActionPressable
                                    style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
                                    onPress={() => setStatus('draft')}
                                    disabled={userPendingModeration}
                                    accessibilityLabel="Сохранить как черновик"
                                >
                                    <View style={styles.radioOuter}>
                                        {status === 'draft' && <View style={styles.radioInner} />}
                                    </View>
                                    <View style={styles.statusTextCol}>
                                        <Text style={styles.statusLabel}>Сохранить как черновик</Text>
                                        <Text style={styles.statusHint}>
                                            Черновик виден только вам. Его можно дополнять и отправить на модерацию позже.
                                        </Text>
                                    </View>
                                </CardActionPressable>

                                <View style={styles.divider} />

                                <CardActionPressable
                                    style={[styles.statusOption, status === 'moderation' && styles.statusOptionActive]}
                                    onPress={() => setStatus('moderation')}
                                    disabled={userPendingModeration}
                                    accessibilityLabel="Отправить на модерацию"
                                >
                                    <View style={styles.radioOuter}>
                                        {status === 'moderation' && <View style={styles.radioInner} />}
                                    </View>
                                    <View style={styles.statusTextCol}>
                                        <Text style={styles.statusLabel}>Отправить на модерацию</Text>
                                        <Text style={styles.statusHint}>
                                            После одобрения маршрут станет публичным и появится в списке путешествий.
                                        </Text>
                                    </View>
                                </CardActionPressable>
                            </View>
                        </View>
                    )}

                    {status === 'moderation' && missingForModeration.length > 0 && (
                        <View ref={missingBannerAnchorRef} nativeID="travelwizard-publish-missing-banner" />
                    )}

                    {status === 'moderation' && missingForModeration.length > 0 && (
                        <View style={[styles.card, styles.bannerError]}>
                            <Text style={styles.bannerTitle}>Нужно дополнить перед модерацией</Text>
                            <Text style={styles.bannerDescription}>
                                Проверьте отмеченные пункты чек-листа. Без них мы не сможем отправить маршрут на модерацию.
                            </Text>
                            {missingForModeration.map(issue => {
                                const isClickable = !!onNavigateToIssue;

                                const rowContent = (
                                    <>
                                        <View style={[styles.checkBadge, styles.checkBadgeMissing]}>
                                            <Icon source="alert" size={14} color={colors.dangerDark} />
                                        </View>
                                        <Text
                                            style={[
                                                styles.checklistLabel,
                                                isClickable && styles.checklistLabelClickable,
                                            ]}
                                        >
                                            {issue.label}
                                        </Text>
                                    </>
                                );

                                const rowStyle = [
                                    styles.checklistRow,
                                    isClickable && styles.checklistRowClickable,
                                ];

                                if (isClickable) {
                                    return (
                                        <CardActionPressable
                                            key={issue.key}
                                            style={rowStyle}
                                            onPress={() => onNavigateToIssue?.(issue)}
                                            accessibilityLabel={issue.label}
                                        >
                                            {rowContent}
                                        </CardActionPressable>
                                    );
                                }

                                return (
                                    <View key={issue.key} style={rowStyle}>
                                        {rowContent}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={[styles.card, styles.qualityCard]}>
                        <Text style={styles.cardTitle}>Качество заполнения</Text>
                        <QualityIndicator level={qualityScore.level} score={qualityScore.score} />
                        {qualityScore.suggestions.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                                <Text style={styles.suggestionsTitle}>Рекомендации для улучшения:</Text>
                                {qualityScore.suggestions.map((suggestion, idx) => (
                                    <Text key={idx} style={styles.suggestionItem}>• {suggestion}</Text>
                                ))}
                            </View>
                        )}
                    </View>

                    <PublishChecklistCard
                        colors={colors}
                        styles={styles}
                        checklist={checklist}
                        requiredChecklist={requiredChecklist}
                        recommendedChecklist={recommendedChecklist}
                        moderationIssuesByKey={moderationIssuesByKey}
                        onNavigateToIssue={onNavigateToIssue}
                    />

                    {isSuperAdmin && (pendingModeration || formData.moderation || status === 'moderation') && (
                        <View style={[styles.card, styles.adminCard]}>
                            <Text style={styles.cardTitle}>Панель модератора</Text>
                            <Text style={styles.adminHint}>
                                Маршрут находится на модерации. Вы можете одобрить или отклонить его.
                            </Text>
                            <View style={styles.rejectionCommentContainer}>
                                <Text style={styles.rejectionCommentLabel}>Комментарий при отклонении (будет отправлен автору):</Text>
                                <TextInput
                                    style={[
                                        styles.rejectionCommentInput,
                                        {
                                            backgroundColor: colors.backgroundSecondary,
                                            color: colors.text,
                                            borderColor: colors.borderLight,
                                        },
                                    ]}
                                    value={rejectionComment}
                                    onChangeText={setRejectionComment}
                                    placeholder="Укажите причину отклонения..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    maxLength={1000}
                                    accessibilityLabel="Комментарий при отклонении"
                                />
                            </View>
                            <View style={styles.adminButtons}>
                                <Button
                                    label="Одобрить модерацию"
                                    onPress={handleApproveModeration}
                                    icon={<Feather name="check-circle" size={20} color={colors.textOnPrimary} />}
                                    variant="primary"
                                    size="md"
                                    style={[styles.adminButton, styles.adminButtonApprove]}
                                    labelStyle={styles.adminButtonText}
                                    accessibilityLabel="Одобрить модерацию"
                                />
                                <Button
                                    label="Отклонить"
                                    onPress={handleRejectModeration}
                                    icon={<Feather name="x-circle" size={20} color={colors.textOnPrimary} />}
                                    variant="danger"
                                    size="md"
                                    style={[styles.adminButton, styles.adminButtonReject]}
                                    labelStyle={styles.adminButtonText}
                                    accessibilityLabel="Отклонить модерацию"
                                />
                            </View>
                        </View>
                    )}

                    <View style={[styles.card, styles.instagramCard]}>
                            <Text style={styles.cardTitle}>Instagram публикация</Text>
                            <Text style={styles.adminHint}>
                                Берутся только первые 10 фото из галереи. Порядок можно поменять вручную.
                                {!isSuperAdmin ? ' Текст уже подготовлен под лимиты Instagram.' : ''}
                            </Text>

                            {isSuperAdmin && (
                                <View style={styles.instagramSection}>
                                    <Text style={styles.rejectionCommentLabel}>Аккаунт для публикации</Text>
                                    <View style={styles.accountList}>
                                        {instagramAccountOptions.length > 0 ? (
                                            instagramAccountOptions.map((option) => {
                                                const isActive = option.key === selectedInstagramAccount;
                                                return (
                                                    <CardActionPressable
                                                        key={option.key}
                                                        style={[
                                                            styles.accountOption,
                                                            isActive && styles.accountOptionActive,
                                                        ]}
                                                        onPress={() => setSelectedInstagramAccount(option.key)}
                                                        accessibilityLabel={`Выбрать аккаунт ${option.label}`}
                                                    >
                                                        <View style={styles.radioOuter}>
                                                            {isActive && <View style={styles.radioInner} />}
                                                        </View>
                                                        <Text style={styles.statusLabel}>{option.label}</Text>
                                                    </CardActionPressable>
                                                );
                                            })
                                        ) : (
                                            <View style={[styles.bannerInfo, styles.inlineBanner]}>
                                                <Text style={[styles.bannerDescription, styles.bannerInfoText]}>
                                                    Задайте `EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS` в формате JSON
                                                    или `key:@label,key2:@label2`.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            <View style={styles.instagramMetaRow}>
                                <View style={styles.instagramMetaItem}>
                                    <Text style={styles.instagramMetaLabel}>Фото</Text>
                                    <Text style={styles.instagramMetaValue}>{editableInstagramImages.length}</Text>
                                </View>
                                <View style={styles.instagramMetaItem}>
                                    <Text style={styles.instagramMetaLabel}>Теги</Text>
                                    <Text style={styles.instagramMetaValue}>{instagramDraft.hashtags.length}</Text>
                                </View>
                            </View>

                            {editableInstagramImages.length > 0 && (
                                <View style={styles.instagramPreview}>
                                    <Text style={styles.rejectionCommentLabel}>Превью фото</Text>
                                    <Text style={styles.instagramHintText}>
                                        Перетаскивайте карточки мышью или используйте стрелки для точной перестановки.
                                    </Text>
                                    {Platform.OS === 'web' ? (
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(152px, 152px))',
                                                gap: DESIGN_TOKENS.spacing.sm,
                                                width: '100%',
                                                justifyContent: 'flex-start',
                                                alignItems: 'start',
                                            }}
                                        >
                                            {editableInstagramImages.map((imageUrl, index) => (
                                                <div
                                                    key={`${imageUrl}-${index}`}
                                                    data-testid="instagram-preview-image"
                                                    style={Object.assign(
                                                        {},
                                                        styles.instagramGalleryCard as any,
                                                        draggedInstagramImageIndex === index
                                                            ? (styles.instagramGalleryCardDragging as any)
                                                            : null,
                                                        {
                                                            display: 'block',
                                                        }
                                                    )}
                                                    {...{
                                                        draggable: true,
                                                        onDragStart: (event: any) => {
                                                            event?.dataTransfer?.setData?.('text/plain', String(index));
                                                            event?.dataTransfer && (event.dataTransfer.effectAllowed = 'move');
                                                            handleInstagramDragStart(index);
                                                        },
                                                        onDragOver: (event: any) => {
                                                            event?.preventDefault?.();
                                                            if (event?.dataTransfer) {
                                                                event.dataTransfer.dropEffect = 'move';
                                                            }
                                                        },
                                                        onDrop: (event: any) => {
                                                            event?.preventDefault?.();
                                                            handleInstagramDrop(index);
                                                        },
                                                        onDragEnd: () => {
                                                            handleInstagramDragEnd();
                                                        },
                                                    }}
                                                >
                                                    <ExpoImage
                                                        source={{ uri: imageUrl }}
                                                        style={styles.instagramGalleryImage}
                                                        contentFit="cover"
                                                        transition={150}
                                                    />
                                                    <View style={styles.instagramGalleryDragHandle}>
                                                        <Feather name="move" size={16} color={colors.text} />
                                                    </View>
                                                    <Pressable
                                                        onPress={() => handleRemoveInstagramImage(index)}
                                                        style={styles.instagramGalleryRemoveButton}
                                                        testID={`instagram-remove-${index}`}
                                                        accessibilityLabel={`Исключить фото ${index + 1} из публикации`}
                                                    >
                                                        <Feather name="x" size={16} color={colors.text} />
                                                    </Pressable>
                                                    <View style={styles.instagramGalleryControls}>
                                                        <Pressable
                                                            onPress={() => handleMoveInstagramImage(index, -1)}
                                                            disabled={index === 0}
                                                            style={[
                                                                styles.instagramGalleryControlButton,
                                                                index === 0 && styles.instagramGalleryControlButtonDisabled,
                                                            ]}
                                                            testID={`instagram-move-left-${index}`}
                                                            accessibilityLabel={`Переместить фото ${index + 1} влево`}
                                                        >
                                                            <Feather name="chevron-left" size={18} color={colors.text} />
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() => handleMoveInstagramImage(index, 1)}
                                                            disabled={index === editableInstagramImages.length - 1}
                                                            style={[
                                                                styles.instagramGalleryControlButton,
                                                                index === editableInstagramImages.length - 1 && styles.instagramGalleryControlButtonDisabled,
                                                            ]}
                                                            testID={`instagram-move-right-${index}`}
                                                            accessibilityLabel={`Переместить фото ${index + 1} вправо`}
                                                        >
                                                            <Feather name="chevron-right" size={18} color={colors.text} />
                                                        </Pressable>
                                                    </View>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={styles.instagramGalleryRow}
                                        >
                                            {editableInstagramImages.map((imageUrl, index) => (
                                            <View
                                                key={`${imageUrl}-${index}`}
                                                style={[
                                                    styles.instagramGalleryCard,
                                                    draggedInstagramImageIndex === index && styles.instagramGalleryCardDragging,
                                                ]}
                                                testID="instagram-preview-image"
                                                {...(Platform.OS === 'web'
                                                    ? ({
                                                        draggable: true,
                                                        onDragStart: (event: any) => {
                                                            event?.dataTransfer?.setData?.('text/plain', String(index));
                                                            event?.dataTransfer && (event.dataTransfer.effectAllowed = 'move');
                                                            handleInstagramDragStart(index);
                                                        },
                                                        onDragOver: (event: any) => {
                                                            event?.preventDefault?.();
                                                            if (event?.dataTransfer) {
                                                                event.dataTransfer.dropEffect = 'move';
                                                            }
                                                        },
                                                        onDrop: (event: any) => {
                                                            event?.preventDefault?.();
                                                            handleInstagramDrop(index);
                                                        },
                                                        onDragEnd: () => {
                                                            handleInstagramDragEnd();
                                                        },
                                                    } as any)
                                                    : {})}
                                                >
                                                    <ExpoImage
                                                        source={{ uri: imageUrl }}
                                                        style={styles.instagramGalleryImage}
                                                        contentFit="cover"
                                                    transition={150}
                                                />
                                                <View style={styles.instagramGalleryDragHandle}>
                                                    <Feather name="move" size={14} color={colors.text} />
                                                </View>
                                                <Pressable
                                                    onPress={() => handleRemoveInstagramImage(index)}
                                                    style={styles.instagramGalleryRemoveButton}
                                                    testID={`instagram-remove-${index}`}
                                                    accessibilityLabel={`Исключить фото ${index + 1} из публикации`}
                                                >
                                                    <Feather name="x" size={14} color={colors.text} />
                                                </Pressable>
                                                <View style={styles.instagramGalleryControls}>
                                                    <Pressable
                                                        onPress={() => handleMoveInstagramImage(index, -1)}
                                                        disabled={index === 0}
                                                        style={[
                                                            styles.instagramGalleryControlButton,
                                                            index === 0 && styles.instagramGalleryControlButtonDisabled,
                                                        ]}
                                                        testID={`instagram-move-left-${index}`}
                                                        accessibilityLabel={`Переместить фото ${index + 1} влево`}
                                                    >
                                                        <Feather name="chevron-left" size={14} color={colors.text} />
                                                    </Pressable>
                                                    <Pressable
                                                        onPress={() => handleMoveInstagramImage(index, 1)}
                                                        disabled={index === editableInstagramImages.length - 1}
                                                        style={[
                                                            styles.instagramGalleryControlButton,
                                                            index === editableInstagramImages.length - 1 && styles.instagramGalleryControlButtonDisabled,
                                                        ]}
                                                        testID={`instagram-move-right-${index}`}
                                                        accessibilityLabel={`Переместить фото ${index + 1} вправо`}
                                                    >
                                                        <Feather name="chevron-right" size={14} color={colors.text} />
                                                    </Pressable>
                                                </View>
                                            </View>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                            )}

                            <View style={styles.instagramPreview}>
                                <View style={styles.instagramFieldHeader}>
                                    <Text style={styles.rejectionCommentLabel}>Текст поста</Text>
                                    <Text
                                        style={[
                                            styles.instagramCounter,
                                            isInstagramCaptionTooLong && styles.instagramCounterDanger,
                                        ]}
                                    >
                                        {instagramFinalLength}/{INSTAGRAM_CAPTION_MAX_LENGTH} символов
                                    </Text>
                                </View>
                                <TextInput
                                    style={[
                                        styles.rejectionCommentInput,
                                        styles.instagramCaptionInput,
                                        {
                                            backgroundColor: colors.backgroundSecondary,
                                            color: colors.text,
                                            borderColor: colors.borderLight,
                                        },
                                    ]}
                                    value={editableInstagramCaption}
                                    onChangeText={handleInstagramCaptionChange}
                                    placeholder="Текст публикации"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    accessibilityLabel="Текст поста для Instagram"
                                />
                                <Text
                                    style={[
                                        styles.instagramHintText,
                                        isInstagramCaptionTooLong && styles.instagramHintDanger,
                                    ]}
                                >
                                    Текст: {instagramCaptionLength} символов. Итоговый caption с тегами должен быть не длиннее {INSTAGRAM_CAPTION_MAX_LENGTH} символов.
                                </Text>
                            </View>

                            <View style={styles.instagramPreview}>
                                <View style={styles.instagramFieldHeader}>
                                    <Text style={styles.rejectionCommentLabel}>Хэштеги</Text>
                                    <Text
                                        style={[
                                            styles.instagramCounter,
                                            isInstagramHashtagCountTooHigh && styles.instagramCounterDanger,
                                        ]}
                                    >
                                        {instagramHashtagCount}/{INSTAGRAM_HASHTAG_MAX_COUNT} тегов
                                    </Text>
                                </View>
                                <TextInput
                                    style={[
                                        styles.rejectionCommentInput,
                                        {
                                            backgroundColor: colors.backgroundSecondary,
                                            color: colors.text,
                                            borderColor: colors.borderLight,
                                        },
                                    ]}
                                    value={editableInstagramHashtags}
                                    onChangeText={handleInstagramHashtagsChange}
                                    placeholder="#metravelby #польша"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    accessibilityLabel="Хэштеги для Instagram"
                                />
                                <Text
                                    style={[
                                        styles.instagramHintText,
                                        isInstagramHashtagCountTooHigh && styles.instagramHintDanger,
                                    ]}
                                >
                                    Instagram допускает до {INSTAGRAM_HASHTAG_MAX_COUNT} хэштегов. Сейчас распознано {instagramHashtagCount}.
                                </Text>
                            </View>

                            <View style={styles.instagramPreview}>
                                <View style={styles.instagramFieldHeader}>
                                    <Text style={styles.rejectionCommentLabel}>Предпросмотр</Text>
                                    <Text
                                        style={[
                                            styles.instagramCounter,
                                            isInstagramCaptionTooLong && styles.instagramCounterDanger,
                                        ]}
                                    >
                                        {instagramFinalLength}/{INSTAGRAM_CAPTION_MAX_LENGTH}
                                    </Text>
                                </View>
                                <Text style={styles.instagramPreviewText}>
                                    {finalInstagramText}
                                </Text>
                            </View>

                            <View style={styles.adminButtons}>
                                <Button
                                    label="Скопировать текст"
                                    onPress={() => void handleCopyInstagramText()}
                                    icon={<Feather name="copy" size={18} color={colors.textOnPrimary} />}
                                    variant="secondary"
                                    size="md"
                                    style={styles.adminButton}
                                    labelStyle={styles.adminButtonText}
                                    accessibilityLabel="Скопировать текст для Instagram"
                                />
                                <Button
                                    label="Поделиться в свой Instagram"
                                    onPress={() => void handleShareToOwnInstagram()}
                                    icon={<Feather name="share-2" size={18} color={colors.textOnPrimary} />}
                                    variant="secondary"
                                    size="md"
                                    style={styles.adminButton}
                                    labelStyle={styles.adminButtonText}
                                    accessibilityLabel="Поделиться в свой Instagram"
                                />
                            </View>

                            {isSuperAdmin && (
                                <View style={styles.adminButtons}>
                                    <Button
                                        label="Опубликовать в Instagram"
                                        onPress={() => void handlePublishToInstagram()}
                                        icon={<Feather name="instagram" size={18} color={colors.textOnPrimary} />}
                                        variant="primary"
                                        size="md"
                                        style={[styles.adminButton, !canPublishToInstagram && styles.adminButtonDisabled]}
                                        labelStyle={styles.adminButtonText}
                                        disabled={!canPublishToInstagram || !selectedInstagramAccount}
                                        accessibilityLabel="Опубликовать в Instagram"
                                    />
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
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
    content: {
        flex: 1,
        paddingHorizontal: 8,
    },
    contentContainer: {
        paddingBottom: 0,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    card: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                    (colors as unknown as { boxShadows?: { card?: string } }).boxShadows?.card ??
                    DESIGN_TOKENS.shadows.card,
            } as unknown as object)
            : ((colors as unknown as { shadows?: { light?: object } }).shadows?.light ??
                DESIGN_TOKENS.shadowsNative.light)),
    },
    cardTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    statusCard: {},
    qualityCard: {},
    suggestionsContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
        paddingTop: DESIGN_TOKENS.spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    suggestionsTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    suggestionItem: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: 4,
        lineHeight: 20,
    },
    statusOptions: {
        gap: DESIGN_TOKENS.spacing.sm,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    statusOptionActive: {
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },
    statusTextCol: {
        flex: 1,
        minWidth: 0,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.8,
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: DESIGN_TOKENS.spacing.xxs,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    statusLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
    },
    statusHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    statusChipCard: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusChipRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.md },
    statusChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusChipSuccess: { backgroundColor: colors.successSoft, borderColor: colors.successLight },
    statusChipWarning: { backgroundColor: colors.warningSoft, borderColor: colors.warningLight },
    statusChipMuted: { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
    statusChipText: { fontWeight: '700', color: colors.text },
    statusChipHint: { flex: 1, color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm },
    checklistCard: {},
    checklistHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    progressRing: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.primarySoft,
        borderWidth: 3,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRingText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primaryText,
    },
    checklistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 6,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    checklistRowClickable: {
        borderColor: colors.borderLight,
        backgroundColor: colors.surfaceMuted,
    },
    checklistRowComplete: {
        backgroundColor: colors.successSoft,
        borderColor: colors.successLight,
    },
    checklistTextColumn: {
        flex: 1,
        minWidth: 0,
    },
    checkBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 0,
    },
    checkBadgeOk: {
        backgroundColor: colors.successSoft,
        borderColor: colors.successLight,
    },
    checkBadgeMissing: {
        backgroundColor: colors.dangerSoft,
        borderColor: colors.dangerLight,
    },
    checkBadgeRecommended: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryAlpha40,
    },
    checklistLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.text,
        lineHeight: 20,
        fontWeight: '500',
    },
    checklistLabelComplete: {
        color: colors.successDark,
    },
    checklistLabelClickable: {
        fontWeight: '600',
    },
    checklistDetail: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        lineHeight: 16,
    },
    checklistHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        fontStyle: 'italic',
    },
    // ✅ УЛУЧШЕНИЕ: Стили для разделения чеклиста
    checklistSection: {
        marginBottom: DESIGN_TOKENS.spacing.md,
    },
    checklistSectionRecommended: {
        paddingTop: DESIGN_TOKENS.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.sm,
        gap: DESIGN_TOKENS.spacing.xs,
    },
    sectionHeaderIcon: {
        fontSize: 16,
    },
    sectionHeaderText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: colors.text,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    benefitIcon: {
        fontSize: 12,
    },
    benefitText: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.primaryText,
        fontWeight: '600',
        lineHeight: 16,
    },
    bannerError: {
        backgroundColor: colors.dangerSoft,
        borderColor: colors.dangerLight,
    },
    bannerInfo: {
        backgroundColor: colors.infoSoft,
        borderColor: colors.infoLight,
    },
    bannerInfoText: {
        color: colors.text,
        marginBottom: 0,
    },
    inlineBanner: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.md,
    },
    bannerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.dangerDark,
        marginBottom: 4,
    },
    bannerDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.dangerDark,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    adminCard: {
        backgroundColor: colors.backgroundSecondary,
        borderColor: colors.border,
    },
    instagramCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    adminHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.xs,
        lineHeight: 20,
    },
    instagramSection: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    accountList: {
        gap: DESIGN_TOKENS.spacing.xs,
    },
    accountOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
    },
    accountOptionActive: {
        borderColor: colors.borderAccent,
        backgroundColor: colors.primarySoft,
    },
    instagramMetaRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramMetaItem: {
        flex: 1,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.backgroundSecondary,
    },
    instagramMetaLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 4,
    },
    instagramMetaValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.text,
        fontWeight: '700',
    },
    instagramHintText: {
        marginTop: 2,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    instagramHintDanger: {
        color: colors.dangerDark,
    },
    instagramFieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    instagramCounter: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        fontWeight: '600',
    },
    instagramCounterDanger: {
        color: colors.dangerDark,
    },
    instagramGalleryRow: {
        gap: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    instagramGalleryGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    instagramGalleryCard: {
        width: Platform.OS === 'web' ? 152 : 96,
        height: Platform.OS === 'web' ? 152 : 96,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    instagramGalleryCardDragging: {
        opacity: 0.72,
        borderColor: colors.primary,
        ...(Platform.OS === 'web' ? ({ cursor: 'grabbing' } as any) : {}),
    },
    instagramGalleryImage: {
        width: '100%',
        height: '100%',
    },
    instagramGalleryDragHandle: {
        position: 'absolute',
        top: 6,
        left: 6,
        width: Platform.OS === 'web' ? 32 : 24,
        height: Platform.OS === 'web' ? 32 : 24,
        borderRadius: Platform.OS === 'web' ? 16 : 12,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : {}),
    },
    instagramGalleryRemoveButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: Platform.OS === 'web' ? 32 : 24,
        height: Platform.OS === 'web' ? 32 : 24,
        borderRadius: Platform.OS === 'web' ? 16 : 12,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        zIndex: 2,
    },
    instagramGalleryControls: {
        position: 'absolute',
        left: 6,
        right: 6,
        bottom: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    instagramGalleryControlButton: {
        width: Platform.OS === 'web' ? 40 : 28,
        height: Platform.OS === 'web' ? 40 : 28,
        borderRadius: Platform.OS === 'web' ? 20 : 14,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    instagramGalleryControlButtonDisabled: {
        opacity: 0.45,
    },
    instagramPreview: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramPreviewText: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
        color: colors.text,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        lineHeight: 20,
    },
    instagramCaptionInput: {
        minHeight: 140,
    },
    rejectionCommentContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    rejectionCommentLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    rejectionCommentInput: {
        borderWidth: 1,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        minHeight: 80,
        textAlignVertical: 'top' as const,
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
    },
    adminButtons: {
        marginTop: DESIGN_TOKENS.spacing.md,
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    adminButton: {
        flex: 1,
        minWidth: 150,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderColor: colors.border,
        backgroundColor: colors.success,
    },
    adminButtonApprove: {
        backgroundColor: colors.success,
    },
    adminButtonReject: {
        backgroundColor: colors.danger,
    },
    adminButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: colors.textOnPrimary,
    },
    adminButtonDisabled: {
        opacity: 0.6,
    },
});

export default React.memo(TravelWizardStepPublish);
