import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { View, SafeAreaView, StyleSheet, ScrollView, Text, NativeSyntheticEvent, LayoutChangeEvent } from 'react-native';
import { TravelFormData } from '@/src/types/types';
import TextInputComponent from '@/components/TextInputComponent';
import { validateTravelForm, getFieldError, type ValidationError } from '@/utils/formValidation';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface OptimizedContentUpsertSectionProps {
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    firstErrorField?: string | null;
    autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

const OptimizedContentUpsertSection: React.FC<OptimizedContentUpsertSectionProps> = ({
    formData,
    setFormData,
    firstErrorField,
    autosaveStatus,
}) => {
    // Optimized validation state with debouncing
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
    const [fieldPositions, setFieldPositions] = useState<Record<string, number>>({});
    const scrollRef = useRef<ScrollView>(null);
    const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced validation to prevent excessive re-renders
    const debouncedValidation = useCallback((data: TravelFormData) => {
        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current);
        }

        validationTimeoutRef.current = setTimeout(() => {
            const result = validateTravelForm({
                name: data.name,
                description: data.description,
                countries: data.countries,
                categories: data.categories,
                year: data.year,
                number_days: data.number_days,
                number_peoples: data.number_peoples,
                youtube_link: data.youtube_link,
            } as any);
            setValidationErrors(result.errors);
        }, 300);
    }, []);

    // Optimized effect with dependency array
    useEffect(() => {
        debouncedValidation(formData);
    }, [
        formData.name,
        formData.description,
        formData.countries,
        formData.categories,
        formData.year,
        formData.number_days,
        formData.number_peoples,
        formData.youtube_link,
        debouncedValidation,
    ]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current);
            }
        };
    }, []);

    // Memoized description length calculation
    const descriptionPlainLength = useMemo(() => {
        const raw = formData.description ?? '';
        const withoutTags = String(raw)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return withoutTags.length;
    }, [formData.description]);

    // Memoized status text
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

    // Optimized field change handler
    const handleChange = useCallback(
        <T extends keyof TravelFormData>(name: T, value: TravelFormData[T]) => {
            setFormData(prev => ({ ...prev, [name]: value }));
            setTouchedFields(prev => new Set(prev).add(name as string));
        },
        [setFormData]
    );

    // Memoized error getter
    const getError = useCallback((field: string) => {
        if (!touchedFields.has(field)) return null;
        return getFieldError(field, validationErrors);
    }, [touchedFields, validationErrors]);

    // Memoized form progress
    const formProgress = useMemo(() => {
        const requiredFields = ['name', 'description', 'countries', 'categories'];
        const filledFields = requiredFields.filter(field => {
            const value = (formData as any)[field];
            if (Array.isArray(value)) return value.length > 0;
            return value && String(value).trim().length > 0;
        });
        return Math.round((filledFields.length / requiredFields.length) * 100);
    }, [formData]);

    // Memoized travel ID
    const idTravelStr = useMemo(
        () => (formData?.id != null ? String(formData.id) : undefined),
        [formData?.id]
    );

    // Memoized editor section renderer (using TextInput for now)
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
                    <TextInputComponent
                        label={title}
                        value={content ?? ''}
                        onChange={onChange}
                        error={error}
                        required={required}
                        multiline={true}
                        numberOfLines={isDescription ? 6 : 3}
                        placeholder={hint}
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
                                <Text style={styles.autosaveText}>Сохранение...</Text>
                            )}
                            {autosaveStatus === 'saved' && (
                                <Text style={styles.autosaveTextSaved}>Сохранено</Text>
                            )}
                            {autosaveStatus === 'error' && (
                                <Text style={styles.autosaveTextError}>Ошибка сохранения</Text>
                            )}
                        </View>
                    )}
                    {error && (
                        <Text style={styles.errorText}>{error}</Text>
                    )}
                </View>
            );
        },
        [idTravelStr, descriptionStatusText, descriptionPlainLength, autosaveStatus]
    );

    // Scroll to first error field
    useEffect(() => {
        if (firstErrorField && fieldPositions[firstErrorField]) {
            scrollRef.current?.scrollTo({
                y: fieldPositions[firstErrorField],
                animated: true,
            });
        }
    }, [firstErrorField, fieldPositions]);

    return (
        <View style={styles.container}>
            <View style={styles.progressSection}>
                <Text style={styles.progressTitle}>Заполнение путешествия</Text>
                <Text style={styles.progressText}>Готово: {formProgress}%</Text>
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Основная информация</Text>
                    
                    <TextInputComponent
                        label="Название путешествия"
                        value={formData.name ?? ''}
                        onChange={(value) => handleChange('name', value)}
                        error={getError('name')}
                        required
                        placeholder="Введите название путешествия"
                    />

                    {renderEditorSection(
                        'Описание',
                        formData.description,
                        (value) => handleChange('description', value),
                        getError('description'),
                        true,
                        'Опишите маршрут подробно: для кого он, что главное, чего ожидать'
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Дополнительная информация</Text>
                    
                    <TextInputComponent
                        label="YouTube ссылка (необязательно)"
                        value={formData.youtube_link ?? ''}
                        onChange={(value) => handleChange('youtube_link', value)}
                        error={getError('youtube_link')}
                        placeholder="https://www.youtube.com/watch?v=..."
                    />

                    {renderEditorSection(
                        'Плюсы маршрута',
                        formData.plus,
                        (value) => handleChange('plus', value),
                        null,
                        false,
                        'Что особенно понравилось в этом маршруте?'
                    )}

                    {renderEditorSection(
                        'Минусы маршрута',
                        formData.minus,
                        (value) => handleChange('minus', value),
                        null,
                        false,
                        'На что стоит обратить внимание или что можно улучшить?'
                    )}

                    {renderEditorSection(
                        'Рекомендации',
                        formData.recommendation,
                        (value) => handleChange('recommendation', value),
                        null,
                        false,
                        'Советы для тех, кто решит пройти этот маршрут'
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    progressSection: {
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
        borderBottomWidth: 1,
        borderBottomColor: DESIGN_TOKENS.colors.border,
    },
    progressTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
        fontWeight: DESIGN_TOKENS.typography.weights.bold,
        color: DESIGN_TOKENS.colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    progressText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: DESIGN_TOKENS.spacing.lg,
    },
    section: {
        marginBottom: DESIGN_TOKENS.spacing.xl,
    },
    sectionTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold,
        color: DESIGN_TOKENS.colors.text,
        marginBottom: DESIGN_TOKENS.spacing.lg,
        paddingBottom: DESIGN_TOKENS.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: DESIGN_TOKENS.colors.borderLight,
    },
    sectionEditor: {
        marginBottom: DESIGN_TOKENS.spacing.xl,
    },
    editorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    editorLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold,
        color: DESIGN_TOKENS.colors.text,
    },
    required: {
        color: DESIGN_TOKENS.colors.danger,
    },
    editorHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textSubtle,
        fontStyle: 'italic',
    },
    descriptionStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: DESIGN_TOKENS.spacing.sm,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: DESIGN_TOKENS.colors.borderLight,
    },
    descriptionStatusText: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    descriptionCounterText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textSubtle,
        fontWeight: '500',
    },
    autosaveRow: {
        marginTop: DESIGN_TOKENS.spacing.sm,
    },
    autosaveText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.textMuted,
        fontStyle: 'italic',
    },
    autosaveTextSaved: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.success,
        fontStyle: 'italic',
    },
    autosaveTextError: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.danger,
        fontStyle: 'italic',
    },
    errorText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.danger,
        marginTop: DESIGN_TOKENS.spacing.xs,
    },
});

export default OptimizedContentUpsertSection;
