import React from 'react';
import { ScrollView, StyleSheet, View, Text, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Snackbar } from 'react-native-paper';

import ContentUpsertSection from '@/components/travel/ContentUpsertSection';
import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import { TravelFormData, Travel, TravelFilters } from '@/src/types/types';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const isMobileDefault = windowWidth <= 768;
const FILTERS_SCROLL_MAX_HEIGHT = windowHeight * 0.8;

interface TravelWizardStepBasicProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    filters: TravelFilters | null;
    travelDataOld: Travel | null;
    isSuperAdmin: boolean;
    isMobile?: boolean;
    menuVisible: boolean;
    setMenuVisible: (visible: boolean) => void;
    onManualSave: () => void;
    snackbarVisible: boolean;
    snackbarMessage: string;
    onDismissSnackbar: () => void;
    onGoNext: () => void;
    stepErrors?: string[];
    firstErrorField?: string | null;
    autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    autosaveBadge?: string;
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
    filters,
    travelDataOld,
    isSuperAdmin,
    isMobile = isMobileDefault,
    menuVisible,
    setMenuVisible,
    onManualSave,
    snackbarVisible,
    snackbarMessage,
    onDismissSnackbar,
    onGoNext,
    stepErrors,
    firstErrorField,
    autosaveStatus,
    autosaveBadge,
    stepMeta,
    progress = currentStep / totalSteps,
}) => {
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const progressPercent = Math.round(progressValue * 100);

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{stepMeta?.title ?? 'Добавление путешествия'}</Text>
                        <Text style={styles.headerSubtitle}>
                            {stepMeta?.subtitle ?? `Шаг ${currentStep} из ${totalSteps}`}
                        </Text>
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
                    contentContainerStyle={isMobile ? styles.contentContainerMobile : undefined}
                    keyboardShouldPersistTaps="handled"
                >
                    <ContentUpsertSection
                        formData={formData}
                        setFormData={setFormData}
                        firstErrorField={firstErrorField}
                        autosaveStatus={autosaveStatus}
                    />
                </ScrollView>
                {isMobile ? (
                    <View style={styles.mobileFiltersWrapper}>
                        {menuVisible && (
                            <ScrollView style={styles.filtersScroll}>
                                <FiltersUpsertComponent
                                    filters={filters}
                                    formData={formData}
                                    setFormData={setFormData}
                                    travelDataOld={travelDataOld}
                                    onClose={() => setMenuVisible(false)}
                                    isSuperAdmin={isSuperAdmin}
                                    onSave={onManualSave}
                                    showSaveButton={false}
                                    showPreviewButton={false}
                                    showPublishControls={false}
                                />
                            </ScrollView>
                        )}
                    </View>
                ) : (
                    <View style={styles.filtersColumn}>
                        <FiltersUpsertComponent
                            filters={filters}
                            formData={formData}
                            setFormData={setFormData}
                            travelDataOld={travelDataOld}
                            onClose={() => setMenuVisible(false)}
                            isSuperAdmin={isSuperAdmin}
                            onSave={onManualSave}
                            showSaveButton={false}
                            showPreviewButton={false}
                            showPublishControls={false}
                        />
                    </View>
                )}
            </View>
            {!isMobile && (
                <TravelWizardFooter
                    canGoBack={false}
                    onPrimary={onGoNext}
                    primaryLabel={stepMeta?.nextLabel ?? 'Далее'}
                    onSave={onManualSave}
                />
            )}
            {isMobile && (
                <View style={styles.mobileActionBar}>
                    <Button
                        mode="contained"
                        icon="content-save"
                        onPress={onManualSave}
                        style={styles.saveButtonMobile}
                    >
                        Сохранить
                    </Button>
                    <Button
                        mode="outlined"
                        icon="filter-outline"
                        onPress={() => setMenuVisible(!menuVisible)}
                        style={styles.filterButton}
                    >
                        Боковая панель
                    </Button>
                    <Button
                        mode="text"
                        onPress={onGoNext}
                    >
                        Далее: Маршрут (шаг 2 из 5)
                    </Button>
                </View>
            )}
            <Snackbar visible={snackbarVisible} onDismiss={onDismissSnackbar}>
                {snackbarMessage}
            </Snackbar>
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
    mainWrapper: { flex: 1, flexDirection: 'row' },
    mainWrapperMobile: { flexDirection: 'column' },
    contentColumn: { flex: 1 },
    filtersColumn: { width: 320, borderLeftWidth: 1, padding: DESIGN_TOKENS.spacing.md, borderColor: '#ddd' },
    filtersScroll: { maxHeight: FILTERS_SCROLL_MAX_HEIGHT },
    mobileFiltersWrapper: { padding: DESIGN_TOKENS.spacing.md },
    mobileActionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: DESIGN_TOKENS.spacing.md,
        borderTopWidth: 1,
        borderColor: '#ddd',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    saveButtonMobile: {
        backgroundColor: '#f5a623',
        borderRadius: 50,
        minWidth: 150,
    },
    filterButton: {
        borderColor: '#007AFF',
        borderRadius: 50,
        minWidth: 100,
    },
    errorSummaryContainer: {
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingVertical: 8,
        backgroundColor: '#fef2f2',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#fecaca',
    },
    errorSummaryText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#b91c1c',
    },
    errorSummaryHelper: {
        marginTop: 4,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: '#7f1d1d',
    },
    contentContainerMobile: {
        paddingBottom: 96,
    },
});

export default TravelWizardStepBasic;
