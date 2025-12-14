import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView } from 'react-native';

import GallerySection from '@/components/travel/GallerySection';
import YoutubeLinkComponent from '@/components/YoutubeLinkComponent';
import ImageUploadComponent from '@/components/imageUpload/ImageUploadComponent';
import { TravelFormData, Travel } from '@/src/types/types';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelWizardStepMediaProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    travelDataOld: Travel | null;
    onManualSave: () => void;
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
}) => {
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const handleYoutubeChange = (value: string) => {
        setFormData({ ...formData, youtube_link: value });
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{stepMeta?.title ?? 'Медиа путешествия'}</Text>
                        <Text style={styles.headerSubtitle}>{stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}</Text>
                    </View>
                    {autosaveBadge && (
                        <View style={styles.autosaveBadge}>
                            <Text style={styles.autosaveBadgeText}>{autosaveBadge}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressLabel}>Готово на {progressPercent}%</Text>
            </View>

            {stepMeta?.tipBody && (
                <View style={styles.tipCard}>
                    <Text style={styles.tipTitle}>{stepMeta.tipTitle ?? 'Подсказка'}</Text>
                    <Text style={styles.tipBody}>{stepMeta.tipBody}</Text>
                </View>
            )}

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.section}>
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
                            Сначала сохраните основную информацию, чтобы добавить фото.
                        </Text>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Галерея путешествия</Text>
                    <Text style={styles.sectionHint}>
                        Фотографии повышают доверие и помогают читателям лучше понять маршрут. 
                        Рекомендуем добавить 3–10 снимков.
                    </Text>
                    <GallerySection formData={formData} travelDataOld={travelDataOld} />
                </View>

                <View style={styles.section}>
                    <YoutubeLinkComponent
                        label="Видео о путешествии (YouTube-ссылка)"
                        value={formData.youtube_link ?? ''}
                        onChange={handleYoutubeChange}
                        hint="Вставьте ссылку на ролик на YouTube, например: https://www.youtube.com/watch?v=..."
                    />
                </View>
            </ScrollView>

            <TravelWizardFooter
                canGoBack={true}
                onBack={onBack}
                onPrimary={onNext}
                onSave={onManualSave}
                primaryLabel="К деталям"
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f9f9f9' },
    headerWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#f9f9f9',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    headerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#6b7280',
    },
    autosaveBadge: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999,
        backgroundColor: '#eef2ff',
    },
    autosaveBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#4338ca',
        fontWeight: '600',
    },
    progressBarTrack: {
        marginTop: 8,
        width: '100%',
        height: 6,
        borderRadius: 999,
        backgroundColor: '#e5e7eb',
    },
    progressBarFill: {
        height: 6,
        borderRadius: 999,
        backgroundColor: '#2563eb',
    },
    progressLabel: {
        marginTop: 6,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#6b7280',
    },
    tipCard: {
        marginHorizontal: DESIGN_TOKENS.spacing.lg,
        marginTop: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: 12,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    tipTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: '#047857',
        marginBottom: 4,
    },
    tipBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#065f46',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingBottom: 80,
    },
    section: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#6b7280',
        marginBottom: 8,
    },
    coverWrapper: {
        marginTop: 8,
        alignItems: 'center',
    },
    infoText: {
        marginTop: 8,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#6b7280',
    },
});

export default React.memo(TravelWizardStepMedia);
