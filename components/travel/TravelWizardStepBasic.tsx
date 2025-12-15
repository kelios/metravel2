import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Text, Dimensions, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Snackbar } from 'react-native-paper';

import ContentUpsertSection from '@/components/travel/ContentUpsertSection';
import { TravelFormData } from '@/src/types/types';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const isMobileDefault = windowWidth <= METRICS.breakpoints.tablet;
const FILTERS_SCROLL_MAX_HEIGHT = windowHeight * 0.8;

interface TravelWizardStepBasicProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    isMobile?: boolean;
    onManualSave: () => Promise<TravelFormData | void>;
    snackbarVisible: boolean;
    snackbarMessage: string;
    onDismissSnackbar: () => void;
    onGoNext: () => void;
    stepErrors?: string[];
    firstErrorField?: string | null;
    autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    autosaveBadge?: string;
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    stepMeta?: {
        title?: string;
        subtitle?: string;
        tipTitle?: string;
        tipBody?: string;
        nextLabel?: string;
    };
    progress?: number;
}

const TravelWizardStepBasic: React.FC<TravelWizardStepBasicProps> = ({
    currentStep,
    totalSteps,
    formData,
    setFormData,
    isMobile = isMobileDefault,
    onManualSave,
    snackbarVisible,
    snackbarMessage,
    onDismissSnackbar,
    onGoNext,
    stepErrors,
    firstErrorField,
    autosaveStatus,
    autosaveBadge,
    focusAnchorId,
    onAnchorHandled,
    stepMeta,
    progress = currentStep / totalSteps,
}) => {
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);
    const [footerHeight, setFooterHeight] = useState(0);

    const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setFooterHeight(prev => (prev === next ? prev : next));
    }, []);

    const contentPaddingBottom = useMemo(() => {
        return footerHeight > 0 ? footerHeight + 16 : 180;
    }, [footerHeight]);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    title={stepMeta?.title ?? 'Добавление путешествия'}
                    subtitle={stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                    progressPercent={progressPercent}
                    autosaveBadge={autosaveBadge}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                />
                {stepErrors && stepErrors.length > 0 && (
                    <View style={styles.errorSummaryContainer}>
                        {stepErrors.map((err, idx) => (
                            <Text key={idx} style={styles.errorSummaryText}>
                                • {err}
                            </Text>
                        ))}
                        <Text style={styles.errorSummaryHelper}>
                            Проверьте выделенные поля — без них маршрут нельзя отправить на модерацию.
                        </Text>
                    </View>
                )}
                <View style={[styles.mainWrapper, isMobile && styles.mainWrapperMobile]}>
                    <ScrollView
                        style={styles.contentColumn}
                        contentContainerStyle={[styles.contentContainer, { paddingBottom: contentPaddingBottom }]}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.contentInner}>
                            <ContentUpsertSection
                                formData={formData}
                                setFormData={setFormData}
                                firstErrorField={firstErrorField}
                                autosaveStatus={autosaveStatus}
                                focusAnchorId={focusAnchorId}
                                onAnchorHandled={onAnchorHandled}
                                visibleFields={['name', 'description']}
                                showProgress={false}
                            />
                        </View>
                    </ScrollView>
                </View>
                <TravelWizardFooter
                    canGoBack={false}
                    onPrimary={onGoNext}
                    primaryLabel={stepMeta?.nextLabel ?? 'Далее'}
                    onSave={onManualSave}
                    onLayout={handleFooterLayout}
                />
                <Snackbar visible={snackbarVisible} onDismiss={onDismissSnackbar}>
                    {snackbarMessage}
                </Snackbar>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: DESIGN_TOKENS.colors.background },
    keyboardAvoid: { flex: 1 },
    mainWrapper: { flex: 1, flexDirection: 'row' },
    mainWrapperMobile: { flexDirection: 'column' },
    contentColumn: { flex: 1 },
    filtersScroll: { maxHeight: FILTERS_SCROLL_MAX_HEIGHT },
    mobileFiltersWrapper: { padding: DESIGN_TOKENS.spacing.md },
    contentContainer: {
        paddingHorizontal: 8,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    errorSummaryContainer: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingVertical: 8,
        backgroundColor: DESIGN_TOKENS.colors.errorSoft,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: DESIGN_TOKENS.colors.dangerLight,
    },
    errorSummaryText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.dangerDark,
    },
    errorSummaryHelper: {
        marginTop: 4,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.dangerDark,
    },
});

export default React.memo(TravelWizardStepBasic);
