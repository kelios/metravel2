import React, { useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
    Linking,
} from 'react-native';
import { Button } from 'react-native-paper';

import MultiSelectField from '@/components/MultiSelectField';
import CheckboxComponent from '@/components/CheckboxComponent';
import ImageUploadComponent from '@/components/imageUpload/ImageUploadComponent';
import { TravelFormData, TravelFilters, Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

const { width } = Dimensions.get('window');
const isMobile = width <= METRICS.breakpoints.tablet;
const MultiSelectFieldAny: any = MultiSelectField;

interface FiltersComponentProps {
    filters: TravelFilters | null;
    formData: TravelFormData | null;
    setFormData: (data: TravelFormData) => void;
    travelDataOld?: Travel | null;
    onClose?: () => void;
    isSuperAdmin?: boolean;
    onSave: () => void;
    showSaveButton?: boolean;
    showPreviewButton?: boolean;
    showPublishControls?: boolean;
    showCountries?: boolean;
    showCategories?: boolean;
    showCoverImage?: boolean;
    showAdditionalFields?: boolean;
}

const FiltersUpsertComponent: React.FC<FiltersComponentProps> = ({
                                                                     filters,
                                                                     formData,
                                                                     setFormData,
                                                                     travelDataOld,
                                                                     onClose,
                                                                     isSuperAdmin = false,
                                                                     onSave,
                                                                     showSaveButton = true,
                                                                     showPreviewButton = true,
                                                                     showPublishControls = true,
                                                                     showCountries = true,
                                                                     showCategories = true,
                                                                     showCoverImage = true,
                                                                     showAdditionalFields = true,
                                                                 }) => {
    if (!formData || !filters) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} />
                <Text>Загрузка фильтров...</Text>
            </View>
        );
    }

    const form: any = formData;

    useEffect(() => {
        // если новая запись — явно фиксируем publish=false,
        // чтобы избежать случайной публикации до модерации
        if (!formData.id && formData.publish !== false) {
            setFormData({ ...formData, publish: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.id]);

    const handleResetFilters = () => {
        setFormData({
            ...(formData as any),
            publish: false,
            moderation: false,
            countries: [],
            categories: [],
            transports: [],
            complexity: [],
            companions: [],
            over_nights_stay: [],
            month: [],
            visa: false,
            year: '',
            number_peoples: '',
            number_days: '',
            budget: '',
            travel_image_thumb_small_url: '', // очищаем картинку
        } as any);
    };

    const openPreview = () => {
        if (!form.slug) return;
        const url = `/travels/${form.slug}`;
        if (Platform.OS === 'web') {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            Linking.openURL(`https://metravel.by${url}`).catch(() => {});
        }
    };


    return (
        <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            style={[styles.container, isMobile && { minHeight: '100%' }]}
            keyboardShouldPersistTaps="handled"
        >
            {onClose && isMobile && (
                <TouchableOpacity onPress={() => onClose()} style={styles.closeIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.closeButtonText}>✖</Text>
                </TouchableOpacity>
            )}

            {showSaveButton && (
                <Button
                    mode="contained"
                    icon="content-save"
                    onPress={onSave}
                    style={styles.saveButton}
                    accessibilityRole="button"
                    accessibilityLabel="Сохранить изменения"
                >
                    Сохранить сейчас
                </Button>
            )}

            {showPreviewButton && form.slug ? (
                <Button
                    mode="outlined"
                    icon="open-in-new"
                    onPress={openPreview}
                    style={styles.floatingIconButton}
                    accessibilityRole="link"
                    accessibilityLabel="Открыть предпросмотр маршрута"
                >
                    Предпросмотр
                </Button>
            ) : null}


            {showPublishControls && (
                <>
                    <CheckboxComponent
                        label="Сохранить как черновик"
                        value={!formData.publish}
                        onChange={(value) => setFormData({ ...formData, publish: !value })}
                    />

                    {isSuperAdmin && (
                        <CheckboxComponent
                            label="Прошел модерацию"
                            value={formData.moderation ?? false}
                            onChange={(value) => setFormData({ ...formData, moderation: value })}
                        />
                    )}
                </>
            )}

            {showCoverImage && formData.id && (
                <View style={styles.imageUploadWrapper}>
                    <ImageUploadComponent
                        collection="travelMainImage"
                        idTravel={formData.id}
                        oldImage={
                            form.travel_image_thumb_small_url?.length
                                ? form.travel_image_thumb_small_url
                                : (travelDataOld as any)?.travel_image_thumb_small_url ?? null
                        }
                    />
                    <Text style={styles.coverHint}>
                        Рекомендуем горизонтальное изображение (соотношение сторон 16:9), без коллажей и текста на картинке.
                    </Text>
                </View>
            )}

            {showCountries && (
                <MultiSelectFieldAny
                    label="Страны для путешествия *"
                    items={filters.countries}
                    value={formData.countries ?? []}
                    onChange={(countries: any) => setFormData({ ...formData, countries })}
                    labelField="title_ru"
                    valueField="country_id"
                />
            )}

            {showCategories && (
                <View nativeID="travelwizard-publish-categories">
                    <MultiSelectFieldAny
                        label="Категории путешествий *"
                        items={filters.categories}
                        value={formData.categories ?? []}
                        onChange={(categories: any) => setFormData({ ...formData, categories })}
                        labelField="name"
                        valueField="id"
                    />
                </View>
            )}

            {showAdditionalFields && (
                <>
                    <MultiSelectFieldAny
                        label="Средства передвижения"
                        items={filters.transports}
                        value={formData.transports ?? []}
                        onChange={(transports: any) => setFormData({ ...formData, transports })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Физическая подготовка"
                        items={filters.complexity}
                        value={formData.complexity ?? []}
                        onChange={(complexity: any) => setFormData({ ...formData, complexity })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Путешествуете с..."
                        items={filters.companions}
                        value={formData.companions ?? []}
                        onChange={(companions: any) => setFormData({ ...formData, companions })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Ночлег..."
                        items={filters.over_nights_stay}
                        value={formData.over_nights_stay ?? []}
                        onChange={(over_nights_stay: any) => setFormData({ ...formData, over_nights_stay })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Месяц путешествия"
                        items={filters.month}
                        value={formData.month ?? []}
                        onChange={(month: any) => setFormData({ ...formData, month })}
                        labelField="name"
                        valueField="id"
                    />

                    {renderNumericInput('Год путешествия', 'year')}
                    <CheckboxComponent
                        label="Требуется виза"
                        value={formData.visa ?? false}
                        onChange={(visa) => setFormData({ ...formData, visa })}
                    />
                    {renderNumericInput('Количество участников', 'number_peoples')}
                    {renderNumericInput('Длительность (дней)', 'number_days')}
                    {renderNumericInput('Бюджет (руб.)', 'budget')}
                </>
            )}
        </ScrollView>
    );

    // Поле, принимающее только цифры
    function renderNumericInput(label: string, field: keyof TravelFormData) {
        const current = formData as TravelFormData;
        return (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                    style={styles.input}
                    value={(current[field] as any)?.toString?.() ?? ''}
                    onChangeText={(value) => {
                        // только цифры (чтобы не разъезжались типы на бэке)
                        const digits = value.replace(/[^\d]/g, '');
                        setFormData({ ...(current as any), [field]: digits } as TravelFormData);
                    }}
                    placeholder={`Введите ${label.toLowerCase()}`}
                    keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric', default: 'numeric' })}
                    inputMode="numeric"
                />
            </View>
        );
    }
};

const styles = StyleSheet.create({
    container: {
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        flex: 1,
    },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: DESIGN_TOKENS.spacing.xxs },
    imageUploadWrapper: { alignItems: 'center', marginVertical: 12 },
    coverHint: {
        marginTop: 8,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        textAlign: 'center',
    },

    inputGroup: { marginBottom: 12 },
    input: {
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        padding: DESIGN_TOKENS.spacing.sm,
        borderRadius: DESIGN_TOKENS.radii.sm,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        color: DESIGN_TOKENS.colors.text,
    },
    label: {
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        marginBottom: 4,
        color: DESIGN_TOKENS.colors.text,
    },

    resetButton: { marginTop: DESIGN_TOKENS.spacing.lg, borderColor: DESIGN_TOKENS.colors.warning },

    closeIcon: {
        position: 'absolute',
        top: -16,
        right: -14,
        backgroundColor: DESIGN_TOKENS.colors.danger,
        borderRadius: 12,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    closeButtonText: {
        color: DESIGN_TOKENS.colors.textInverse,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        lineHeight: 12,
    },

    saveButton: {
        backgroundColor: DESIGN_TOKENS.colors.primary,
        borderRadius: 12,
        marginBottom: 12,
    },
    floatingIconButton: {
        minWidth: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: DESIGN_TOKENS.colors.surface,
        elevation: 3,
        marginBottom: 12,
    },
});

export default FiltersUpsertComponent;
