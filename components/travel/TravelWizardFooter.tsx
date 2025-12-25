import React from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';

interface TravelWizardFooterProps {
    canGoBack?: boolean;
    onBack?: () => void;
    onPrimary: () => void;
    onSave?: () => void;
    primaryLabel: string;
    saveLabel?: string;
    primaryDisabled?: boolean;
    onLayout?: (event: any) => void;
    currentStep?: number;
    totalSteps?: number;
    onStepSelect?: (step: number) => void;
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
    currentStep,
    totalSteps,
    onStepSelect,
}) => {
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const isWeb = Platform.OS === 'web';
    const insets = useSafeAreaInsets();

    const steps = totalSteps && currentStep
        ? Array.from({ length: totalSteps }, (_, i) => i + 1)
        : [];

    return (
        <View
            style={[
                styles.footer,
                isWeb ? styles.footerWeb : null,
                isMobile && (isWeb ? styles.footerMobileWeb : styles.footerMobileNative),
                isMobile && !isWeb ? { paddingBottom: 8 + insets.bottom } : null,
            ]}
            onLayout={onLayout}
        >
            {isMobile ? (
                <>
                    <View style={styles.mobileMainRow}>
                        {canGoBack && onBack ? (
                            <Pressable
                                onPress={onBack}
                                style={styles.backButtonMobile}
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="arrow-left" size={18} color={DESIGN_TOKENS.colors.text} />
                            </Pressable>
                        ) : null}

                        <Button
                            mode="contained"
                            onPress={onPrimary}
                            style={styles.primaryButtonMobile}
                            disabled={primaryDisabled}
                            icon="arrow-right"
                            contentStyle={styles.primaryButtonContent}
                        >
                            {primaryLabel}
                        </Button>

                        {onSave ? (
                            <IconButton
                                icon="content-save"
                                size={20}
                                onPress={onSave}
                                style={styles.saveIconButton}
                            />
                        ) : null}
                    </View>
                    {steps.length > 0 && (
                        <View style={styles.stepsRowMobile}>
                            {steps.map(step => (
                                <Pressable
                                    key={step}
                                    style={[
                                        styles.stepBadge,
                                        step === currentStep ? styles.stepBadgeActive : styles.stepBadgeInactive,
                                    ]}
                                    onPress={() => onStepSelect?.(step)}
                                    disabled={!onStepSelect || step === currentStep}
                                    {...Platform.select({ web: { cursor: onStepSelect ? 'pointer' : 'default' } })}
                                >
                                    <Text
                                        style={[
                                            styles.stepBadgeText,
                                            step === currentStep ? styles.stepBadgeTextActive : styles.stepBadgeTextInactive,
                                        ]}
                                    >
                                        {step}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </>
            ) : (
                <>
                    <View style={styles.leftSection}>
                        {canGoBack && onBack ? (
                            <Pressable
                                onPress={onBack}
                                style={styles.backButton}
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="arrow-left" size={16} color={DESIGN_TOKENS.colors.text} />
                                <Text style={styles.backButtonText}>Назад</Text>
                            </Pressable>
                        ) : null}
                    </View>

                    <View style={styles.centerSection}>
                        {steps.length > 0 && (
                            <View style={styles.stepsRow}>
                                {steps.map(step => (
                                    <Pressable
                                        key={step}
                                        style={[
                                            styles.stepBadge,
                                            step === currentStep ? styles.stepBadgeActive : styles.stepBadgeInactive,
                                        ]}
                                        onPress={() => onStepSelect?.(step)}
                                        disabled={!onStepSelect || step === currentStep}
                                        {...Platform.select({ web: { cursor: onStepSelect ? 'pointer' : 'default' } })}
                                    >
                                        <Text
                                            style={[
                                                styles.stepBadgeText,
                                                step === currentStep ? styles.stepBadgeTextActive : styles.stepBadgeTextInactive,
                                            ]}
                                        >
                                            {step}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                        <Button
                            mode="contained"
                            onPress={onPrimary}
                            style={styles.primaryButton}
                            disabled={primaryDisabled}
                            icon="arrow-right"
                            contentStyle={styles.primaryButtonContent}
                        >
                            {primaryLabel}
                        </Button>
                    </View>

                    <View style={styles.rightSection}>
                        {onSave ? (
                            <Pressable
                                onPress={onSave}
                                style={styles.saveButton}
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="save" size={16} color={DESIGN_TOKENS.colors.textMuted} />
                                <Text style={styles.saveButtonText}>{saveLabel}</Text>
                            </Pressable>
                        ) : null}
                    </View>
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
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        borderTopWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        zIndex: DESIGN_TOKENS.zIndex.sticky,
        ...(Platform.OS === 'web'
            ? ({ boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' } as any)
            : {}),
    },
    footerWeb: {
        position: 'sticky' as any,
        left: 0,
        right: 0,
        bottom: 0,
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
    leftSection: {
        flex: 1,
        alignItems: 'flex-start',
    },
    centerSection: {
        flex: 2,
        alignItems: 'center',
        gap: 6,
    },
    rightSection: {
        flex: 1,
        alignItems: 'flex-end',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    },
    backButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.text,
    },
    backButtonMobile: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    },
    primaryButton: {
        minWidth: 170,
    },
    primaryButtonMobile: {
        flex: 1,
        marginHorizontal: DESIGN_TOKENS.spacing.xs,
    },
    primaryButtonContent: {
        flexDirection: 'row-reverse',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: DESIGN_TOKENS.radii.pill,
    },
    saveButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.textMuted,
    },
    saveIconButton: {
        margin: 0,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    },
    mobileMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    stepsRowMobile: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: DESIGN_TOKENS.spacing.xs,
        width: '100%',
    },
    stepsRow: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        marginBottom: 4,
    },
    stepBadge: {
        minWidth: 28,
        height: 28,
        borderRadius: 14,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    },
    stepBadgeActive: {
        borderColor: DESIGN_TOKENS.colors.primary,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    },
    stepBadgeInactive: {},
    stepBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.textMuted,
    },
    stepBadgeTextActive: {
        color: DESIGN_TOKENS.colors.primaryDark,
    },
    stepBadgeTextInactive: {},
});

export default TravelWizardFooter;
