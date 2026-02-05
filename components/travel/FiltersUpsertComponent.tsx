import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Platform,
    Linking,
} from 'react-native';
import { Button } from '@/src/ui/paper';
import ButtonBase from '@/components/ui/Button';

import MultiSelectField from '@/components/MultiSelectField';
import CheckboxComponent from '@/components/CheckboxComponent';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import { TravelFormData, TravelFilters, Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import { useResponsive } from '@/hooks/useResponsive';

const MultiSelectFieldAny: any = MultiSelectField;


function normalizeTravelCategoriesLocal(raw: any): Array<{ id: string; name: string }> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item, idx) => {
            if (item && typeof item === 'object') {
                const id = (item as any).id ?? (item as any).value ?? (item as any).category_id ?? (item as any).pk ?? idx;
                const name =
                    (item as any).name ??
                    (item as any).name_ru ??
                    (item as any).title_ru ??
                    (item as any).title ??
                    (item as any).text ??
                    String(id);
                return { id: String(id), name: String(name) };
            }
            return { id: String(idx), name: String(item) };
        })
        .filter(Boolean);
}

function normalizeIdNameList(raw: any): Array<{ id: string; name: string }> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item, idx) => {
            if (item && typeof item === 'object') {
                const id = (item as any).id ?? (item as any).value ?? (item as any).pk ?? idx;
                const name = (item as any).name ?? (item as any).title ?? (item as any).text ?? String(id);
                return { id: String(id), name: String(name) };
            }
            return { id: String(idx), name: String(item) };
        })
        .filter(Boolean);
}

function normalizeCountriesLocal(raw: any): Array<{ country_id: string; title_ru: string; title_en?: string }> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item, idx) => {
            if (item && typeof item === 'object') {
                const id = (item as any).country_id ?? (item as any).id ?? (item as any).pk ?? idx;
                const titleRu = (item as any).title_ru ?? (item as any).name_ru ?? (item as any).name ?? String(id);
                const titleEn = (item as any).title_en ?? (item as any).name_en;
                const normalized: any = {
                    country_id: String(id),
                    title_ru: String(titleRu),
                };
                if (titleEn != null) normalized.title_en = String(titleEn);
                return normalized;
            }
            return { country_id: String(idx), title_ru: String(item) };
        })
        .filter(Boolean);
}

