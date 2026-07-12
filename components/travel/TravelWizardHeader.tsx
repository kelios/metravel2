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
    errorCount?: number;
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

const WIZARD_STEP_LABELS = [
    'основная информация',
    'маршрут',
    'медиа',
    'детали',
    'дополнительные параметры',
    'публикация',
];

const getStepLabel = (step: number) => WIZARD_STEP_LABELS[step - 1] ?? `шаг ${step}`;
const getErrorWord = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'ошибка';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ошибки';
    return 'ошибок';
};

const TravelWizardHeader: React.FC<TravelWizardHeaderProps> = ({
    canGoBack = false,
    onBack,
    title,
    subtitle,
    progressPercent,
    errorCount = 0,
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
    
    // Keep progress neutral; validation errors are announced and shown separately.
    const progressColor = useMemo(() => {
        if (clamped >= 100) return colors.success;
        return colors.primary;
    }, [clamped, colors.primary, colors.success]);
    const hasErrors = errorCount > 0;
    const progressA11yLabel = useMemo(() => {
        const stepText = currentStep && totalSteps ? `Шаг ${currentStep} из ${totalSteps}` : 'Прогресс заполнения';
        const statusText = hasErrors
            ? `${errorCount} ${getErrorWord(errorCount)}`
            : clamped >= 100
                ? 'заполнен'
                : 'в процессе заполнения';
        return `${stepText}: ${statusText}, ${clamped}%`;
    }, [clamped, currentStep, errorCount, hasErrors, totalSteps]);

    const [isTipOpen, setIsTipOpen] = useState(false);
    const hasTip = !!tipBody && tipBody.trim().length > 0;
    const resolvedTipTitle = tipTitle ?? 'Совет';

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с использованием динамических цветов
    const styles = useMemo(() => createWizardHeaderStyles(colors), [colors]);

    type MenuItem = {
        key: string;
        icon: React.ComponentProps<typeof Feather>['name'];
        label: string;
        onPress: () => void;
        testID?: string;
    };

    const menuItems = useMemo<MenuItem[]>(() => {
        const items: MenuItem[] = [];
        if (onPreview) {
            items.push({ key: 'preview', icon: 'eye', label: 'Превью', onPress: onPreview, testID: 'travel-wizard-preview' });
        }
        if (onOpenPublic) {
            items.push({ key: 'open-public', icon: 'external-link', label: 'Открыть путешествие', onPress: onOpenPublic });
        }
        if ((warningCount ?? 0) > 0 && onWarningsPress) {
            items.push({ key: 'warnings', icon: 'info', label: `Предупреждения: ${warningCount}`, onPress: onWarningsPress });
        }
        if (hasTip) {
            items.push({
                key: 'tips',
                icon: 'help-circle',
                label: isTipOpen ? 'Скрыть советы' : 'Показать советы',
                onPress: () => setIsTipOpen(v => !v),
            });
        }
        if (onQuickDraft) {
            items.push({ key: 'quick-draft', icon: 'archive', label: quickDraftLabel, onPress: onQuickDraft, testID: 'travel-wizard-quick-draft' });
        }
        // «Сохранить» вынесено отдельной видимой кнопкой в ряд действий (SaveButton),
        // чтобы сохранять без открытия меню «…».
        return items;
    }, [onPreview, onOpenPublic, warningCount, onWarningsPress, hasTip, isTipOpen, onQuickDraft, quickDraftLabel]);

    const handleMenuItemPress = useCallback((item: MenuItem) => {
        setIsMenuOpen(false);
        item.onPress();
    }, []);

    const MoreMenuTrigger = menuItems.length > 0 ? (
        <Pressable
            onPress={() => setIsMenuOpen(v => !v)}
            style={({ pressed }) => [
                styles.iconButton,
                isMobile && styles.iconButtonMobile,
                isMenuOpen && styles.iconButtonActive,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.8 },
            ]}
            testID="travel-wizard-more"
            accessibilityRole="button"
            accessibilityLabel={isMenuOpen ? 'Закрыть меню действий' : 'Открыть меню действий'}
            accessibilityState={{ expanded: isMenuOpen }}
        >
            <Feather name="more-horizontal" size={18} color={isMenuOpen ? colors.primary : colors.textMuted} />
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

    const SaveButton = onSave ? (
        isMobile ? (
            <Pressable
                onPress={onSave}
                style={({ pressed }) => [
                    styles.iconButton,
                    styles.iconButtonMobile,
                    globalFocusStyles.focusable,
                    Platform.OS === 'web' && { cursor: 'pointer' },
                    pressed && { opacity: 0.8 },
                ]}
                testID="travel-wizard-save"
                accessibilityRole="button"
                accessibilityLabel={saveLabel}
            >
                <Feather name="save" size={18} color={colors.textMuted} />
            </Pressable>
        ) : (
            <Pressable
                onPress={onSave}
                style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionButtonSecondary,
                    globalFocusStyles.focusable,
                    Platform.OS === 'web' && { cursor: 'pointer' },
                    pressed && { opacity: 0.9 },
                ]}
                testID="travel-wizard-save"
                accessibilityRole="button"
                accessibilityLabel={saveLabel}
            >
                <Feather name="save" size={16} color={colors.text} />
                <Text style={styles.actionButtonText} numberOfLines={1}>{saveLabel}</Text>
            </Pressable>
        )
    ) : null;

    const MoreMenuPanel = isMenuOpen && menuItems.length > 0 ? (
        <View style={styles.menuPanel} accessibilityRole="menu">
            {menuItems.map((item) => (
                <Pressable
                    key={item.key}
                    onPress={() => handleMenuItemPress(item)}
                    testID={item.testID}
                    accessibilityRole="menuitem"
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [
                        styles.menuItem,
                        globalFocusStyles.focusable,
                        Platform.OS === 'web' && { cursor: 'pointer' },
                        pressed && { backgroundColor: colors.surfaceMuted },
                    ]}
                >
                    <Feather name={item.icon} size={16} color={colors.textMuted} />
                    <Text style={styles.menuItemText} numberOfLines={1}>{item.label}</Text>
                </Pressable>
            ))}
        </View>
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
                    {SaveButton}
                    {MoreMenuTrigger}
                </View>
            </View>

            {MoreMenuPanel}

            <Text
                style={isMobile ? styles.headerSubtitleMobile : styles.headerSubtitle}
                numberOfLines={isMobile ? 2 : 2}
            >
                {subtitle}
            </Text>

            <View
                style={styles.progressBarTrack}
                accessibilityRole="progressbar"
                accessibilityLabel={progressA11yLabel}
                accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: clamped,
                    text: progressA11yLabel,
                }}
                {...(Platform.OS === 'web'
                    ? ({
                        'aria-valuemin': 0,
                        'aria-valuemax': 100,
                        'aria-valuenow': clamped,
                        'aria-valuetext': progressA11yLabel,
                    } as any)
                    : null)}
                testID="travel-wizard-progress"
            >
                <View style={[styles.progressBarFill, { width: `${clamped}%`, backgroundColor: progressColor }]} />
            </View>

            <View style={[styles.progressMetaRow, styles.progressMetaRowInline]}>
                <View style={styles.progressStatusGroup}>
                    <Text style={styles.progressMetaText} numberOfLines={1}>
                        Шаг {currentStep ?? 1}/{totalSteps ?? 1} • {clamped}%
                    </Text>
                    {hasErrors ? (
                        <View style={styles.progressErrorBadge}>
                            <Feather name="alert-circle" size={12} color={colors.danger} />
                            <Text style={styles.progressErrorText} numberOfLines={1}>
                                Ошибки: {errorCount}
                            </Text>
                        </View>
                    ) : null}
                </View>
                {autosaveBadge ? (
                    <Text
                        style={styles.autosaveBadgeText}
                        numberOfLines={1}
                        accessibilityLiveRegion="polite"
                    >
                        {autosaveBadge}
                    </Text>
                ) : null}
            </View>

            {!isMobile && totalSteps && currentStep && totalSteps > 1 ? (
                <View style={styles.belowProgressRow}>
                    <View style={styles.belowProgressLeft}>
                        {BackButton}
                        <View style={styles.milestonesInlineWrapper}>
                            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                                <Pressable
                                    key={step}
                                    onPress={() => onStepSelect?.(step)}
                                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    style={({ pressed }) => [
                                        styles.milestoneInline,
                                        step === currentStep && styles.milestoneInlineActive,
                                        pressed && { opacity: 0.7 }
                                    ]}
                                    disabled={!onStepSelect}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Перейти к шагу ${step}: ${getStepLabel(step)}`}
                                    accessibilityState={{ selected: step === currentStep, disabled: !onStepSelect }}
                                >
                                    {step < currentStep ? (
                                        <Feather name="check" size={12} color={colors.primaryDark} />
                                    ) : (
                                        <Text style={[styles.milestoneInlineNumber, step === currentStep && styles.milestoneInlineNumberActive]}>
                                            {step}
                                        </Text>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View style={styles.belowProgressRight}>
                        {PrimaryAction}
                    </View>
                </View>
            ) : null}

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
