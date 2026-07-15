import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Button } from '@/ui/paper';
import ButtonBase from '@/components/ui/Button';

import MultiSelectField from '@/components/forms/MultiSelectField';
import CheckboxComponent from '@/components/forms/CheckboxComponent';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import { TravelFormData, TravelFilters, Travel } from '@/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import { useResponsive } from '@/hooks/useResponsive';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { parseTravelStatusDateParts, useTravelStatusStore } from '@/stores/travelStatusStore';
import { useAuthStore } from '@/stores/authStore';
import { translate as i18nT } from '@/i18n'


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
    const userId = useAuthStore((state) => state.userId);
    const { getStatus, setStatus } = useTravelStatusStore();
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
    const currentCalendarStatus = form?.id ? getStatus(form.id) : undefined;

    useEffect(() => {
        if (!formData?.id) return;
        if (formData.visitedDate) return;
        const currentVisitedDate = currentCalendarStatus?.status === 'visited'
            ? currentCalendarStatus.visitedDate
            : undefined;
        if (!currentVisitedDate) return;
        handleFieldChange('visitedDate', currentVisitedDate);
    }, [currentCalendarStatus?.status, currentCalendarStatus?.visitedDate, formData?.id, formData?.visitedDate, handleFieldChange]);

    const openPreview = useCallback(() => {
        const slug = form?.slug;
        if (!slug) return;
        const url = `/travels/${slug}`;
        void openExternalUrlInNewTab(url, {
            allowRelative: true,
            baseUrl: 'https://metravel.by',
            onError: (error) => {
                if (__DEV__) {
                    console.warn('[FiltersUpsertComponent] Не удалось открыть URL:', error);
                }
            },
        });
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
    const handleVisitedDateChange = useCallback((value: string) => {
        const normalized = value.trim();
        handleFieldChange('visitedDate', normalized);
        if (!form?.id || !parseTravelStatusDateParts(normalized)) return;
        void setStatus(
            {
                id: form.id,
                type: 'travel',
                title: form.name || travelDataOld?.name || i18nT('travel:common.untitled'),
                url: form.slug ? `/travels/${form.slug}` : `/travels/${form.id}`,
                imageUrl:
                    form.travel_image_thumb_url ||
                    form.travel_image_thumb_small_url ||
                    travelDataOld?.travel_image_thumb_url ||
                    travelDataOld?.travel_image_thumb_small_url ||
                    undefined,
                country: travelDataOld?.countryName || undefined,
                city: travelDataOld?.cityName || undefined,
                status: 'visited',
                visitedDate: normalized,
                travelYear: form.year,
                travelMonth: form.month,
                travelMonthName: travelDataOld?.monthName,
            },
            userId
        );
    }, [form?.id, form?.name, form?.slug, form?.travel_image_thumb_url, form?.travel_image_thumb_small_url, form?.year, form?.month, handleFieldChange, setStatus, travelDataOld, userId]);

    if (isLoading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.primaryDark} />
                <Text style={styles.loadingText}>{i18nT('travel:components.travel.FiltersUpsertComponent.zagruzka_filtrov_fbb6fa5e')}</Text>
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
                    label={i18nT('travel:components.travel.FiltersUpsertComponent.x_c2692853')}
                    onPress={() => onClose()}
                    variant="ghost"
                    size="sm"
                    style={styles.closeIcon}
                    labelStyle={styles.closeButtonText}
                    accessibilityLabel={i18nT('travel:components.travel.FiltersUpsertComponent.zakryt_abd8267c')}
                />
            )}

            {showSaveButton && (
                <Button
                    mode="contained"
                    icon="content-save"
                    onPress={onSave}
                    style={styles.saveButton}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('travel:components.travel.FiltersUpsertComponent.sohranit_izmeneniya_573b2df9')}
                >
                    {i18nT('travel:components.travel.FiltersUpsertComponent.sohranit_cffd4fdc')}</Button>
            )}

            {showPreviewButton && form.slug ? (
                <Button
                    mode="outlined"
                    icon="open-in-new"
                    onPress={openPreview}
                    style={styles.floatingIconButton}
                    accessibilityRole="link"
                    accessibilityLabel={i18nT('travel:components.travel.FiltersUpsertComponent.otkryt_predprosmotr_marshruta_414a7689')}
                >
                    {i18nT('travel:components.travel.FiltersUpsertComponent.predprosmotr_675c70ff')}</Button>
            ) : null}


            {showPublishControls && (
                <>
                    <CheckboxComponent
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.sohranit_kak_chernovik_b35d78e8')}
                        value={!form.publish}
                        onChange={(value) => handleFieldChange('publish', !value)}
                    />

                    {isSuperAdmin && (
                        <CheckboxComponent
                            label={i18nT('travel:components.travel.FiltersUpsertComponent.proshel_moderatsiyu_b3cab7a8')}
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
                        placeholder={i18nT('travel:components.travel.FiltersUpsertComponent.peretaschite_oblozhku_puteshestviya_f3680ef2')}
                        maxSizeMB={10}
                    />
                    <Text style={styles.coverHint}>
                        {i18nT('travel:components.travel.FiltersUpsertComponent.rekomenduem_gorizontalnoe_izobrazhenie_sootn_fb2cc121')}</Text>
                </View>
            )}

            {showCountries && (
                <MultiSelectFieldAny
                    label={i18nT('travel:components.travel.FiltersUpsertComponent.strany_dlya_puteshestviya_e9cfa1f6')}
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
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.kategorii_puteshestviy_c0a00d10')}
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
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.sredstva_peredvizheniya_548015cd')}
                    items={resolvedTransports}
                        value={form.transports ?? []}
                        onChange={handleTransportsChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.fizicheskaya_podgotovka_d7610a5a')}
                    items={resolvedComplexity}
                        value={form.complexity ?? []}
                        onChange={handleComplexityChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.s_kem_puteshestvuete_04f7938b')}
                    items={resolvedCompanions}
                        value={form.companions ?? []}
                        onChange={handleCompanionsChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.tip_nochlega_446b0177')}
                    items={resolvedOvernights}
                        value={form.over_nights_stay ?? []}
                        onChange={handleOvernightsChange}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.mesyats_puteshestviya_68091083')}
                    items={resolvedMonth}
                        value={form.month ?? []}
                        onChange={handleMonthChange}
                        labelField="name"
                        valueField="id"
                    />

                    {renderNumericInput(i18nT('travel:components.travel.FiltersUpsertComponent.god_puteshestviya_ad173b35'), 'year')}
                    {renderVisitedDateInput()}
                    <CheckboxComponent
                        label={i18nT('travel:components.travel.FiltersUpsertComponent.trebuetsya_viza_904fcbb9')}
                        value={form.visa ?? false}
                        onChange={handleVisaChange}
                    />
                    {renderNumericInput(i18nT('travel:components.travel.FiltersUpsertComponent.kolichestvo_uchastnikov_e94e6a74'), 'number_peoples')}
                    {renderNumericInput(i18nT('travel:components.travel.FiltersUpsertComponent.dlitelnost_dney_dcce1646'), 'number_days')}
                    {renderNumericInput(i18nT('travel:components.travel.FiltersUpsertComponent.byudzhet_rub_3eae045b'), 'budget')}
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
                    placeholder={i18nT('travel:components.travel.FiltersUpsertComponent.vvedite_value1_fdb230f6', { value1: label.toLowerCase() })}
                    keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric', default: 'numeric' })}
                    inputMode="numeric"
                />
            </View>
        );
    }

    function renderVisitedDateInput() {
        const value = String(form.visitedDate ?? '');
        const isInvalid = value.length > 0 && !parseTravelStatusDateParts(value);

        return (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18nT('travel:components.travel.FiltersUpsertComponent.data_kogda_byl_a_3d68a928')}</Text>
                {Platform.OS === 'web' ? (
                    <input
                        type="date"
                        value={parseTravelStatusDateParts(value) ? value : ''}
                        onChange={(event) => handleVisitedDateChange(event.target.value)}
                        aria-label={i18nT('travel:components.travel.FiltersUpsertComponent.data_kogda_byl_v_puteshestvii_ceab8b37')}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: 15,
                            borderRadius: 8,
                            border: `1px solid ${isInvalid ? colors.danger : 'var(--color-border)'}`,
                            backgroundColor: 'var(--color-background)',
                            color: 'var(--color-text)',
                            outline: 'none',
                            boxSizing: 'border-box',
                        } as React.CSSProperties}
                    />
                ) : (
                    <TextInput
                        style={[styles.input, isInvalid && styles.inputInvalid]}
                        value={value}
                        onChangeText={handleVisitedDateChange}
                        placeholder={i18nT('travel:components.travel.FiltersUpsertComponent.gggg_mm_dd_ab72b205')}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numbers-and-punctuation"
                        maxLength={10}
                        accessibilityLabel={i18nT('travel:components.travel.FiltersUpsertComponent.data_kogda_byl_v_puteshestvii_ceab8b37')}
                    />
                )}
                <Text style={styles.fieldHint}>
                    {i18nT('travel:components.travel.FiltersUpsertComponent.esli_tochnaya_data_ne_ukazana_kalendar_otnes_80347012')}</Text>
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
    inputInvalid: {
        borderColor: colors.danger,
    },
    label: {
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        marginBottom: 4,
        color: colors.text, // ✅ ДИЗАЙН: Динамический цвет текста
    },
    fieldHint: {
        marginTop: 4,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        lineHeight: 16,
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
