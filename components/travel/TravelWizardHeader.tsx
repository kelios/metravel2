import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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
    warningCount?: number;
    onWarningsPress?: () => void;
    autosaveBadge?: string;
    onPrimary?: () => void;
    primaryLabel?: string;
    primaryTestID?: string;
    primaryDisabled?: boolean;
    onSave?: () => void;
    saveLabel?: string;
    onQuickDraft?: () => void;
    quickDraftLabel?: string;
    extraBelowProgress?: React.ReactNode;
    tipTitle?: string;
    tipBody?: string;
    currentStep?: number;
    totalSteps?: number;
    onStepSelect?: (step: number) => void;
    onPreview?: () => void; // ✅ ФАЗА 2: Кнопка превью
    onOpenPublic?: () => void;
};

const TravelWizardHeader: React.FC<TravelWizardHeaderProps> = ({
    canGoBack = false,
    onBack,
    title,
    subtitle,
    progressPercent,
    warningCount,
    onWarningsPress,
    autosaveBadge,
    onPrimary,
    primaryLabel,
    primaryTestID,
    primaryDisabled = false,
    onSave,
    saveLabel = 'Сохранить',
    onQuickDraft,
    quickDraftLabel = 'Быстрый черновик',
    extraBelowProgress,
    tipTitle,
    tipBody,
    currentStep,
    totalSteps,
    onStepSelect,
    onPreview, // ✅ ФАЗА 2: Handler превью
    onOpenPublic,
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

    const [hoveredAction, setHoveredAction] = useState<string | null>(null);
    const showHover = useCallback((id: string) => {
        if (Platform.OS !== 'web') return;
        setHoveredAction(id);
    }, []);
    const hideHover = useCallback(() => {
        if (Platform.OS !== 'web') return;
        setHoveredAction(null);
    }, []);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с использованием динамических цветов
    const styles = useMemo(() => createStyles(colors), [colors]);

    const TipTrigger = hasTip ? (
        <Pressable
            onPress={() => setIsTipOpen(v => !v)}
            style={({ pressed }) => [
                styles.iconButton,
                isMobile && styles.iconButtonMobile,
                isTipOpen && styles.iconButtonActive,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.8 }
            ]}
            accessibilityRole="button"
            accessibilityLabel={isTipOpen ? 'Скрыть советы' : 'Показать советы'}
            onHoverIn={() => showHover('tips')}
            onHoverOut={hideHover}
        >
            <Feather
                name="help-circle"
                size={16}
                color={isTipOpen ? colors.primary : colors.textMuted}
            />
            {Platform.OS === 'web' && hoveredAction === 'tips' ? (
                <View style={styles.tooltipBubble}>
                    <Text style={styles.tooltipText}>{isTipOpen ? 'Скрыть советы' : 'Показать советы'}</Text>
                </View>
            ) : null}
        </Pressable>
    ) : null;

    const OpenPublicAction = onOpenPublic ? (
        <Pressable
            onPress={onOpenPublic}
            style={({ pressed }) => [
                styles.iconButton,
                isMobile && styles.iconButtonMobile,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.8 }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Открыть статью"
            onHoverIn={() => showHover('open-public')}
            onHoverOut={hideHover}
        >
            <Feather name="external-link" size={16} color={colors.textMuted} />
            {Platform.OS === 'web' && hoveredAction === 'open-public' ? (
                <View style={styles.tooltipBubble}>
                    <Text style={styles.tooltipText}>Открыть статью</Text>
                </View>
            ) : null}
        </Pressable>
    ) : null;

    const BackButton = canGoBack ? (
        <Pressable
            onPress={onBack}
            style={({ pressed }) => [
                styles.backButton,
                isMobile && styles.backButtonMobile,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.8 }
            ]}
            testID="travel-wizard-back"
            accessibilityRole="button"
            accessibilityLabel="Назад"
            disabled={!onBack}
        >
            <Feather name="arrow-left" size={16} color={colors.text} />
            <Text style={styles.backButtonText}>Назад</Text>
        </Pressable>
    ) : null;

    const PrimaryAction = onPrimary && primaryLabel ? (
        <Pressable
            onPress={onPrimary}
            disabled={primaryDisabled}
            style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonPrimary,
                isMobile && styles.actionButtonMobile,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: primaryDisabled ? 'default' : 'pointer' },
                primaryDisabled && styles.actionButtonDisabled,
                pressed && !primaryDisabled && { opacity: 0.9 },
            ]}
            testID={primaryTestID}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
        >
            <Text style={styles.actionButtonPrimaryText} numberOfLines={1}>
                {primaryLabel}
            </Text>
            <Feather name="arrow-right" size={16} color={colors.textOnPrimary} />
        </Pressable>
    ) : null;

    const SaveAction = onSave ? (
        <Pressable
            onPress={onSave}
            style={({ pressed }) => [
                styles.iconButton,
                isMobile && styles.iconButtonMobile,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
            onHoverIn={() => showHover('save')}
            onHoverOut={hideHover}
        >
            <Feather name="save" size={16} color={colors.textMuted} />
            {Platform.OS === 'web' && hoveredAction === 'save' ? (
                <View style={styles.tooltipBubble}>
                    <Text style={styles.tooltipText}>{saveLabel}</Text>
                </View>
            ) : null}
        </Pressable>
    ) : null;

    const QuickDraftAction = onQuickDraft ? (
        <Pressable
            onPress={onQuickDraft}
            style={({ pressed }) => [
                styles.iconButton,
                isMobile && styles.iconButtonMobile,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={quickDraftLabel}
            testID="travel-wizard-quick-draft"
            onHoverIn={() => showHover('draft')}
            onHoverOut={hideHover}
        >
            <Feather name="archive" size={16} color={colors.textMuted} />
            {Platform.OS === 'web' && hoveredAction === 'draft' ? (
                <View style={styles.tooltipBubble}>
                    <Text style={styles.tooltipText}>{quickDraftLabel}</Text>
                </View>
            ) : null}
        </Pressable>
    ) : null;

    const WarningsAction = isMobile && (warningCount ?? 0) > 0 ? (
        <Pressable
            onPress={onWarningsPress}
            style={({ pressed }) => [
                styles.iconButton,
                isMobile && styles.iconButtonMobile,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: onWarningsPress ? 'pointer' : 'default' },
                pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Предупреждения: ${warningCount}`}
            disabled={!onWarningsPress}
        >
            <Feather name="info" size={16} color={colors.warning} />
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{warningCount}</Text>
            </View>
        </Pressable>
    ) : null;

    return (
        <View style={[styles.headerWrapper, isMobile && styles.headerWrapperMobile]}>
            {isMobile ? (
                <View style={styles.topNavRow}>
                    <View style={styles.leftNav}>
                        {BackButton}
                    </View>
                    <View style={styles.rightNav}>{PrimaryAction}</View>
                </View>
            ) : null}

            <View style={styles.titleRow}>
                <View style={styles.titleColumn}>
                    <Text style={isMobile ? styles.headerTitleMobile : styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                </View>

                <View style={styles.titleActionsRow}>
                    {onPreview && (
                        <Pressable
                            onPress={onPreview}
                            style={({ pressed }) => [
                                styles.iconButton,
                                isMobile && styles.iconButtonMobile,
                                globalFocusStyles.focusable,
                                Platform.OS === 'web' && { cursor: 'pointer' },
                                pressed && { opacity: 0.8 }
                            ]}
                            testID="travel-wizard-preview"
                            accessibilityRole="button"
                            accessibilityLabel="Показать превью"
                            onHoverIn={() => showHover('preview')}
                            onHoverOut={hideHover}
                        >
                            <Feather name="eye" size={16} color={colors.textMuted} />
                            {Platform.OS === 'web' && hoveredAction === 'preview' ? (
                                <View style={styles.tooltipBubble}>
                                    <Text style={styles.tooltipText}>Превью</Text>
                                </View>
                            ) : null}
                        </Pressable>
                    )}
                    {OpenPublicAction}
                    {WarningsAction}
                    {TipTrigger}
                    {QuickDraftAction}
                    {SaveAction}
                </View>
            </View>

            <Text
                style={isMobile ? styles.headerSubtitleMobile : styles.headerSubtitle}
                numberOfLines={isMobile ? 1 : 2}
            >
                {subtitle}
            </Text>

            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${clamped}%`, backgroundColor: progressColor }]} />
            </View>

            <View style={styles.progressMetaRow}>
                {autosaveBadge ? (
                    <Text style={styles.autosaveBadgeText} numberOfLines={1}>
                        {autosaveBadge}
                    </Text>
                ) : (
                    <Text style={styles.progressMetaText} numberOfLines={1}>
                        Шаг {currentStep ?? 1}/{totalSteps ?? 1} • {clamped}%
                    </Text>
                )}
            </View>

            <View style={[styles.belowProgressRow, isMobile && styles.belowProgressRowMobile]}>
                <View style={styles.belowProgressLeft}>
                    {!isMobile ? BackButton : null}
                    {!isMobile && totalSteps && currentStep && totalSteps > 1 ? (
                        <View style={styles.milestonesInlineWrapper}>
                            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                                <Pressable
                                    key={step}
                                    onPress={() => onStepSelect?.(step)}
                                    style={({ pressed }) => [
                                        styles.milestoneInline,
                                        step === currentStep && styles.milestoneInlineActive,
                                        pressed && { opacity: 0.7 }
                                    ]}
                                    disabled={!onStepSelect}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Перейти к шагу ${step}`}
                                >
                                    {step < currentStep ? (
                                        <Feather name="check" size={12} color={colors.primary} />
                                    ) : (
                                        <Text style={[styles.milestoneInlineNumber, step === currentStep && styles.milestoneInlineNumberActive]}>
                                            {step}
                                        </Text>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    ) : null}
                </View>

                <View style={styles.belowProgressRight}>
                    {!isMobile ? PrimaryAction : null}
                </View>
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
    topNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    leftNav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
        flex: 1,
        minWidth: 0,
    },
    rightNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        flexShrink: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.sm,
        marginTop: DESIGN_TOKENS.spacing.xs,
    },
    titleActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        flexShrink: 0,
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
    iconButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        minHeight: 44, // ✅ ДОСТУПНОСТЬ: Минимальная высота touch target
        borderRadius: DESIGN_TOKENS.radii.pill,
        position: 'relative',
        backgroundColor: colors.surfaceMuted,
        borderWidth: 0,
    },
    iconButtonMobile: {
        width: 36,
        height: 36,
        minHeight: 36,
    },
    iconButtonActive: {
        backgroundColor: colors.primarySoft,
        borderWidth: 0,
    },
    tooltipBubble: {
        position: 'absolute',
        top: '100%',
        marginTop: 6,
        left: '50%',
        transform: [{ translateX: -80 }],
        width: 160,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.text,
        zIndex: 1000,
        ...(Platform.OS === 'web'
            ? ({ pointerEvents: 'none' } as any)
            : ({} as any)),
    },
    tooltipText: {
        fontSize: 12,
        color: colors.background,
        fontWeight: '600',
        textAlign: 'center',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        backgroundColor: colors.warning,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textOnPrimary,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        height: 32,
        minHeight: 44, // ✅ ДОСТУПНОСТЬ: Минимальная высота touch target
        borderRadius: DESIGN_TOKENS.radii.pill,
        borderWidth: 1,
    },
    actionButtonMobile: {
        minHeight: 36,
        height: 36,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    actionButtonSecondary: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
    },
    actionButtonPrimary: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
    },
    actionButtonPrimaryText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textOnPrimary,
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
    backButtonMobile: {
        minHeight: 36,
        height: 36,
        paddingHorizontal: 10,
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
    titleBlock: {
        marginTop: DESIGN_TOKENS.spacing.xs,
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
    progressMetaRow: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        minHeight: 18,
    },
    progressMetaText: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '500',
    },
    belowProgressRow: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.md,
    },
    belowProgressRowMobile: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        gap: DESIGN_TOKENS.spacing.sm,
    },
    belowProgressLeft: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    belowProgressRight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
    },
    webActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: DESIGN_TOKENS.spacing.xs,
        flexWrap: 'nowrap',
    },
    milestonesInlineWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        flexWrap: 'nowrap',
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
    milestoneInline: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    milestoneInlineActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    milestoneInlineNumber: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textMuted,
    },
    milestoneInlineNumberActive: {
        color: colors.primary,
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
