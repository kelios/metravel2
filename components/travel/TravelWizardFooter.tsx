import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Button } from 'react-native-paper';

interface TravelWizardFooterProps {
    canGoBack?: boolean;
    onBack?: () => void;
    onPrimary: () => void;
    onSave?: () => void;
    primaryLabel: string;
    saveLabel?: string;
    primaryDisabled?: boolean;
}

const windowWidth = Dimensions.get('window').width;
const isMobileDefault = windowWidth <= 768;

const TravelWizardFooter: React.FC<TravelWizardFooterProps> = ({
    canGoBack = true,
    onBack,
    onPrimary,
    onSave,
    primaryLabel,
    saveLabel = 'Сохранить',
    primaryDisabled = false,
}) => {
    const isMobile = isMobileDefault;

    return (
        <View style={[styles.footer, isMobile && styles.footerMobile]}>
            {canGoBack ? (
                <Button
                    mode="outlined"
                    onPress={onBack}
                    style={styles.footerButton}
                >
                    Назад
                </Button>
            ) : (
                <View style={styles.footerButtonPlaceholder} />
            )}

            <Button
                mode="contained"
                onPress={onPrimary}
                style={styles.footerButton}
                disabled={primaryDisabled}
            >
                {primaryLabel}
            </Button>

            {onSave ? (
                <Button
                    mode="text"
                    onPress={onSave}
                    style={styles.footerSaveButton}
                >
                    {saveLabel}
                </Button>
            ) : (
                <View style={styles.footerButtonPlaceholder} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    footerMobile: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    footerButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    footerSaveButton: {
        marginLeft: 4,
    },
    footerButtonPlaceholder: {
        flex: 1,
        marginHorizontal: 4,
    },
});

export default TravelWizardFooter;
