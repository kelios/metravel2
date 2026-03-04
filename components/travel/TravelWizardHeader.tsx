import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { createWizardHeaderStyles } from './travelWizardHeaderStyles';

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
    const styles = useMemo(() => createWizardHeaderStyles(colors), [colors]);

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

            <View style={[styles.titleRow, isMobile && styles.titleRowMobile]}>
                <View style={styles.titleColumn}>
                    <Text style={isMobile ? styles.headerTitleMobile : styles.headerTitle} numberOfLines={isMobile ? 2 : 1}>
                        {title}
                    </Text>
                </View>

                <View style={[styles.titleActionsRow, isMobile && styles.titleActionsRowMobile]}>
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


export default React.memo(TravelWizardHeader);
