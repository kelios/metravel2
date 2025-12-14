import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView } from 'react-native';

import ArticleEditor from '@/components/ArticleEditor';
import TextInputComponent from '@/components/TextInputComponent';
import CheckboxComponent from '@/components/CheckboxComponent';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { TravelFormData } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelWizardStepDetailsProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    onBack: () => void;
    onNext: () => void;
    onManualSave?: () => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
}

const TravelWizardStepDetails: React.FC<TravelWizardStepDetailsProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    onBack,
    onNext,
    onManualSave,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
}) => {
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const idTravelStr = useMemo(
        () => (formData?.id != null ? String(formData.id) : undefined),
        [formData?.id]
    );

    const handleChange = <T extends keyof TravelFormData>(name: T, value: TravelFormData[T]) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const recommendationFieldsFilled = useMemo(() => {
        const keys: (keyof TravelFormData)[] = ['plus', 'minus', 'recommendation', 'budget', 'visa'];
        let filled = 0;
        keys.forEach(key => {
            const value = (formData as any)[key];
            if (key === 'visa') {
                if (value === true || value === false) filled += 1;
                return;
            }
            if (Array.isArray(value)) {
                if (value.length > 0) filled += 1;
                return;
            }
            if (value && String(value).trim().length > 0) filled += 1;
        });
        return { filled, total: keys.length };
    }, [formData]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{stepMeta?.title ?? 'Детали и советы'}</Text>
                        <Text style={styles.headerSubtitle}>{stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}</Text>
                    </View>
                    {autosaveBadge && (
                        <View style={styles.autosaveBadge}>
                            <Text style={styles.autosaveBadgeText}>{autosaveBadge}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.headerProgressLabel}>Готово на {progressPercent}%</Text>
            </View>

            {stepMeta?.tipBody && (
                <View style={styles.tipCard}>
                    <Text style={styles.tipTitle}>{stepMeta.tipTitle ?? 'Подсказка'}</Text>
                    <Text style={styles.tipBody}>{stepMeta.tipBody}</Text>
                </View>
            )}

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressCardLabel}>Рекомендационные поля</Text>
                        <Text style={styles.progressValue}>
                            {recommendationFieldsFilled.filled} из {recommendationFieldsFilled.total} заполнено
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Для кого это путешествие</Text>
                    <Text style={styles.sectionHint}>
                        Опишите плюсы и минусы маршрута, ваши рекомендации и лайфхаки. Это повышает ценность
                        путешествия для читателей.
                    </Text>
                </View>

                <View style={styles.sectionEditor}>
                    <Text style={styles.editorLabel}>Плюсы</Text>
                    <ArticleEditor
                        key={`plus-${idTravelStr ?? 'new'}`}
                        label="Плюсы"
                        content={formData.plus ?? ''}
                        onChange={val => handleChange('plus', val as any)}
                        idTravel={idTravelStr}
                        variant="compact"
                    />
                </View>

                <View style={styles.sectionEditor}>
                    <Text style={styles.editorLabel}>Минусы</Text>
                    <ArticleEditor
                        key={`minus-${idTravelStr ?? 'new'}`}
                        label="Минусы"
                        content={formData.minus ?? ''}
                        onChange={val => handleChange('minus', val as any)}
                        idTravel={idTravelStr}
                        variant="compact"
                    />
                </View>

                <View style={styles.sectionEditor}>
                    <Text style={styles.editorLabel}>Рекомендации и лайфхаки</Text>
                    <ArticleEditor
                        key={`rec-${idTravelStr ?? 'new'}`}
                        label="Рекомендации"
                        content={formData.recommendation ?? ''}
                        onChange={val => handleChange('recommendation', val as any)}
                        idTravel={idTravelStr}
                        variant="compact"
                    />
                </View>

                <View style={styles.section}>
                    <TextInputComponent
                        label="Бюджет (сумма или диапазон)"
                        value={(formData.budget as any)?.toString?.() ?? ''}
                        onChange={value => handleChange('budget', value as any)}
                        hint="Например: 700–900 € на человека без перелёта"
                    />
                </View>

                <View style={styles.section}>
                    <CheckboxComponent
                        label="Требуется виза"
                        value={formData.visa ?? false}
                        onChange={value => handleChange('visa', value as any)}
                    />
                </View>
            </ScrollView>

            <TravelWizardFooter
                canGoBack={true}
                onBack={onBack}
                onPrimary={onNext}
                onSave={onManualSave}
                saveLabel="Сохранить"
                primaryLabel="К публикации"
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: '#f9f9f9' },
    headerWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#f9f9f9',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    headerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.lg,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#6b7280',
    },
    autosaveBadge: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999,
        backgroundColor: '#eef2ff',
    },
    autosaveBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#4338ca',
        fontWeight: '600',
    },
    progressBarTrack: {
        marginTop: 8,
        width: '100%',
        height: 6,
        borderRadius: 999,
        backgroundColor: '#e5e7eb',
    },
    progressBarFill: {
        height: 6,
        borderRadius: 999,
        backgroundColor: '#2563eb',
    },
    progressLabel: {
        marginTop: 6,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#6b7280',
    },
    headerProgressLabel: {
        marginTop: 6,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#6b7280',
    },
    tipCard: {
        marginHorizontal: DESIGN_TOKENS.spacing.lg,
        marginTop: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: 12,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    tipTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: '#047857',
        marginBottom: 4,
    },
    tipBody: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#065f46',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingBottom: 80,
        width: '100%',
        maxWidth: '100%',
    },
    progressCard: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.md,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressCardLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: '#111827',
    },
    progressValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#2563eb',
        fontWeight: '600',
    },
    section: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#6b7280',
    },
    sectionEditor: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
    },
    editorLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    footerButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
});

export default React.memo(TravelWizardStepDetails);
