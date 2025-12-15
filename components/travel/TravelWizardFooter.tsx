import React from 'react';
import { View, StyleSheet, Dimensions, Platform, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelWizardFooterProps {
    canGoBack?: boolean;
    onBack?: () => void;
    onPrimary: () => void;
    onSave?: () => void;
    primaryLabel: string;
    saveLabel?: string;
    primaryDisabled?: boolean;
    onLayout?: (event: LayoutChangeEvent) => void;
}

const TravelWizardFooter: React.FC<TravelWizardFooterProps> = ({
    canGoBack = true,
    onBack,
    onPrimary,
    onSave,
    primaryLabel,
    saveLabel = 'Сохранить',
    primaryDisabled = false,
    onLayout,
}) => {
    const { width } = useWindowDimensions();
    const isMobile = width <= DESIGN_TOKENS.breakpoints.mobile;
    const isNarrowMobile = width <= 380;
    const isWeb = Platform.OS === 'web';
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.footer,
                isMobile && (isWeb ? styles.footerMobileWeb : styles.footerMobileNative),
                isMobile && !isWeb ? { paddingBottom: 12 + insets.bottom } : null,
            ]}
            onLayout={onLayout}
        >
            {isMobile ? (
                <>
                    <View style={isNarrowMobile ? styles.mobileColumn : styles.mobileRow}>
                        {canGoBack ? (
                            <Button
                                mode="outlined"
                                onPress={onBack}
                                style={isNarrowMobile ? styles.mobileButtonFull : styles.mobileButton}
                            >
                                Назад
                            </Button>
                        ) : (
                            <View style={styles.footerButtonPlaceholder} />
                        )}

                        <Button
                            mode="contained"
                            onPress={onPrimary}
                            style={isNarrowMobile ? styles.mobileButtonFull : styles.mobileButton}
                            disabled={primaryDisabled}
                        >
                            {primaryLabel}
                        </Button>
                    </View>

                    <Button
                        mode="text"
                        onPress={onSave}
                        style={styles.footerSaveButtonMobile}
                        disabled={!onSave}
                    >
                        {saveLabel}
                    </Button>
                </>
            ) : (
                <>
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

                    <Button
                        mode="text"
                        onPress={onSave}
                        style={styles.footerSaveButton}
                        disabled={!onSave}
                    >
                        {saveLabel}
                    </Button>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        zIndex: DESIGN_TOKENS.zIndex.sticky,
    },
    footerMobileNative: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    footerMobileWeb: {
        position: 'sticky' as any,
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
    mobileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    mobileColumn: {
        flexDirection: 'column',
        width: '100%',
        gap: 8,
    },
    mobileButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    mobileButtonFull: {
        width: '100%',
        marginHorizontal: 0,
    },
    footerSaveButtonMobile: {
        marginTop: 6,
        alignSelf: 'center',
    },
    footerButtonPlaceholder: {
        flex: 1,
        marginHorizontal: 4,
    },
});

export default TravelWizardFooter;
