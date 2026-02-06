import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { Button as PaperButton, IconButton as PaperIconButton } from '@/ui/paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';

interface TravelWizardFooterProps {
    canGoBack?: boolean;
    onBack?: () => void;
    onPrimary: () => void;
    onSave?: () => void;
    onQuickDraft?: () => void; // ✅ НОВОЕ: Кнопка быстрого черновика
    primaryLabel: string;
    saveLabel?: string;
    quickDraftLabel?: string; // ✅ НОВОЕ: Текст для кнопки быстрого черновика
    primaryDisabled?: boolean;
    onLayout?: (event: any) => void;
    currentStep?: number;
    totalSteps?: number;
    onStepSelect?: (step: number) => void;
}

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
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
        minHeight: 44, // ✅ ДОСТУПНОСТЬ: Минимальная высота touch target
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.surfaceMuted,
    },
    backButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
    },
    backButtonMobile: {
        width: 44, // ✅ ДОСТУПНОСТЬ: Минимальный размер touch target
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
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
    // ✅ НОВОЕ: Стили для кнопки быстрого черновика
    buttonsRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    quickDraftButton: {
        minWidth: 150,
    },
    quickDraftButtonMobile: {
        minWidth: 50,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 44, // ✅ ДОСТУПНОСТЬ: Минимальная высота touch target
        borderRadius: DESIGN_TOKENS.radii.pill,
    },
    saveButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.textMuted,
    },
    saveIconButton: {
        margin: 0,
        backgroundColor: colors.surfaceMuted,
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
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
    },
    stepBadgeActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    stepBadgeInactive: {},
    stepBadgeText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '700',
        color: colors.textMuted,
    },
    stepBadgeTextActive: {
        color: colors.primary,
    },
    stepBadgeTextInactive: {},
});

const TravelWizardFooter: React.FC<TravelWizardFooterProps> = ({
    canGoBack = true,
    onBack,
    onPrimary,
    onSave,
    onQuickDraft, // ✅ НОВОЕ: Handler быстрого черновика
    primaryLabel,
    saveLabel = 'Сохранить',
    quickDraftLabel = 'Быстрый черновик', // ✅ НОВОЕ: Текст кнопки
    primaryDisabled = false,
    onLayout,
    currentStep,
    totalSteps,
    onStepSelect,
}) => {
    const colors = useThemedColors();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const isWeb = Platform.OS === 'web';
    const insets = useSafeAreaInsets();

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

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
                            <IconButton
                                icon={<Feather name="arrow-left" size={18} color={colors.text} />}
                                label="Назад"
                                onPress={onBack}
                                size="sm"
                                style={styles.backButtonMobile}
                                testID="travel-wizard-back"
                            />
                        ) : null}

                        {/* ✅ НОВОЕ: Кнопка быстрого черновика на мобильном */}
                        {onQuickDraft && (
                            <PaperButton
                                mode="outlined"
                                onPress={onQuickDraft}
                                style={styles.quickDraftButtonMobile}
                                compact
                            >
                                <Feather name="save" size={16} color={colors.text} />
                            </PaperButton>
                        )}

                        <PaperButton
                            mode="contained"
                            onPress={onPrimary}
                            style={styles.primaryButtonMobile}
                            disabled={primaryDisabled}
                            icon="arrow-right"
                            contentStyle={styles.primaryButtonContent}
                        >
                            {primaryLabel}
                        </PaperButton>

                        {onSave ? (
                            <PaperIconButton
                                icon="content-save"
                                size={20}
                                onPress={onSave}
                                accessibilityLabel={saveLabel}
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
                                    disabled={!onStepSelect}
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
                            <Button
                                label="Назад"
                                onPress={onBack}
                                variant="secondary"
                                size="sm"
                                icon={<Feather name="arrow-left" size={16} color={colors.text} />}
                                style={styles.backButton}
                                labelStyle={styles.backButtonText}
                                accessibilityLabel="Назад"
                            />
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
                                        disabled={!onStepSelect}
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
                        <View style={styles.buttonsRow}>
                            {/* ✅ НОВОЕ: Кнопка быстрого черновика */}
                            {onQuickDraft && (
                                <PaperButton
                                    mode="outlined"
                                    onPress={onQuickDraft}
                                    style={styles.quickDraftButton}
                                    icon="content-save-outline"
                                >
                                    {quickDraftLabel}
                                </PaperButton>
                            )}
                            <PaperButton
                                mode="contained"
                                onPress={onPrimary}
                                style={styles.primaryButton}
                                disabled={primaryDisabled}
                                icon="arrow-right"
                                contentStyle={styles.primaryButtonContent}
                            >
                                {primaryLabel}
                            </PaperButton>
                        </View>
                    </View>

                    <View style={styles.rightSection}>
                        {onSave ? (
                            <Button
                                label={saveLabel}
                                onPress={onSave}
                                variant="ghost"
                                size="sm"
                                icon={<Feather name="save" size={16} color={colors.textMuted} />}
                                style={styles.saveButton}
                                labelStyle={styles.saveButtonText}
                                accessibilityLabel={saveLabel}
                            />
                        ) : null}
                    </View>
                </>
            )}
        </View>
    );
};


export default React.memo(TravelWizardFooter);
