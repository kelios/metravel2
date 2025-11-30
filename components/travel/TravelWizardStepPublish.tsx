import React, { useMemo, useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { TravelFormData, Travel } from '@/src/types/types';
import { getModerationErrors } from '@/utils/formValidation';
import { trackWizardEvent } from '@/src/utils/analytics';

interface TravelWizardStepPublishProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    filters: any;
    travelDataOld: Travel | null;
    isSuperAdmin: boolean;
    onManualSave: () => void;
    onGoBack: () => void;
    onFinish: () => void;
}

const TravelWizardStepPublish: React.FC<TravelWizardStepPublishProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    filters,
    travelDataOld,
    isSuperAdmin,
    onManualSave,
    onGoBack,
    onFinish,
}) => {
    const router = useRouter();
    const [status, setStatus] = useState<'draft' | 'moderation'>(
        formData.moderation ? 'moderation' : 'draft',
    );

    const checklist = useMemo(() => {
        const hasName = !!formData.name && formData.name.trim().length > 0;
        const hasDescription = !!formData.description && formData.description.trim().length > 0;
        const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
        const hasRoute = Array.isArray((formData as any).coordsMeTravel)
            ? ((formData as any).coordsMeTravel as any[]).length > 0
            : Array.isArray((formData as any).markers)
                ? ((formData as any).markers as any[]).length > 0
                : false;
        const galleryArr = Array.isArray((formData as any).gallery)
            ? ((formData as any).gallery as any[])
            : [];
        const hasCover = !!(formData as any).travel_image_thumb_small_url;
        const hasPhotos = hasCover || galleryArr.length > 0;

        return [
            { key: 'name', label: 'Название маршрута (не менее 3 символов)', ok: hasName },
            { key: 'description', label: 'Описание для кого маршрут и чего ожидать (не менее 50 символов)', ok: hasDescription },
            { key: 'countries', label: 'Страны маршрута (минимум одна, выбираются на шаге “Маршрут”)', ok: hasCountries },
            { key: 'route', label: 'Маршрут на карте (минимум одна точка на шаге “Маршрут”)', ok: hasRoute },
            { key: 'photos', label: 'Фото или обложка маршрута (рекомендуем горизонтальное изображение, без коллажей)', ok: hasPhotos },
        ];
    }, [formData]);

    const [missingForModeration, setMissingForModeration] = useState<string[]>([]);
    const isNew = !formData.id;

    useEffect(() => {
        trackWizardEvent('wizard_step_view', {
            step: 5,
        });
    }, []);

    const handleSaveDraft = async () => {
        setFormData({
            ...formData,
            publish: false,
            moderation: false,
        });
        setMissingForModeration([]);
        await onManualSave();

        const hasName = !!formData.name && formData.name.trim().length > 0;
        const hasDescription = !!formData.description && formData.description.trim().length > 0;
        const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
        const hasRoute = Array.isArray((formData as any).coordsMeTravel)
            ? ((formData as any).coordsMeTravel as any[]).length > 0
            : Array.isArray((formData as any).markers)
                ? ((formData as any).markers as any[]).length > 0
                : false;
        const galleryArr = Array.isArray((formData as any).gallery)
            ? ((formData as any).gallery as any[])
            : [];
        const hasCover = !!(formData as any).travel_image_thumb_small_url;
        const hasPhotos = hasCover || galleryArr.length > 0;

        await trackWizardEvent('wizard_draft_saved', {
            travel_id: formData.id ?? null,
            step: 5,
            fields_filled: {
                name: hasName,
                description: hasDescription,
                countries: hasCountries,
                markers: hasRoute,
                photos: hasPhotos,
            },
        });
    };

    const handleSendToModeration = async () => {
        const criticalMissing = getModerationErrors({
            name: formData.name ?? '',
            description: formData.description ?? '',
            countries: formData.countries ?? [],
            coordsMeTravel: (formData as any).coordsMeTravel ?? (formData as any).markers ?? [],
            gallery: (formData as any).gallery ?? [],
            travel_image_thumb_small_url: (formData as any).travel_image_thumb_small_url ?? null,
        } as any);

        await trackWizardEvent('wizard_moderation_attempt', {
            missing_fields: criticalMissing,
            is_new: isNew,
            is_edit: !isNew,
            travel_id: formData.id ?? null,
        });

        if (criticalMissing.length > 0) {
            setMissingForModeration(criticalMissing);
            return;
        }

        setMissingForModeration([]);
        setFormData({
            ...formData,
            moderation: true,
        });

        await trackWizardEvent('wizard_moderation_success', {
            travel_id: formData.id ?? null,
            filled_checklist_count: checklist.filter(item => item.ok).length,
            total_checklist_count: checklist.length,
        });

        Toast.show({
            type: 'success',
            text1: 'Маршрут отправлен на модерацию',
            text2: 'После одобрения он появится в разделе “Мои путешествия”.',
        });

        await onFinish();
        router.push('/metravel');
    };

    const handlePrimaryAction = () => {
        if (status === 'draft') {
            handleSaveDraft();
        } else {
            handleSendToModeration();
        }
    };

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <Text style={styles.headerTitle}>Публикация путешествия</Text>
                <Text style={styles.headerSubtitle}>
                    Шаг {currentStep} из {totalSteps} · Публикация и видимость (предыдущий: Детали)
                </Text>
            </View>
            <ScrollView style={styles.content}>
                <FiltersUpsertComponent
                    filters={filters}
                    formData={formData}
                    setFormData={setFormData}
                    travelDataOld={travelDataOld}
                    isSuperAdmin={isSuperAdmin}
                    onSave={onManualSave}
                    showSaveButton={true}
                    showPreviewButton={true}
                    showPublishControls={true}
                />

                <View style={styles.statusCard}>
                    <Text style={styles.statusTitle}>Статус публикации</Text>
                    <View style={styles.statusOptions}>
                        <TouchableOpacity
                            style={[styles.statusOption, status === 'draft' && styles.statusOptionActive]}
                            onPress={() => setStatus('draft')}
                        >
                            <View style={styles.radioOuter}>
                                {status === 'draft' && <View style={styles.radioInner} />}
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Сохранить как черновик</Text>
                                <Text style={styles.statusHint}>
                                    Черновик виден только вам. Его можно дополнять и отправить на модерацию позже.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.statusOption, status === 'moderation' && styles.statusOptionActive]}
                            onPress={() => setStatus('moderation')}
                        >
                            <View style={styles.radioOuter}>
                                {status === 'moderation' && <View style={styles.radioInner} />}
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Отправить на модерацию</Text>
                                <Text style={styles.statusHint}>
                                    Маршрут будет отправлен на модерацию. После одобрения он станет публичным и появится в списке путешествий.
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.checklistCard}>
                    <Text style={styles.checklistTitle}>Чек-лист готовности</Text>
                    {checklist.map(item => (
                        <View key={item.key} style={styles.checklistRow}>
                            <Text style={[styles.checklistStatus, item.ok ? styles.checkOk : styles.checkMissing]}>
                                {item.ok ? '✓' : '•'}
                            </Text>
                            <Text style={styles.checklistLabel}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                {status === 'moderation' && missingForModeration.length > 0 && (
                    <View style={styles.bannerError}>
                        <Text style={styles.bannerTitle}>Нужно дополнить перед модерацией</Text>
                        <Text style={styles.bannerDescription}>
                            Проверьте отмеченные пункты чек-листа. Без них мы не сможем отправить маршрут на модерацию.
                        </Text>
                        {missingForModeration.map(item => (
                            <Text key={item} style={styles.bannerItem}>
                                • {item}
                            </Text>
                        ))}
                    </View>
                )}
            </ScrollView>
            <TravelWizardFooter
                canGoBack={true}
                onBack={onGoBack}
                onPrimary={handlePrimaryAction}
                primaryLabel={status === 'draft' ? 'Сохранить черновик' : 'Отправить на модерацию'}
                onSave={status === 'moderation' ? handleSaveDraft : undefined}
                saveLabel="Сохранить как черновик"
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
        paddingHorizontal: 8,
    },
    footerButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    statusCard: {
        marginTop: 16,
        marginHorizontal: 8,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    statusTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    statusOptions: {
        gap: 8,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
    },
    statusOptionActive: {},
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: 2,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#2563eb',
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    statusHint: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    checklistCard: {
        marginTop: 16,
        marginHorizontal: 8,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    checklistTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    checklistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    checklistStatus: {
        width: 18,
        textAlign: 'center',
        marginRight: 4,
        fontSize: 13,
    },
    checkOk: {
        color: '#16a34a',
    },
    checkMissing: {
        color: '#9ca3af',
    },
    checklistLabel: {
        fontSize: 13,
        color: '#111827',
    },
    bannerError: {
        marginTop: 16,
        marginHorizontal: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    bannerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#b91c1c',
        marginBottom: 4,
    },
    bannerDescription: {
        fontSize: 13,
        color: '#7f1d1d',
        marginBottom: 6,
    },
    bannerItem: {
        fontSize: 13,
        color: '#7f1d1d',
    },
});

export default React.memo(TravelWizardStepPublish);
