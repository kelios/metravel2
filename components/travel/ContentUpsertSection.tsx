import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { View, SafeAreaView, StyleSheet, ScrollView, Text, NativeSyntheticEvent, LayoutChangeEvent, Modal, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { TravelFormData } from '@/src/types/types';
import TextInputComponent from '@/components/TextInputComponent';
import ArticleEditor from '@/components/ArticleEditor';
import { validateTravelForm, getFieldError, type ValidationError } from '@/utils/formValidation';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

interface ContentUpsertSectionProps {
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    firstErrorField?: string | null;
    autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    visibleFields?: Array<'name' | 'description' | 'plus' | 'minus' | 'recommendation'>;
    showProgress?: boolean;
}

const ContentUpsertSection: React.FC<ContentUpsertSectionProps> = ({
                                                                       formData,
                                                                       setFormData,
                                                                       firstErrorField,
                                                                       autosaveStatus,
                                                                       focusAnchorId,
                                                                       onAnchorHandled,
                                                                       visibleFields,
                                                                       showProgress = true,
                                                                   }) => {
    // ✅ УЛУЧШЕНИЕ: Валидация в реальном времени
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
    const [fieldPositions, setFieldPositions] = useState<Record<string, number>>({});
    const scrollRef = useRef<ScrollView>(null);
    const [isDescriptionFullscreen, setIsDescriptionFullscreen] = useState(false);

    const isMobile = useMemo(() => {
        if (Platform.OS === 'web') return false;
        const { width } = Dimensions.get('window');
        return width <= METRICS.breakpoints.tablet;
    }, []);

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
    }, [
        formData.name,
        formData.description,
        formData.countries,
        formData.categories,
        formData.year,
        formData.number_days,
        formData.number_peoples,
        formData.youtube_link,
    ]);

    const descriptionPlainLength = useMemo(() => {
        const raw = formData.description ?? '';
        const withoutTags = String(raw)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return withoutTags.length;
    }, [formData.description]);

    const descriptionPlainText = useMemo(() => {
        const raw = formData.description ?? '';
        return String(raw)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }, [formData.description]);

    const descriptionStatusText = useMemo(() => {
        if (descriptionPlainLength === 0) {
            return 'Опишите, для кого этот маршрут, что в нём главное и чего ожидать. Минимум 50 символов.';
        }
        if (descriptionPlainLength < 50) {
            const remaining = 50 - descriptionPlainLength;
            return `Осталось ${remaining} ${remaining === 1 ? 'символ' : remaining < 5 ? 'символа' : 'символов'} до минимума`;
        }
        if (descriptionPlainLength <= 150) {
            return 'Хорошее краткое описание. Можно добавить чуть больше деталей (по желанию).';
        }
        return 'Отличное подробное описание!';
    }, [descriptionPlainLength]);

    const descriptionProgress = useMemo(() => {
        const progress = Math.min((descriptionPlainLength / 50) * 100, 100);
        return progress;
    }, [descriptionPlainLength]);

    const descriptionProgressColor = useMemo(() => {
        if (descriptionPlainLength < 50) return DESIGN_TOKENS.colors.dangerLight;
        if (descriptionPlainLength <= 150) return '#FFD93D';
        return DESIGN_TOKENS.colors.successDark;
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
                    {isDescription && isMobile ? (
                        <>
                            <TouchableOpacity
                                style={styles.descriptionPreview}
                                activeOpacity={0.9}
                                onPress={() => setIsDescriptionFullscreen(true)}
                            >
                                <Text style={styles.descriptionPreviewText} numberOfLines={4}>
                                    {descriptionPlainText.length > 0
                                        ? descriptionPlainText
                                        : (hint ?? 'Введите описание…')}
                                </Text>
                                <View style={styles.descriptionPreviewFooter}>
                                    <Text style={styles.descriptionCounterText}>{descriptionPlainLength} символов</Text>
                                    <View style={styles.descriptionEditChip}>
                                        <Text style={styles.descriptionEditChipText}>Редактировать</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <Modal
                                visible={isDescriptionFullscreen}
                                animationType="slide"
                                presentationStyle="fullScreen"
                                onRequestClose={() => setIsDescriptionFullscreen(false)}
                            >
                                <SafeAreaView style={styles.modalSafeArea}>
                                    <View style={styles.modalHeader}>
                                        <TouchableOpacity
                                            onPress={() => setIsDescriptionFullscreen(false)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text style={styles.modalHeaderAction}>Закрыть</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.modalHeaderTitle}>Описание</Text>
                                        <TouchableOpacity
                                            onPress={() => setIsDescriptionFullscreen(false)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text style={styles.modalHeaderAction}>Готово</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.modalBody}>
                                        <ArticleEditor
                                            key={`description-fullscreen-${idTravelStr ?? 'new'}`}
                                            label={title}
                                            content={content ?? ''}
                                            onChange={onChange}
                                            idTravel={idTravelStr}
                                            variant="default"
                                        />
                                    </View>
                                </SafeAreaView>
                            </Modal>
                        </>
                    ) : (
                        <ArticleEditor
                            key={`${title}-${idTravelStr ?? 'new'}`}
                            label={title}
                            content={content ?? ''}
                            onChange={onChange}
                            idTravel={idTravelStr}
                            variant={isDescription ? 'default' : 'compact'}
                        />
                    )}
                    {isDescription && (
                        <>
                            <View style={styles.descriptionProgressContainer}>
                                <View style={styles.descriptionProgressTrack}>
                                    <View 
                                        style={[
                                            styles.descriptionProgressFill, 
                                            { 
                                                width: `${descriptionProgress}%`,
                                                backgroundColor: descriptionProgressColor 
                                            }
                                        ]} 
                                    />
                                </View>
                            </View>
                            <View style={styles.descriptionStatusRow}>
                                <Text style={[
                                    styles.descriptionStatusText,
                                    descriptionPlainLength < 50 && styles.descriptionStatusTextWarning,
                                    descriptionPlainLength >= 50 && styles.descriptionStatusTextSuccess
                                ]}>
                                    {descriptionStatusText}
                                </Text>
                                <Text style={styles.descriptionCounterText}>{descriptionPlainLength} символов</Text>
                            </View>
                        </>
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
        [descriptionPlainLength, descriptionPlainText, descriptionStatusText, idTravelStr, isDescriptionFullscreen, isMobile]
    );

    useEffect(() => {
        if (!firstErrorField) return;
        const y = fieldPositions[firstErrorField];
        if (y == null || !scrollRef.current) return;
        scrollRef.current.scrollTo({ y: Math.max(y - 40, 0), animated: true });
    }, [firstErrorField, fieldPositions]);

    useEffect(() => {
        if (!focusAnchorId) return;

        const key = (() => {
            if (focusAnchorId === 'travelwizard-basic-name') return 'name';
            if (focusAnchorId === 'travelwizard-basic-description') return 'description';
            return null;
        })();

        if (!key) return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const y = fieldPositions[key];
        if (y == null || !scrollRef.current) {
            onAnchorHandled?.();
            return;
        }

        scrollRef.current.scrollTo({ y: Math.max(y - 40, 0), animated: true });
        onAnchorHandled?.();
    }, [fieldPositions, focusAnchorId, onAnchorHandled]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ref={scrollRef}
            >
                {/* ✅ УЛУЧШЕНИЕ: Прогресс заполнения формы */}
                {showProgress && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressLabel}>Прогресс заполнения</Text>
                            <Text style={styles.progressPercent}>{formProgress}%</Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${formProgress}%` }]} />
                        </View>
                    </View>
                )}

                {(visibleFields == null || visibleFields.includes('name')) && (
                    <View
                        style={styles.section}
                        nativeID="travelwizard-basic-name"
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
                )}

                {(visibleFields == null || visibleFields.includes('description')) &&
                    <View
                        nativeID="travelwizard-basic-description"
                        onLayout={event => {
                            const y = event.nativeEvent.layout.y;
                            setFieldPositions(prev => ({ ...prev, description: y }));
                        }}
                    >
                        {renderEditorSection(
                            'Описание',
                            formData.description,
                            val => handleChange('description', val),
                            getError('description'),
                            true,
                            'Опишите, для кого этот маршрут, что в нём главное и чего ожидать. Минимум 50 символов.'
                        )}
                    </View>}

                {(visibleFields == null || visibleFields.includes('plus')) &&
                    renderEditorSection('Плюсы', formData.plus, val => handleChange('plus', val), null, false, 'Что вам понравилось в этом путешествии')}

                {(visibleFields == null || visibleFields.includes('minus')) &&
                    renderEditorSection('Минусы', formData.minus, val => handleChange('minus', val), null, false, 'Что можно улучшить')}

                {(visibleFields == null || visibleFields.includes('recommendation')) &&
                    renderEditorSection('Рекомендации', formData.recommendation, val => handleChange('recommendation', val), null, false, 'Ваши советы для других путешественников')}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
    container: { padding: DESIGN_TOKENS.spacing.xxs, paddingBottom: 40 },
    modalSafeArea: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
    modalHeader: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        borderBottomWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    modalHeaderTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    modalHeaderAction: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.primary,
    },
    modalBody: {
        flex: 1,
        padding: DESIGN_TOKENS.spacing.xxs,
    },
    descriptionPreview: {
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: 12,
        padding: DESIGN_TOKENS.spacing.md,
        minHeight: 140,
    },
    descriptionPreviewText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
        lineHeight: 18,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    descriptionPreviewFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    descriptionEditChip: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.borderAccent,
    },
    descriptionEditChipText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.primary,
    },
    progressSection: {
        marginBottom: DESIGN_TOKENS.spacing.xs,
        padding: DESIGN_TOKENS.spacing.lg,
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
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
    },
    progressPercent: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
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
        marginBottom: DESIGN_TOKENS.spacing.xxs,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        padding: DESIGN_TOKENS.spacing.lg,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    descriptionProgressContainer: {
        marginTop: 8,
    },
    descriptionProgressTrack: {
        height: 4,
        backgroundColor: DESIGN_TOKENS.colors.borderLight,
        borderRadius: DESIGN_TOKENS.radii.pill,
        overflow: 'hidden',
    },
    descriptionProgressFill: {
        height: '100%',
        borderRadius: DESIGN_TOKENS.radii.pill,
    },
    descriptionStatusRow: {
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    descriptionStatusText: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        marginRight: 8,
    },
    descriptionStatusTextWarning: {
        color: DESIGN_TOKENS.colors.dangerDark,
        fontWeight: '600',
    },
    descriptionStatusTextSuccess: {
        color: DESIGN_TOKENS.colors.successDark,
    },
    descriptionCounterText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
    },
    autosaveRow: {
        marginTop: 4,
    },
    autosaveText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    autosaveSuccess: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.successDark,
    },
    autosaveError: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.dangerDark,
    },
    sectionEditor: {
        marginBottom: DESIGN_TOKENS.spacing.xxs,
        paddingBottom: DESIGN_TOKENS.spacing.xs,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        padding: DESIGN_TOKENS.spacing.lg,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
            : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    editorHeader: {
        marginBottom: 12,
    },
    editorLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 4,
    },
    required: {
        color: DESIGN_TOKENS.colors.danger,
    },
    editorHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        marginTop: 4,
    },
    errorContainer: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    errorText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.danger,
    },
});

export default React.memo(ContentUpsertSection);
