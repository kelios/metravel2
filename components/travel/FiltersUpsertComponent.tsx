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
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import { TravelFormData, TravelFilters, Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

const { width } = Dimensions.get('window');
const isMobile = width <= METRICS.breakpoints.tablet;
const MultiSelectFieldAny: any = MultiSelectField;

function resolveFirstArray(source: any, keys: string[]) {
    const rootCandidates = [source, source?.data, source?.result, source?.filters, source?.payload].filter(Boolean);

    const visited = new Set<any>();
    const queue: Array<{ node: any; depth: number }> = rootCandidates.map((n) => ({ node: n, depth: 0 }));
    const MAX_DEPTH = 4;

    while (queue.length) {
        const { node, depth } = queue.shift()!;
        if (!node || typeof node !== 'object') continue;
        if (visited.has(node)) continue;
        visited.add(node);

        for (const k of keys) {
            const v = (node as any)[k];
            if (Array.isArray(v)) return v;
        }

        if (depth >= MAX_DEPTH) continue;

        if (Array.isArray(node)) {
            // Do not traverse arrays deeply; we only care about arrays at expected keys.
            continue;
        }

        for (const child of Object.values(node)) {
            if (child && typeof child === 'object' && !visited.has(child)) {
                queue.push({ node: child, depth: depth + 1 });
            }
        }
    }

    return [];
}

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

function normalizeCategoryTravelAddressLocal(raw: any): Array<{ id: string; name: string }> {
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
    const isLoading = !formData || !filters;

    useEffect(() => {
        // если новая запись — явно фиксируем publish=false,
        // чтобы избежать случайной публикации до модерации
        if (!formData) return;
        if (!formData.id && formData.publish !== false) {
            setFormData({ ...formData, publish: false });
        }
    }, [formData, setFormData]);

    if (isLoading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} />
                <Text>Загрузка фильтров...</Text>
            </View>
        );
    }

    const form: any = formData!;
    const resolvedFilters = filters!;

    const rawCategories = resolveFirstArray(resolvedFilters, ['categories', 'categoriesTravel', 'travelCategories']);
    const rawTransports = resolveFirstArray(resolvedFilters, ['transports', 'transportsTravel']);
    const rawComplexity = resolveFirstArray(resolvedFilters, ['complexity', 'complexityTravel']);
    const rawCompanions = resolveFirstArray(resolvedFilters, ['companions', 'companionsTravel']);
    const rawOvernights = resolveFirstArray(resolvedFilters, ['over_nights_stay', 'overNightsStay']);
    const rawMonth = resolveFirstArray(resolvedFilters, ['month', 'months']);
    const rawCategoryTravelAddress = resolveFirstArray(resolvedFilters, ['categoryTravelAddress', 'category_travel_address', 'categoryPoints', 'pointCategories']);
    const rawCountries = resolveFirstArray(resolvedFilters, ['countries']);

    let resolvedCategories = normalizeTravelCategoriesLocal(rawCategories);
    if (!resolvedCategories || resolvedCategories.length === 0) {
        resolvedCategories = [
            { id: '1', name: 'Горы' },
            { id: '2', name: 'Море' },
            { id: '3', name: 'Города' },
            { id: '4', name: 'Природа' },
        ];
    }

    const resolvedTransports = normalizeIdNameList(rawTransports);
    const resolvedComplexity = normalizeIdNameList(rawComplexity);
    const resolvedCompanions = normalizeIdNameList(rawCompanions);
    const resolvedOvernights = normalizeIdNameList(rawOvernights);
    const resolvedMonth = normalizeIdNameList(rawMonth);
    const resolvedCategoryTravelAddress = normalizeCategoryTravelAddressLocal(rawCategoryTravelAddress);
    const resolvedCountries = normalizeCountriesLocal(rawCountries);

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
                        value={!form.publish}
                        onChange={(value) => setFormData({ ...form, publish: !value })}
                    />

                    {isSuperAdmin && (
                        <CheckboxComponent
                            label="Прошел модерацию"
                            value={form.moderation ?? false}
                            onChange={(value) => setFormData({ ...form, moderation: value })}
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
                    onChange={(countries: any) => setFormData({ ...form, countries })}
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
                        onChange={(categories: any) => setFormData({ ...form, categories })}
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
                        onChange={(transports: any) => setFormData({ ...form, transports })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Физическая подготовка"
                    items={resolvedComplexity}
                        value={form.complexity ?? []}
                        onChange={(complexity: any) => setFormData({ ...form, complexity })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Путешествуете с..."
                    items={resolvedCompanions}
                        value={form.companions ?? []}
                        onChange={(companions: any) => setFormData({ ...form, companions })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Ночлег..."
                    items={resolvedOvernights}
                        value={form.over_nights_stay ?? []}
                        onChange={(over_nights_stay: any) => setFormData({ ...form, over_nights_stay })}
                        labelField="name"
                        valueField="id"
                    />

                    <MultiSelectFieldAny
                        label="Месяц путешествия"
                    items={resolvedMonth}
                        value={form.month ?? []}
                        onChange={(month: any) => setFormData({ ...form, month })}
                        labelField="name"
                        valueField="id"
                    />

                    {renderNumericInput('Год путешествия', 'year')}
                    <CheckboxComponent
                        label="Требуется виза"
                        value={form.visa ?? false}
                        onChange={(visa) => setFormData({ ...form, visa })}
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
