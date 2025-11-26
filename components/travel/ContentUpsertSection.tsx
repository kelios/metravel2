import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { View, SafeAreaView, StyleSheet, ScrollView, Text, NativeSyntheticEvent, LayoutChangeEvent } from 'react-native';
import { TravelFormData } from '@/src/types/types';
import TextInputComponent from '@/components/TextInputComponent';
import ArticleEditor from '@/components/ArticleEditor';
import { validateTravelForm, getFieldError, type ValidationError } from '@/utils/formValidation';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ContentUpsertSectionProps {
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    firstErrorField?: string | null;
    autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

const ContentUpsertSection: React.FC<ContentUpsertSectionProps> = ({
                                                                       formData,
                                                                       setFormData,
                                                                       firstErrorField,
                                                                       autosaveStatus,
                                                                   }) => {
    // ✅ УЛУЧШЕНИЕ: Валидация в реальном времени
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
    const [fieldPositions, setFieldPositions] = useState<Record<string, number>>({});
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const result = validateTravelForm({
            name: formData.name,
            description: formData.description,
            countries: formData.countries,
            categories: formData.categories,
            year: formData.year,
            number_days: formData.number_days,
            number_peoples: formData.number_peoples,
            youtube_link: formData.youtube_link,
        } as any);
        setValidationErrors(result.errors);
    }, [formData]);

    const descriptionPlainLength = useMemo(() => {
        const raw = formData.description ?? '';
        const withoutTags = String(raw)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return withoutTags.length;
    }, [formData.description]);

    const descriptionStatusText = useMemo(() => {
        if (descriptionPlainLength === 0) {
            return 'Опишите, для кого этот маршрут, что в нём главное и чего ожидать. Минимум 50 символов.';
        }
        if (descriptionPlainLength < 50) {
            return 'Описание пока слишком короткое. Дополните текст (минимум 50 символов).';
        }
        if (descriptionPlainLength <= 150) {
            return 'Хорошее краткое описание. Можно добавить чуть больше деталей (по желанию).';
        }
        return 'Описание выглядит достаточно подробным.';
    }, [descriptionPlainLength]);

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

    const formProgress = useMemo(() => {
        const requiredFields = ['name', 'description', 'countries', 'categories'];
        const filledFields = requiredFields.filter(field => {
            const value = (formData as any)[field];
            if (Array.isArray(value)) return value.length > 0;
            return value && String(value).trim().length > 0;
        });
        return Math.round((filledFields.length / requiredFields.length) * 100);
    }, [formData]);

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
            hint?: string,
            fieldKey?: string,
        ) => {
            const key = fieldKey ?? (title === 'Описание' ? 'description' : undefined);
            const handleLayout = (event: NativeSyntheticEvent<LayoutChangeEvent['nativeEvent']>) => {
                if (!key) return;
                const y = event.nativeEvent.layout.y;
                setFieldPositions(prev => ({ ...prev, [key]: y }));
            };

            const isDescription = title === 'Описание';

            return (
                <View style={styles.sectionEditor} onLayout={handleLayout}>
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
                        variant={isDescription ? 'default' : 'compact'}
                    />
                    {isDescription && (
                        <View style={styles.descriptionStatusRow}>
                            <Text style={styles.descriptionStatusText}>{descriptionStatusText}</Text>
                            <Text style={styles.descriptionCounterText}>{descriptionPlainLength} символов</Text>
                        </View>
                    )}
                    {isDescription && autosaveStatus && (
                        <View style={styles.autosaveRow}>
                            {autosaveStatus === 'saving' && (
                                <Text style={styles.autosaveText}>Автосохранение…</Text>
                            )}
                            {autosaveStatus === 'saved' && (
                                <Text style={styles.autosaveSuccess}>Изменения сохранены</Text>
                            )}
                            {autosaveStatus === 'error' && (
                                <Text style={styles.autosaveError}>
                                    Не удалось сохранить изменения. Попробуйте еще раз или проверьте интернет.
                                </Text>
                            )}
                        </View>
                    )}
                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}
                </View>
            );
        },
        [idTravelStr]
    );

    useEffect(() => {
        if (!firstErrorField) return;
        const y = fieldPositions[firstErrorField];
        if (y == null || !scrollRef.current) return;
        scrollRef.current.scrollTo({ y: Math.max(y - 40, 0), animated: true });
    }, [firstErrorField, fieldPositions]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ref={scrollRef}
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

                <View
                    style={styles.section}
                    onLayout={event => {
                        const y = event.nativeEvent.layout.y;
                        setFieldPositions(prev => ({ ...prev, name: y }));
                    }}
                >
                    <TextInputComponent
                        label="Название"
                        value={formData.name ?? ''}
                        onChange={value => handleChange('name', value)}
                        error={getError('name')}
                        required={true}
                        hint="Краткое и понятное название (не менее 3 символов). По нему путешественники будут искать маршрут."
                    />
                </View>

                {renderEditorSection(
                    'Описание', 
                    formData.description, 
                    val => handleChange('description', val),
                    getError('description'),
                    true,
                    'Опишите, для кого этот маршрут, что в нём главное и чего ожидать. Минимум 50 символов.'
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
    descriptionStatusRow: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    descriptionStatusText: {
        flex: 1,
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
        marginRight: 8,
    },
    descriptionCounterText: {
        fontSize: 12,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
    },
    autosaveRow: {
        marginTop: 4,
    },
    autosaveText: {
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    autosaveSuccess: {
        fontSize: 12,
        color: '#15803d',
    },
    autosaveError: {
        fontSize: 12,
        color: '#b91c1c',
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
