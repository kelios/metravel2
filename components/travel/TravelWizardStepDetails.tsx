import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';

import ArticleEditor from '@/components/ArticleEditor';
import TextInputComponent from '@/components/TextInputComponent';
import CheckboxComponent from '@/components/CheckboxComponent';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { TravelFormData } from '@/src/types/types';

interface TravelWizardStepDetailsProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    onBack: () => void;
    onNext: () => void;
}

const TravelWizardStepDetails: React.FC<TravelWizardStepDetailsProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    onBack,
    onNext,
}) => {
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
                <Text style={styles.headerTitle}>Детали и советы</Text>
                <Text style={styles.headerSubtitle}>
                    Шаг {currentStep} из {totalSteps} · Плюсы, минусы, рекомендации и бюджет (предыдущий: Медиа · следующий: Публикация)
                </Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Рекомендационные поля</Text>
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
                primaryLabel="К публикации"
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
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 80,
    },
    progressCard: {
        marginTop: 16,
        padding: 12,
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
    progressLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    progressValue: {
        fontSize: 13,
        color: '#2563eb',
        fontWeight: '600',
    },
    section: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    sectionHint: {
        fontSize: 12,
        color: '#6b7280',
    },
    sectionEditor: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    editorLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
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
});

export default TravelWizardStepDetails;
