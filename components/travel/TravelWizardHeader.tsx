import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';

type TravelWizardHeaderProps = {
    canGoBack?: boolean;
    onBack?: () => void;
    title: string;
    subtitle: string;
    progressPercent: number;
    autosaveBadge?: string;
    extraBelowProgress?: React.ReactNode;
    tipTitle?: string;
    tipBody?: string;
    currentStep?: number;
    totalSteps?: number;
    onStepSelect?: (step: number) => void;
    onPreview?: () => void; // ✅ ФАЗА 2: Кнопка превью
};

const TravelWizardHeader: React.FC<TravelWizardHeaderProps> = ({
    canGoBack = false,
    onBack,
    title,
    subtitle,
    progressPercent,
    autosaveBadge,
    extraBelowProgress,
    tipTitle,
    tipBody,
    currentStep,
    totalSteps,
    onStepSelect,
    onPreview, // ✅ ФАЗА 2: Handler превью
}) => {
    const colors = useThemedColors();
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const clamped = Math.min(Math.max(progressPercent, 0), 100);
    
    // ✅ УЛУЧШЕНИЕ: Динамический цвет прогресс-бара на основе процента
    const progressColor = useMemo(() => {
        if (clamped < 33) return colors.danger;
        if (clamped < 67) return colors.warning;
        return colors.success;
    }, [clamped, colors]);

    const [isTipOpen, setIsTipOpen] = useState(false);
    const hasTip = !!tipBody && tipBody.trim().length > 0;
    const resolvedTipTitle = useMemo(() => tipTitle ?? 'Совет', [tipTitle]);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с использованием динамических цветов
    const styles = useMemo(() => createStyles(colors), [colors]);

    const TipTrigger = hasTip ? (
        <Pressable
            onPress={() => setIsTipOpen(v => !v)}
            style={({ pressed }) => [
                styles.tipToggleButton,
                isTipOpen && styles.tipToggleButtonActive,
                globalFocusStyles.focusable,
                pressed && { opacity: 0.8 }
            ]}
            accessibilityRole="button"
            accessibilityLabel={isTipOpen ? 'Скрыть совет' : 'Показать совет'}
            {...Platform.select({ web: { cursor: 'pointer' } })}
        >
            <Feather
                name="help-circle"
                size={isMobile ? 14 : 16}
                color={isTipOpen ? colors.primary : colors.textMuted}
            />
            {!isMobile && (
                <Text style={[styles.tipToggleText, isTipOpen && styles.tipToggleTextActive]} numberOfLines={1}>
                    {resolvedTipTitle}
                </Text>
            )}
        </Pressable>
    ) : null;

    const BackButton = canGoBack ? (
        <Pressable
            onPress={onBack}
            style={({ pressed }) => [
                styles.backButton,
                globalFocusStyles.focusable,
                pressed && { opacity: 0.8 }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            disabled={!onBack}
            {...Platform.select({ web: { cursor: 'pointer' } })}
        >
            <Feather name="arrow-left" size={16} color={colors.text} />
            <Text style={styles.backButtonText}>Назад</Text>
        </Pressable>
    ) : null;

    return (
        <View style={[styles.headerWrapper, isMobile && styles.headerWrapperMobile]}>
            <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
                {BackButton}
                <View style={styles.titleColumn}>
                    {isMobile ? (
                        <>
                            <Text style={styles.headerTitleMobile} numberOfLines={1}>
                                {title}
                            </Text>
                            <Text style={styles.headerSubtitleMobile} numberOfLines={1}>
                                {subtitle} • {clamped}% готово
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.headerTitle} numberOfLines={1}>
                                {title}
                            </Text>
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                {subtitle} • {clamped}% готово
                            </Text>
                        </>
                    )}
                </View>
                <View style={styles.headerRightRow}>
                    {/* ✅ ФАЗА 2: Кнопка превью */}
                    {onPreview && (
                        <Pressable
                            onPress={onPreview}
                            style={({ pressed }) => [
                                styles.previewButton,
                                globalFocusStyles.focusable,
                                pressed && { opacity: 0.8 }
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Показать превью"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="eye" size={16} color={colors.primary} />
                            {!isMobile && (
                                <Text style={styles.previewButtonText}>Превью</Text>
                            )}
                        </Pressable>
                    )}
                    {TipTrigger}
                    {autosaveBadge ? <Text style={styles.autosaveBadge}>{autosaveBadge}</Text> : null}
                </View>
            </View>

            {/* ✅ УЛУЧШЕНИЕ: Милестоны над прогресс-баром */}
            {!isMobile && totalSteps && currentStep && totalSteps > 1 && (
                <View style={styles.milestonesWrapper}>
                    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                        <Pressable
                            key={step}
                            onPress={() => onStepSelect?.(step)}
                            style={({ pressed }) => [
                                styles.milestone,
                                step <= currentStep && styles.milestoneActive,
                                pressed && { opacity: 0.7 }
                            ]}
                            disabled={!onStepSelect}
                            accessibilityRole="button"
                            accessibilityLabel={`Перейти к шагу ${step}`}
                            {...Platform.select({ web: { cursor: onStepSelect ? 'pointer' : 'default' } })}
                        >
                            <View style={[
                                styles.milestoneCircle,
                                step <= currentStep && styles.milestoneCircleActive
                            ]}>
                                {step < currentStep ? (
                                    <Feather name="check" size={10} color={colors.primary} />
                                ) : (
                                    <Text style={[
                                        styles.milestoneNumber,
                                        step === currentStep && styles.milestoneNumberActive
                                    ]}>
                                        {step}
                                    </Text>
                                )}
                            </View>
                        </Pressable>
                    ))}
                </View>
            )}

            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${clamped}%`, backgroundColor: progressColor }]} />
            </View>

            {hasTip && isTipOpen ? (
                <View style={styles.tipPanel}>
                    <Text style={styles.tipPanelTitle}>{resolvedTipTitle}</Text>
                    <Text style={styles.tipPanelBody}>{tipBody}</Text>
                </View>
            ) : null}

            {extraBelowProgress}
        </View>
    );
};

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    headerWrapper: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        paddingBottom: DESIGN_TOKENS.spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerWrapperMobile: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingTop: DESIGN_TOKENS.spacing.xs,
        paddingBottom: DESIGN_TOKENS.spacing.xs,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    headerRowMobile: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    headerRightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        minHeight: 44, // ✅ ДОСТУПНОСТЬ: Минимальная высота touch target
        paddingHorizontal: 10,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    backButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
    },
    titleColumn: {
        flex: 1,
        minWidth: 0,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    headerTitleMobile: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: '500',
    },
    headerSubtitleMobile: {
        fontSize: 12,
        color: colors.textMuted,
    },
    autosaveBadge: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.primarySoft,
    },
    // ✅ ФАЗА 2: Стили для кнопки превью
    previewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.primary + '40',
        minHeight: 32,
    },
    previewButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: '700',
        color: colors.primary,
    },
    mobileMetaRow: {
        marginTop: 0,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    autosaveBadgeText: {
        fontSize: 11,
        color: colors.primary,
        fontWeight: '600',
    },
    tipToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        height: 32,
        minHeight: 44, // ✅ ДОСТУПНОСТЬ: Минимальная высота touch target
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tipToggleButtonActive: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
    },
    tipToggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
    },
    tipToggleTextActive: {
        color: colors.primary,
    },
    progressBarTrack: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        width: '100%',
        height: 6,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.border,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: DESIGN_TOKENS.radii.pill,
    },
    tipPanel: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.sm,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tipPanelTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    tipPanelBody: {
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 16,
    },
    // ✅ УЛУЧШЕНИЕ: Стили для милестонов
    milestonesWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: DESIGN_TOKENS.spacing.sm,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: 4,
    },
    milestone: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
        minHeight: 28,
    },
    milestoneActive: {
        // активные милестоны
    },
    milestoneCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    milestoneCircleActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    milestoneNumber: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textMuted,
    },
    milestoneNumberActive: {
        color: colors.primary,
    },
});

export default React.memo(TravelWizardHeader);
