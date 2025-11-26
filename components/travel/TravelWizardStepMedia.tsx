import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';

import GallerySection from '@/components/travel/GallerySection';
import YoutubeLinkComponent from '@/components/YoutubeLinkComponent';
import ImageUploadComponent from '@/components/imageUpload/ImageUploadComponent';
import { TravelFormData, Travel } from '@/src/types/types';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';

interface TravelWizardStepMediaProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    travelDataOld: Travel | null;
    onManualSave: () => void;
    onBack: () => void;
    onNext: () => void;
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
}) => {
    const handleYoutubeChange = (value: string) => {
        setFormData({ ...formData, youtube_link: value });
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <Text style={styles.headerTitle}>Медиа путешествия</Text>
                <Text style={styles.headerSubtitle}>
                    Шаг {currentStep} из {totalSteps} · Фото и видео (предыдущий: Маршрут · следующий: Детали)
                </Text>
            </View>

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
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#f9f9f9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#6b7280',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 80,
    },
    section: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 8,
    },
    coverWrapper: {
        marginTop: 8,
        alignItems: 'center',
    },
    infoText: {
        marginTop: 8,
        fontSize: 14,
        color: '#6b7280',
    },
});

export default TravelWizardStepMedia;
