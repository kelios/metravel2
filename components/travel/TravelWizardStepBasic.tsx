import React from 'react';
import { ScrollView, StyleSheet, View, Text, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Snackbar } from 'react-native-paper';

import ContentUpsertSection from '@/components/travel/ContentUpsertSection';
import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import { TravelFormData, Travel } from '@/src/types/types';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';

const windowWidth = Dimensions.get('window').width;
const isMobileDefault = windowWidth <= 768;

interface TravelWizardStepBasicProps {
    currentStep: number;
    totalSteps: number;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    filters: any;
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
}) => {
    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.headerWrapper}>
                <Text style={styles.headerTitle}>Добавление путешествия</Text>
                <Text style={styles.headerSubtitle}>
                    Шаг {currentStep} из {totalSteps} · Основная информация (следующий шаг: Маршрут)
                </Text>
            </View>
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
                    primaryLabel="Далее: Маршрут (шаг 2 из 5)"
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
    mainWrapper: { flex: 1, flexDirection: 'row' },
    mainWrapperMobile: { flexDirection: 'column' },
    contentColumn: { flex: 1 },
    filtersColumn: { width: 320, borderLeftWidth: 1, padding: 12, borderColor: '#ddd' },
    filtersScroll: { maxHeight: '80vh' },
    mobileFiltersWrapper: { padding: 12 },
    mobileActionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 12,
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
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fef2f2',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#fecaca',
    },
    errorSummaryText: {
        fontSize: 12,
        color: '#b91c1c',
    },
    errorSummaryHelper: {
        marginTop: 4,
        fontSize: 12,
        color: '#7f1d1d',
    },
    contentContainerMobile: {
        paddingBottom: 96,
    },
});

export default TravelWizardStepBasic;
