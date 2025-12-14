import React, { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, ScrollView, Platform, findNodeHandle, UIManager } from 'react-native';

import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { TravelFormData, Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelWizardStepExtrasProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: (data: TravelFormData) => void;
    filters: any;
    travelDataOld: Travel | null;
    isSuperAdmin: boolean;
    onManualSave: () => void;
    onBack: () => void;
    onNext: () => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
    autosaveBadge?: string;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
}

const TravelWizardStepExtras: React.FC<TravelWizardStepExtrasProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    filters,
    travelDataOld,
    isSuperAdmin,
    onManualSave,
    onBack,
    onNext,
    stepMeta,
    progress = currentStep / totalSteps,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
}) => {
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    const scrollRef = useRef<ScrollView | null>(null);
    const categoriesAnchorRef = useRef<View | null>(null);

    useEffect(() => {
        if (!focusAnchorId) return;
        if (focusAnchorId !== 'travelwizard-extras-categories') return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const scrollNode = scrollRef.current;
        const anchorNode = categoriesAnchorRef.current;
        if (!scrollNode || !anchorNode) {
            onAnchorHandled?.();
            return;
        }

        const scrollHandle = findNodeHandle(scrollNode);
        const anchorHandle = findNodeHandle(anchorNode);
        if (!scrollHandle || !anchorHandle) {
            onAnchorHandled?.();
            return;
        }

        setTimeout(() => {
            UIManager.measureLayout(
                anchorHandle,
                scrollHandle,
                () => onAnchorHandled?.(),
                (_x, y) => {
                    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
                    onAnchorHandled?.();
                },
            );
        }, 50);
    }, [focusAnchorId, onAnchorHandled]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{stepMeta?.title ?? 'Дополнительные параметры'}</Text>
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
                <Text style={styles.progressLabel}>Готово на {progressPercent}%</Text>
            </View>

            {stepMeta?.tipBody && (
                <View style={styles.tipCard}>
                    <Text style={styles.tipTitle}>{stepMeta.tipTitle ?? 'Подсказка'}</Text>
                    <Text style={styles.tipBody}>{stepMeta.tipBody}</Text>
                </View>
            )}

            <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View ref={categoriesAnchorRef} nativeID="travelwizard-extras-categories" />
                <FiltersUpsertComponent
                    filters={filters}
                    formData={formData}
                    setFormData={setFormData}
                    travelDataOld={travelDataOld}
                    isSuperAdmin={isSuperAdmin}
                    onSave={onManualSave}
                    showSaveButton={false}
                    showPreviewButton={false}
                    showPublishControls={false}
                    showCountries={false}
                    showCategories={true}
                    showCoverImage={false}
                    showAdditionalFields={true}
                />
            </ScrollView>

            <TravelWizardFooter
                canGoBack={true}
                onBack={onBack}
                onPrimary={onNext}
                primaryLabel={stepMeta?.nextLabel ?? 'К публикации'}
                onSave={onManualSave}
                saveLabel="Сохранить"
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
        paddingHorizontal: 8,
        paddingBottom: 80,
    },
});

export default React.memo(TravelWizardStepExtras);
