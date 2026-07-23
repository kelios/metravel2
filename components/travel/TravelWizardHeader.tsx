import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { createWizardHeaderStyles } from './travelWizardHeaderStyles';
import { selectPlural, translate as i18nT } from '@/i18n'
import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet';


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
    isSaveInFlight?: boolean;
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

const WIZARD_STEP_LABEL_KEYS = [
    'travel:components.travel.TravelWizardHeader.step.basic',
    'travel:components.travel.TravelWizardHeader.step.route',
    'travel:components.travel.TravelWizardHeader.step.media',
    'travel:components.travel.TravelWizardHeader.step.details',
    'travel:components.travel.TravelWizardHeader.step.extras',
    'travel:components.travel.TravelWizardHeader.step.publish',
] as const;

const getStepLabel = (step: number) => {
    const key = WIZARD_STEP_LABEL_KEYS[step - 1];
    return key
        ? i18nT(key)
        : i18nT('travel:components.travel.TravelWizardHeader.step.fallback', { value1: step });
};
const getErrorWord = (count: number) => {
    return selectPlural(count, {
        one: i18nT('travel:components.travel.TravelWizardHeader.oshibka_a24d9705'),
        few: i18nT('travel:components.travel.TravelWizardHeader.oshibki_7adc89cc'),
        many: i18nT('travel:components.travel.TravelWizardHeader.oshibok_1e6e7337'),
        other: i18nT('travel:components.travel.TravelWizardHeader.oshibok_1e6e7337'),
    });
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
    saveLabel = i18nT('travel:components.travel.TravelWizardHeader.sohranit_677207f6'),
    isSaveInFlight = false,
    onQuickDraft,
    quickDraftLabel = i18nT('travel:components.travel.TravelWizardHeader.bystryy_chernovik_21be8842'),
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
    const { isHydrated, isMobile: isMobileViewport } = useResponsive();
    const isMobile = isHydrated && isMobileViewport;
    const clamped = Math.min(Math.max(progressPercent, 0), 100);
    
    // Keep progress neutral; validation errors are announced and shown separately.
    const progressColor = useMemo(() => {
        if (clamped >= 100) return colors.success;
        return colors.primary;
    }, [clamped, colors.primary, colors.success]);
    const hasErrors = errorCount > 0;
    const saveA11yLabel = isSaveInFlight ? i18nT('travel:components.travel.TravelWizardHeader.sohranyaem_izmeneniya_81a20529') : saveLabel;
    const saveButtonLabel = isSaveInFlight ? i18nT('travel:components.travel.TravelWizardHeader.sohranyaem_338ed1a3') : saveLabel;
    const saveStatusBadge = isSaveInFlight ? i18nT('travel:components.travel.TravelWizardHeader.sohranyaem_izmeneniya_b7fc5933') : autosaveBadge;
    // На мобильном убираем дублирующий счётчик «(шаг X из 6)» из подписи кнопки —
    // он уже показан в мета-строке «Шаг X/Y • Z%». Кнопка становится короче.
    const compactPrimaryLabel = useMemo(
        () => (isMobile && primaryLabel
            ? primaryLabel.replace(new RegExp(i18nT('travel:components.travel.TravelWizardHeader.compactStepSuffixPattern'), 'i'), '').trim()
            : primaryLabel),
        [isMobile, primaryLabel],
    );
    const progressA11yLabel = useMemo(() => {
        const stepText = currentStep && totalSteps ? i18nT('travel:components.travel.TravelWizardHeader.shag_value1_iz_value2_72e20b2b', { value1: currentStep, value2: totalSteps }) : i18nT('travel:components.travel.TravelWizardHeader.progress_zapolneniya_bb57af35');
        const statusText = hasErrors
            ? `${errorCount} ${getErrorWord(errorCount)}`
            : clamped >= 100
                ? i18nT('travel:components.travel.TravelWizardHeader.zapolnen_1b191471')
                : i18nT('travel:components.travel.TravelWizardHeader.v_protsesse_zapolneniya_f6cbdd38');
        return `${stepText}: ${statusText}, ${clamped}%`;
    }, [clamped, currentStep, errorCount, hasErrors, totalSteps]);

    const [isTipOpen, setIsTipOpen] = useState(false);
    const hasTip = !!tipBody && tipBody.trim().length > 0;
    const resolvedTipTitle = tipTitle ?? i18nT('travel:components.travel.TravelWizardHeader.defaultTipTitle');

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isStepMenuOpen, setIsStepMenuOpen] = useState(false);

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
            items.push({ key: 'preview', icon: 'eye', label: i18nT('travel:components.travel.TravelWizardHeader.prevyu_f84e6e91'), onPress: onPreview, testID: 'travel-wizard-preview' });
        }
        if (onOpenPublic) {
            items.push({ key: 'open-public', icon: 'external-link', label: i18nT('travel:components.travel.TravelWizardHeader.otkryt_puteshestvie_59598d9f'), onPress: onOpenPublic });
        }
        if ((warningCount ?? 0) > 0 && onWarningsPress) {
            items.push({ key: 'warnings', icon: 'info', label: i18nT('travel:components.travel.TravelWizardHeader.preduprezhdeniya_value1_1599a703', { value1: warningCount }), onPress: onWarningsPress });
        }
        if (hasTip) {
            items.push({
                key: 'tips',
                icon: 'help-circle',
                label: isTipOpen ? i18nT('travel:components.travel.TravelWizardHeader.skryt_sovety_2dc73b5e') : i18nT('travel:components.travel.TravelWizardHeader.pokazat_sovety_02848ddd'),
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

    const handleMoreMenuToggle = useCallback(() => {
        setIsStepMenuOpen(false);
        setIsMenuOpen(v => !v);
    }, []);

    const handleStepMenuToggle = useCallback(() => {
        setIsMenuOpen(false);
        setIsStepMenuOpen(v => !v);
    }, []);

    const stepOptions = useMemo(
        () => Array.from({ length: totalSteps ?? 0 }, (_, i) => i + 1),
        [totalSteps],
    );

    const handleStepOptionPress = useCallback((step: number) => {
        setIsStepMenuOpen(false);
        if (step !== currentStep) {
            onStepSelect?.(step);
        }
    }, [currentStep, onStepSelect]);

    const mobileMenuActions = useMemo<ActionListSheetItem[]>(
        () => menuItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            accessibilityLabel: item.label,
            onPress: () => handleMenuItemPress(item),
        })),
        [handleMenuItemPress, menuItems],
    );

    const mobileStepActions = useMemo<ActionListSheetItem[]>(
        () => stepOptions.map((step) => ({
            key: `step-${step}`,
            icon: step === currentStep ? 'check-circle' : 'circle',
            label: `${i18nT('travel:components.travel.TravelWizardHeader.shag_6e830528')}${step}${i18nT('travel:components.travel.TravelWizardHeader.iz_28d07309')}${totalSteps} · ${getStepLabel(step)}`,
            accessibilityLabel: i18nT('travel:components.travel.TravelWizardHeader.pereyti_k_shagu_value1_value2_01355266', { value1: step, value2: getStepLabel(step) }),
            onPress: () => handleStepOptionPress(step),
        })),
        [currentStep, handleStepOptionPress, stepOptions, totalSteps],
    );

    const MoreMenuTrigger = menuItems.length > 0 ? (
        <Pressable
            onPress={handleMoreMenuToggle}
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
            accessibilityLabel={isMenuOpen ? i18nT('travel:components.travel.TravelWizardHeader.zakryt_menyu_deystviy_26697ec0') : i18nT('travel:components.travel.TravelWizardHeader.otkryt_menyu_deystviy_3e1e61d9')}
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
            accessibilityLabel={i18nT('travel:components.travel.TravelWizardHeader.nazad_e9f56561')}
            disabled={!onBack}
        >
            <Feather name="arrow-left" size={16} color={colors.text} />
            <Text style={styles.backButtonText}>{i18nT('travel:components.travel.TravelWizardHeader.nazad_e9f56561')}</Text>
        </Pressable>
    ) : null;

    // Компактная icon-only «Назад» для мобильной шапки (подпись — в accessibilityLabel).
    const BackButtonIcon = canGoBack ? (
        <Pressable
            onPress={onBack}
            style={({ pressed }) => [
                styles.iconButton,
                styles.iconButtonMobile,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.8 },
            ]}
            testID="travel-wizard-back"
            accessibilityRole="button"
            accessibilityLabel={i18nT('travel:components.travel.TravelWizardHeader.nazad_e9f56561')}
            disabled={!onBack}
        >
            <Feather name="arrow-left" size={18} color={colors.text} />
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
                {compactPrimaryLabel}
            </Text>
            <Feather name="arrow-right" size={16} color={colors.textOnPrimary} />
        </Pressable>
    ) : null;

    const SaveButton = onSave ? (
        isMobile ? (
            <Pressable
                onPress={isSaveInFlight ? undefined : onSave}
                disabled={isSaveInFlight}
                style={({ pressed }) => [
                    styles.iconButton,
                    styles.iconButtonMobile,
                    globalFocusStyles.focusable,
                    Platform.OS === 'web' && { cursor: isSaveInFlight ? 'default' : 'pointer' },
                    isSaveInFlight && styles.iconButtonActive,
                    pressed && !isSaveInFlight && { opacity: 0.8 },
                ]}
                testID="travel-wizard-save"
                accessibilityRole="button"
                accessibilityLabel={saveA11yLabel}
                accessibilityState={{ disabled: isSaveInFlight, busy: isSaveInFlight }}
            >
                {isSaveInFlight ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                    <Feather name="save" size={18} color={colors.textMuted} />
                )}
            </Pressable>
        ) : (
            <Pressable
                onPress={isSaveInFlight ? undefined : onSave}
                disabled={isSaveInFlight}
                style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionButtonSecondary,
                    globalFocusStyles.focusable,
                    Platform.OS === 'web' && { cursor: isSaveInFlight ? 'default' : 'pointer' },
                    isSaveInFlight && styles.actionButtonSaving,
                    pressed && !isSaveInFlight && { opacity: 0.9 },
                ]}
                testID="travel-wizard-save"
                accessibilityRole="button"
                accessibilityLabel={saveA11yLabel}
                accessibilityState={{ disabled: isSaveInFlight, busy: isSaveInFlight }}
            >
                {isSaveInFlight ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                    <Feather name="save" size={16} color={colors.text} />
                )}
                <Text style={styles.actionButtonText} numberOfLines={1}>{saveButtonLabel}</Text>
            </Pressable>
        )
    ) : null;

    const MoreMenuPanel = !isMobile && isMenuOpen && menuItems.length > 0 ? (
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

    const ProgressBar = (
        <View
            style={[styles.progressBarTrack, isMobile && styles.progressBarTrackMobile]}
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
    );

    const canSelectStep = Boolean(onStepSelect && currentStep && totalSteps && totalSteps > 1);
    const stepMetaLabel = i18nT('travel:components.travel.TravelWizardHeader.shag_value1_value2_value3_d2ef8652', { value1: currentStep ?? 1, value2: totalSteps ?? 1, value3: clamped });

    const StepMetaText = canSelectStep ? (
        <Pressable
            onPress={handleStepMenuToggle}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={({ pressed }) => [
                styles.stepSelectTrigger,
                isStepMenuOpen && styles.stepSelectTriggerActive,
                globalFocusStyles.focusable,
                Platform.OS === 'web' && { cursor: 'pointer' },
                pressed && { opacity: 0.8 },
            ]}
            testID="travel-wizard-step-select"
            accessibilityRole="button"
            accessibilityLabel={i18nT('travel:components.travel.TravelWizardHeader.vybrat_shag_seychas_value1_cda7d950', { value1: stepMetaLabel })}
            accessibilityState={{ expanded: isStepMenuOpen }}
        >
            <Text style={styles.stepSelectTriggerText} numberOfLines={1}>
                {stepMetaLabel}
            </Text>
            <Feather name={isStepMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
        </Pressable>
    ) : (
        <Text style={styles.progressMetaText} numberOfLines={1}>
            {stepMetaLabel}
        </Text>
    );

    const StepMenuPanel = !isMobile && isStepMenuOpen && canSelectStep ? (
        <View style={styles.stepSelectPanel} accessibilityRole="menu" testID="travel-wizard-step-select-menu">
            {stepOptions.map((step) => {
                const isActive = step === currentStep;
                return (
                    <Pressable
                        key={step}
                        onPress={() => handleStepOptionPress(step)}
                        style={({ pressed }) => [
                            styles.stepSelectItem,
                            isActive && styles.stepSelectItemActive,
                            globalFocusStyles.focusable,
                            Platform.OS === 'web' && { cursor: 'pointer' },
                            pressed && { backgroundColor: colors.surfaceMuted },
                        ]}
                        testID={`travel-wizard-step-select-option-${step}`}
                        accessibilityRole="menuitem"
                        accessibilityLabel={i18nT('travel:components.travel.TravelWizardHeader.pereyti_k_shagu_value1_value2_01355266', { value1: step, value2: getStepLabel(step) })}
                        accessibilityState={{ selected: isActive }}
                    >
                        <View style={[styles.stepSelectBadge, isActive && styles.stepSelectBadgeActive]}>
                            {isActive ? (
                                <Feather name="check" size={12} color={colors.primaryText} />
                            ) : (
                                <Text style={styles.stepSelectBadgeText}>{step}</Text>
                            )}
                        </View>
                        <View style={styles.stepSelectItemTextGroup}>
                            <Text style={[styles.stepSelectItemTitle, isActive && styles.stepSelectItemTitleActive]} numberOfLines={1}>
                                {i18nT('travel:components.travel.TravelWizardHeader.shag_6e830528')}{step} {i18nT('travel:components.travel.TravelWizardHeader.iz_28d07309')}{totalSteps}
                            </Text>
                            <Text style={styles.stepSelectItemSubtitle} numberOfLines={1}>
                                {getStepLabel(step)}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    ) : null;

    const ErrorBadge = hasErrors ? (
        <View style={styles.progressErrorBadge}>
            <Feather name="alert-circle" size={12} color={colors.danger} />
            <Text style={styles.progressErrorText} numberOfLines={1}>
                {i18nT('travel:components.travel.TravelWizardHeader.oshibki_2328a64c')}{errorCount}
            </Text>
        </View>
    ) : null;

    const AutosaveText = saveStatusBadge ? (
        <Text style={styles.autosaveBadgeText} numberOfLines={1} accessibilityLiveRegion="polite">
            {saveStatusBadge}
        </Text>
    ) : null;

    if (isMobile) {
        // Компактная мобильная шапка: 3 ряда вместо 5.
        // Ряд 1: [←] Заголовок · [сохранить] · [⋯]  Ряд 2: прогресс  Ряд 3: мета+статус · [Далее →]
        return (
            <>
                <View testID="travel-wizard-header" style={[styles.headerWrapper, styles.headerWrapperMobile]}>
                    <View style={styles.mobileTopRow}>
                        {BackButtonIcon}
                        <Text style={styles.headerTitleMobileInline} numberOfLines={1}>
                            {title}
                        </Text>
                        {SaveButton}
                        {MoreMenuTrigger}
                    </View>

                    {ProgressBar}

                    {/* #1038 — основное действие («Далее»/«Сохранить черновик») переехало
                        в липкий нижний футер (WizardStepFooter): в шапке оно занимало
                        целый ряд и выталкивало хром за проектный лимит «шапка ≤20%
                        вьюпорта», а на телефоне ещё и находилось вне зоны большого пальца. */}
                    <View style={styles.mobileMetaActionRow}>
                        <View style={styles.mobileMetaLeft}>
                            {StepMetaText}
                            {ErrorBadge}
                            {AutosaveText}
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
                <ActionListSheet
                    visible={isMenuOpen && mobileMenuActions.length > 0}
                    onClose={() => setIsMenuOpen(false)}
                    title={i18nT('travel:components.travel.TravelWizardHeader.otkryt_menyu_deystviy_3e1e61d9')}
                    actions={mobileMenuActions}
                    bottomOffset={0}
                />
                <ActionListSheet
                    visible={isStepMenuOpen && canSelectStep}
                    onClose={() => setIsStepMenuOpen(false)}
                    title={i18nT('travel:components.travel.TravelWizardHeader.vybrat_shag_seychas_value1_cda7d950', { value1: stepMetaLabel })}
                    actions={mobileStepActions}
                    bottomOffset={0}
                />
            </>
        );
    }

    return (
        <View testID="travel-wizard-header" style={styles.headerWrapper}>
            <View style={styles.titleRow}>
                <View style={styles.titleColumn}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                </View>

                <View style={styles.titleActionsRow}>
                    {SaveButton}
                    {MoreMenuTrigger}
                </View>
            </View>

            {MoreMenuPanel}

            <Text style={styles.headerSubtitle} numberOfLines={2}>
                {subtitle}
            </Text>

            {ProgressBar}

            <View style={[styles.progressMetaRow, styles.progressMetaRowInline]}>
                <View style={styles.progressStatusGroup}>
                    {StepMetaText}
                    {ErrorBadge}
                </View>
                {AutosaveText}
            </View>
            {StepMenuPanel}

            {totalSteps && currentStep && totalSteps > 1 ? (
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
                                    accessibilityLabel={i18nT('travel:components.travel.TravelWizardHeader.pereyti_k_shagu_value1_value2_01355266', { value1: step, value2: getStepLabel(step) })}
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