interface FiltersComponentProps {
    filters: TravelFilters | null;
    formData: TravelFormData | null;
    setFormData: (data: TravelFormData) => void;
    travelDataOld?: Travel | null;
    onClose?: () => void;
    isSuperAdmin?: boolean;
    onSave: () => void;
    onFieldChange?: (field: keyof TravelFormData, value: any) => void;
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
                                                                     onFieldChange,
                                                                     showSaveButton = true,
                                                                     showPreviewButton = true,
                                                                     showPublishControls = true,
                                                                     showCountries = true,
                                                                     showCategories = true,
                                                                     showCoverImage = true,
                                                                     showAdditionalFields = true,
                                                                 }) => {
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const isLoading = !formData || !filters;

    const styles = useMemo(() => createStyles(colors), [colors]);

    const normalizedInput: any = useMemo(() => {
        if (!filters) return {};
        const resolvedFilters: any = filters as any;
        const maybeNormalized =
            (resolvedFilters as any)?.data?.filters ?? (resolvedFilters as any)?.data ?? resolvedFilters;
        return maybeNormalized ?? {};
    }, [filters]);

    // Memoize raw data access
    const rawData = useMemo(
        () => ({
            categories:
                normalizedInput.categories ??
                (normalizedInput as any).categoriesTravel ??
                (normalizedInput as any).categories_travel ??
                [],
            transports: normalizedInput.transports ?? (normalizedInput as any).transportsTravel ?? [],
            complexity: normalizedInput.complexity ?? (normalizedInput as any).complexityTravel ?? [],
            companions: normalizedInput.companions ?? (normalizedInput as any).companionsTravel ?? [],
            overnights:
                normalizedInput.over_nights_stay ??
                (normalizedInput as any).overNightsStay ??
                (normalizedInput as any).overnights ??
                [],
            month: normalizedInput.month ?? (normalizedInput as any).months ?? [],
            countries: normalizedInput.countries || [],
        }),
        [normalizedInput]
    );

    // Memoize normalized lists
    const resolvedCategories = useMemo(
        () => normalizeTravelCategoriesLocal(rawData.categories),
        [rawData.categories]
    );
    const resolvedTransports = useMemo(() => normalizeIdNameList(rawData.transports), [rawData.transports]);
    const resolvedComplexity = useMemo(() => normalizeIdNameList(rawData.complexity), [rawData.complexity]);
    const resolvedCompanions = useMemo(() => normalizeIdNameList(rawData.companions), [rawData.companions]);
    const resolvedOvernights = useMemo(() => normalizeIdNameList(rawData.overnights), [rawData.overnights]);
    const resolvedMonth = useMemo(() => normalizeIdNameList(rawData.month), [rawData.month]);
    const resolvedCountries = useMemo(
        () => normalizeCountriesLocal(rawData.countries),
        [rawData.countries]
    );

    // Keep a ref to the latest formData so the callback stays stable.
    const formDataRef = useRef(formData);
    formDataRef.current = formData;

    // Local handler fallback if onFieldChange is not provided
    const handleFieldChange = useCallback((field: keyof TravelFormData, value: any) => {
        if (onFieldChange) {
            onFieldChange(field, value);
        } else if (formDataRef.current) {
            setFormData({ ...formDataRef.current, [field]: value });
        }
    }, [onFieldChange, setFormData]);

    useEffect(() => {
        // если новая запись — явно фиксируем publish=false,
        // чтобы избежать случайной публикации до модерации
        if (!formData) return;
        if (!formData.id && formData.publish !== false) {
            handleFieldChange('publish', false);
        }
    }, [formData, handleFieldChange]);

    const form: any = formData;

    const openPreview = useCallback(() => {
        const slug = form?.slug;
        if (!slug) return;
        const url = `/travels/${slug}`;
        if (Platform.OS === 'web') {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            Linking.openURL(`https://metravel.by${url}`).catch((error) => {
                if (__DEV__) {
                    console.warn('[FiltersUpsertComponent] Не удалось открыть URL:', error);
                }
            });
        }
    }, [form?.slug]);

    // Memoized handlers for MultiSelectFields
    const handleCountriesChange = useCallback((v: any) => handleFieldChange('countries', v), [handleFieldChange]);
    const handleCategoriesChange = useCallback((v: any) => handleFieldChange('categories', v), [handleFieldChange]);
    const handleTransportsChange = useCallback((v: any) => handleFieldChange('transports', v), [handleFieldChange]);
    const handleComplexityChange = useCallback(
        (v: any) => handleFieldChange('complexity', v),
        [handleFieldChange]
    );
    const handleCompanionsChange = useCallback(
        (v: any) => handleFieldChange('companions', v),
        [handleFieldChange]
    );
    const handleOvernightsChange = useCallback(
        (v: any) => handleFieldChange('over_nights_stay', v),
        [handleFieldChange]
    );
    const handleMonthChange = useCallback((v: any) => handleFieldChange('month', v), [handleFieldChange]);
    const handleVisaChange = useCallback((v: any) => handleFieldChange('visa', v), [handleFieldChange]);

    if (isLoading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Загрузка фильтров...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            style={[styles.container, isMobile && { minHeight: '100%' }]}
            keyboardShouldPersistTaps="handled"
        >
            {onClose && isMobile && (
                <ButtonBase
                    label="X"
                    onPress={() => onClose()}
                    variant="ghost"
                    size="sm"
                    style={styles.closeIcon}
                    labelStyle={styles.closeButtonText}
                    accessibilityLabel="Закрыть"
                />
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
                    Сохранить
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
                        value={!form.publish}
                        onChange={(value) => handleFieldChange('publish', !value)}
                    />

                    {isSuperAdmin && (
                        <CheckboxComponent
                            label="Прошел модерацию"
                            value={form.moderation ?? false}
                            onChange={(value) => handleFieldChange('moderation', value)}
                        />
                    )}
                </>
            )}

            {showCoverImage && (
                <View style={styles.imageUploadWrapper}>
                    <PhotoUploadWithPreview
                        collection="travelMainImage"
                        idTravel={form.id ?? null}
                        oldImage={
                            form.travel_image_thumb_small_url?.length
                                ? form.travel_image_thumb_small_url
                                : (travelDataOld as any)?.travel_image_thumb_small_url ?? null
                        }
                        placeholder="Перетащите обложку путешествия"
                        maxSizeMB={10}
                    />
                    <Text style={styles.coverHint}>
                        Рекомендуем горизонтальное изображение (соотношение сторон 16:9), без коллажей и текста на картинке.
                    </Text>
                </View>
            )}

            {showCountries && (
                <MultiSelectFieldAny
                    label="Страны для путешествия *"
                    items={resolvedCountries}
                    value={form.countries ?? []}
                    onChange={handleCountriesChange}
                    labelField="title_ru"
                    valueField="country_id"
                />
            )}

            {showCategories && (
                <View nativeID="travelwizard-publish-categories">
                    <MultiSelectFieldAny
                        label="Категории путешествий *"
                        items={resolvedCategories}
                        value={form.categories ?? []}
                        onChange={handleCategoriesChange}
                        labelField="name"
                        valueField="id"
                    />
                </View>
            )}

            {showAdditionalFields && (
                <>
                    <MultiSelectFieldAny
                        label="Средства передвижения"
                    items={resolvedTransports}
                        value={form.transports ?? []}
                        onChange={handleTransportsChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Физическая подготовка"
                    items={resolvedComplexity}
                        value={form.complexity ?? []}
                        onChange={handleComplexityChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Путешествуете с..."
                    items={resolvedCompanions}
                        value={form.companions ?? []}
                        onChange={handleCompanionsChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Ночлег..."
                    items={resolvedOvernights}
                        value={form.over_nights_stay ?? []}
                        onChange={handleOvernightsChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Месяц путешествия"
                    items={resolvedMonth}
                        value={form.month ?? []}
                        onChange={handleMonthChange}
                        labelField="name"
                        valueField="id"
                    />

                    {renderNumericInput('Год путешествия', 'year')}
                    <CheckboxComponent
                        label="Требуется виза"
                        value={form.visa ?? false}
                        onChange={handleVisaChange}
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
        const current = form as TravelFormData;
        const fieldValue = (current[field] as any)?.toString?.() ?? '';
        
        return (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                    style={styles.input}
                    value={fieldValue}
                    onChangeText={(value) => {
                        const digits = value.replace(/[^\d]/g, '');
                        if (digits !== fieldValue) {
                            handleFieldChange(field, digits);
                        }
                    }}
                    placeholder={`Введите ${label.toLowerCase()}`}
                    keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric', default: 'numeric' })}
                    inputMode="numeric"
                />
            </View>
        );
    }
};

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface, // ✅ ДИЗАЙН: Динамический цвет фона
        flex: 1,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: DESIGN_TOKENS.spacing.xxs
    },
    loadingText: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.textMuted, // ✅ ДИЗАЙН: Динамический цвет текста
    },
    imageUploadWrapper: {
        alignItems: 'center',
        marginVertical: 12
    },
    coverHint: {
        marginTop: 8,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted, // ✅ ДИЗАЙН: Динамический цвет текста
        textAlign: 'center',
    },

    inputGroup: { marginBottom: 12 },
    input: {
        borderWidth: 1,
        borderColor: colors.border, // ✅ ДИЗАЙН: Динамический цвет границы
        padding: DESIGN_TOKENS.spacing.sm,
        borderRadius: DESIGN_TOKENS.radii.sm,
        backgroundColor: colors.surface, // ✅ ДИЗАЙН: Динамический цвет фона
        color: colors.text, // ✅ ДИЗАЙН: Динамический цвет текста
    },
    label: {
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        marginBottom: 4,
        color: colors.text, // ✅ ДИЗАЙН: Динамический цвет текста
    },

    resetButton: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        borderColor: colors.warning, // ✅ ДИЗАЙН: Динамический цвет границы
    },

    closeIcon: {
        position: 'absolute',
        top: -16,
        right: -14,
        backgroundColor: colors.danger, // ✅ ДИЗАЙН: Динамический цвет фона
        borderRadius: 22,
        width: 44,
        height: 44,
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 0,
        paddingVertical: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    closeButtonText: {
        color: colors.textInverse, // ✅ ДИЗАЙН: Динамический цвет текста
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        lineHeight: 12,
    },

    saveButton: {
        backgroundColor: colors.primary, // ✅ ДИЗАЙН: Динамический цвет фона
        borderRadius: 12,
        marginBottom: 12,
    },
    floatingIconButton: {
        minWidth: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface, // ✅ ДИЗАЙН: Динамический цвет фона
        elevation: 3,
        marginBottom: 12,
    },
});

export default React.memo(FiltersUpsertComponent);
