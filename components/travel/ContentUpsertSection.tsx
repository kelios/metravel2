import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, SafeAreaView, StyleSheet, ScrollView, Text } from 'react-native';
import { TravelFormData, MarkerData } from '@/src/types/types';
import TextInputComponent from '@/components/TextInputComponent';
import YoutubeLinkComponent from '@/components/YoutubeLinkComponent';
import WebMapComponent from '@/components/travel/WebMapComponent';
import ArticleEditor from '@/components/ArticleEditor';
import { validateTravelForm, getFieldError, type ValidationError } from '@/utils/formValidation';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface Filters {
    categoryTravelAddress: any[];
    countries: any[];
}

interface ContentUpsertSectionProps {
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    markers: MarkerData[];
    setMarkers: (data: MarkerData[]) => void;
    filters: Filters;
    handleCountrySelect: (countryId: string) => void;
    handleCountryDeselect: (countryId: string) => void;
}

const ContentUpsertSection: React.FC<ContentUpsertSectionProps> = ({
                                                                       formData,
                                                                       setFormData,
                                                                       markers,
                                                                       setMarkers,
                                                                       filters,
                                                                       handleCountrySelect,
                                                                       handleCountryDeselect,
                                                                   }) => {
    // ✅ УЛУЧШЕНИЕ: Валидация в реальном времени
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

    // Валидация при изменении данных
    useEffect(() => {
        const result = validateTravelForm({
            name: formData.name,
            description: formData.description,
            countries: formData.countries,
            categories: formData.categories,
            coordsMeTravel: markers,
            year: formData.year,
            number_days: formData.number_days,
            number_peoples: formData.number_peoples,
            youtube_link: formData.youtube_link,
        } as any);
        setValidationErrors(result.errors);
    }, [formData, markers]);

    const handleChange = useCallback(
        <T extends keyof TravelFormData>(name: T, value: TravelFormData[T]) => {
            setFormData(prev => ({ ...prev, [name]: value }));
            // Отмечаем поле как "тронутое" для показа ошибок
            setTouchedFields(prev => new Set(prev).add(name as string));
        },
        [setFormData]
    );

    // Получить ошибку для поля (показываем только если поле было "тронуто")
    const getError = useCallback((field: string) => {
        if (!touchedFields.has(field)) return null;
        return getFieldError(field, validationErrors);
    }, [touchedFields, validationErrors]);

    // Прогресс заполнения формы
    const formProgress = useMemo(() => {
        const requiredFields = ['name', 'description', 'countries', 'categories', 'coordsMeTravel'];
        const filledFields = requiredFields.filter(field => {
            if (field === 'coordsMeTravel') return markers && markers.length > 0;
            const value = (formData as any)[field];
            if (Array.isArray(value)) return value.length > 0;
            return value && String(value).trim().length > 0;
        });
        return Math.round((filledFields.length / requiredFields.length) * 100);
    }, [formData, markers]);

    const handleMarkersChange = useCallback(
        (updatedMarkers: MarkerData[]) => {
            setMarkers(updatedMarkers);
            setFormData(prev => ({
                ...prev,
                coordsMeTravel: updatedMarkers.map(m => ({
                    id: m.id,
                    lat: m.lat,
                    lng: m.lng,
                    country: m.country,
                    address: m.address,
                    categories: m.categories,
                    image: m.image,
                })),
            }));
        },
        [setMarkers, setFormData]
    );

    const idTravelStr = useMemo(
        () => (formData?.id != null ? String(formData.id) : undefined),
        [formData?.id]
    );

    const renderEditorSection = useCallback(
        (
            title: string, 
            content: string | undefined | null, 
            onChange: (val: string) => void,
            error: string | null = null,
            required: boolean = false,
            hint?: string
        ) => (
            <View style={styles.sectionEditor}>
                <View style={styles.editorHeader}>
                    <Text style={styles.editorLabel}>
                        {title}
                        {required && <Text style={styles.required}> *</Text>}
                    </Text>
                    {hint && (
                        <Text style={styles.editorHint}>{hint}</Text>
                    )}
                </View>
                <ArticleEditor
                    key={`${title}-${idTravelStr ?? 'new'}`}
                    label={title}
                    content={content ?? ''}
                    onChange={onChange}
                    idTravel={idTravelStr}
                />
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
            </View>
        ),
        [idTravelStr]
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ УЛУЧШЕНИЕ: Прогресс заполнения формы */}
                <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Прогресс заполнения</Text>
                        <Text style={styles.progressPercent}>{formProgress}%</Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${formProgress}%` }]} />
                    </View>
                </View>

                <View style={styles.section}>
                    <TextInputComponent
                        label="Название"
                        value={formData.name ?? ''}
                        onChange={value => handleChange('name', value)}
                        error={getError('name')}
                        required={true}
                        hint="Краткое и информативное название вашего путешествия"
                    />
                </View>

                <View style={styles.section}>
                    <YoutubeLinkComponent
                        label="Ссылка на YouTube"
                        value={formData.youtube_link ?? ''}
                        onChange={value => handleChange('youtube_link', value)}
                        error={getError('youtube_link')}
                        hint="Необязательно. Ссылка на видео о вашем путешествии"
                    />
                </View>

                <View style={styles.section}>
                    <WebMapComponent
                        markers={markers || []}
                        onMarkersChange={handleMarkersChange}
                        onCountrySelect={handleCountrySelect}
                        onCountryDeselect={handleCountryDeselect}
                        categoryTravelAddress={filters?.categoryTravelAddress ?? []}
                        countrylist={filters?.countries ?? []}
                    />
                </View>

                {renderEditorSection(
                    'Описание', 
                    formData.description, 
                    val => handleChange('description', val),
                    getError('description'),
                    true,
                    'Подробное описание вашего путешествия. Минимум 50 символов.'
                )}
                {renderEditorSection('Плюсы', formData.plus, val => handleChange('plus', val), null, false, 'Что вам понравилось в этом путешествии')}
                {renderEditorSection('Минусы', formData.minus, val => handleChange('minus', val), null, false, 'Что можно улучшить')}
                {renderEditorSection('Рекомендации', formData.recommendation, val => handleChange('recommendation', val), null, false, 'Ваши советы для других путешественников')}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f9f9f9' },
    container: { padding: 20, paddingBottom: 40 },
    progressSection: {
        marginBottom: 24,
        padding: 16,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
    },
    progressPercent: {
        fontSize: 16,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.primary,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: DESIGN_TOKENS.colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: DESIGN_TOKENS.colors.primary,
        borderRadius: 4,
    },
    section: {
        marginBottom: 20,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#eee',
    },
    sectionEditor: {
        marginBottom: 20,
        paddingBottom: 60,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#eee',
    },
    editorHeader: {
        marginBottom: 12,
    },
    editorLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 4,
    },
    required: {
        color: '#ef4444',
    },
    editorHint: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
        marginTop: 4,
    },
    errorContainer: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
    },
    mapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    mapLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
    },
    mapCount: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.primary,
        fontWeight: '600',
    },
    mapHint: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
        marginBottom: 12,
    },
});

export default React.memo(ContentUpsertSection);
