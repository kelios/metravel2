import React, { useCallback, useMemo, useState, useEffect, useRef, Suspense, lazy } from 'react';
import { View, ScrollView, Text, TextInput, NativeSyntheticEvent, LayoutChangeEvent, Modal, TouchableOpacity, Platform, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TravelFormData } from '@/types/types';
import TextInputComponent from '@/components/forms/TextInputComponent';
import { validateTravelForm, getFieldError, type ValidationError } from '@/utils/formValidation';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import Button from '@/components/ui/Button';
import { appendPlainTextToHtml, plainTextToHtml } from '@/utils/htmlUtils';
import { useWebSpeechDictation } from '@/hooks/useWebSpeechDictation';
import { showToast } from '@/utils/toast';
import { createContentUpsertStyles } from './contentUpsertStyles';
import { getFormatLocale, translate as i18nT, translatePlural } from '@/i18n'


const ArticleEditor = lazy(() => import('@/components/article/ArticleEditor'));

interface ContentUpsertSectionProps {
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    onManualSave?: (dataOverride?: TravelFormData) => Promise<unknown> | void;
    firstErrorField?: string | null;
    autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    focusAnchorId?: string | null;
    onAnchorHandled?: () => void;
    visibleFields?: Array<'name' | 'description' | 'plus' | 'minus' | 'recommendation'>;
    showProgress?: boolean;
}

const ContentUpsertSection: React.FC<ContentUpsertSectionProps> = ({
                                                                       formData,
                                                                       setFormData,
                                                                       onManualSave,
                                                                       firstErrorField,
                                                                       autosaveStatus,
                                                                       focusAnchorId,
                                                                       onAnchorHandled,
                                                                       visibleFields,
                                                                       showProgress = true,
                                                                   }) => {
    const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема

    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
    const [fieldPositions, setFieldPositions] = useState<Record<string, number>>({});
    const scrollRef = useRef<ScrollView>(null);
    const [isDescriptionFullscreen, setIsDescriptionFullscreen] = useState(false);
    const [areDescriptionToolsVisible, setAreDescriptionToolsVisible] = useState(false);
    const [isImportingDescriptionText, setIsImportingDescriptionText] = useState(false);
    const [isPastingDescriptionText, setIsPastingDescriptionText] = useState(false);

    const dictation = useWebSpeechDictation({ lang: getFormatLocale(), continuous: true });
    const descriptionHtmlRef = useRef<string>(String(formData.description ?? ''));

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createContentUpsertStyles(colors), [colors]);

    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const { width: viewportWidth } = useWindowDimensions();
    const isCompactFullscreenHeader = viewportWidth < 390;

    // Производное значение — считаем через useMemo, без лишнего state + effect.
    const validationErrors = useMemo<ValidationError[]>(
        () =>
            validateTravelForm({
                name: formData.name,
                description: formData.description,
                countries: formData.countries,
                categories: formData.categories,
                year: formData.year,
                number_days: formData.number_days,
                number_peoples: formData.number_peoples,
                youtube_link: formData.youtube_link,
            } as any).errors,
        [
            formData.name,
            formData.description,
            formData.countries,
            formData.categories,
            formData.year,
            formData.number_days,
            formData.number_peoples,
            formData.youtube_link,
        ],
    );

    const descriptionPlainText = useMemo(() => {
        const raw = formData.description ?? '';
        return String(raw)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }, [formData.description]);

    const descriptionPlainLength = descriptionPlainText.length;
    // «Богатое» описание — содержит форматирование, картинки или iframe. Инлайн-поле на
    // мобиле показывает только плоский текст; если пользователь начнёт в нём печатать,
    // plainTextToHtml перезапишет весь HTML и уничтожит форматирование/фото. Поэтому
    // при богатом описании инлайн-поле переводим в режим просмотра, а правку отдаём
    // только расширенному редактору (он сохраняет HTML целиком).
    const isRichDescription = useMemo(() => {
        const raw = String(formData.description ?? '');
        return /<(img|iframe|video|source|figure|table|blockquote|strong|b|em|i|u|s|ul|ol|li|a|h[1-6])[\s/>]/i.test(raw);
    }, [formData.description]);
    const [mobileDescriptionDraft, setMobileDescriptionDraft] = useState(descriptionPlainText);
    const isMobileDescriptionFocusedRef = useRef(false);

    useEffect(() => {
        if (!isMobileDescriptionFocusedRef.current) {
            setMobileDescriptionDraft(descriptionPlainText);
        }
    }, [descriptionPlainText]);

    const descriptionStatusText = useMemo(() => {
        if (descriptionPlainLength === 0) {
            return i18nT('travel:components.travel.ContentUpsertSection.opishite_dlya_kogo_etot_marshrut_chto_v_nem__76c60d07');
        }
        if (descriptionPlainLength < 50) {
            const remaining = 50 - descriptionPlainLength;
            return i18nT('travel:components.travel.ContentUpsertSection.ostalos_value1_value2_do_minimuma_07d2d15c', { value1: remaining, value2: translatePlural('travel:common.characterNoun', remaining) });
        }
        if (descriptionPlainLength <= 150) {
            return i18nT('travel:components.travel.ContentUpsertSection.horoshee_kratkoe_opisanie_mozhno_dobavit_chu_a7c25864');
        }
        return i18nT('travel:components.travel.ContentUpsertSection.otlichnoe_podrobnoe_opisanie_ce837ac8');
    }, [descriptionPlainLength]);

    const descriptionAnchorHint = i18nT('travel:components.travel.ContentUpsertSection.yakor_postavte_kursor_v_meste_kuda_nuzhno_pr_38e2354f');

    const descriptionProgress = useMemo(() => {
        const progress = Math.min((descriptionPlainLength / 50) * 100, 100);
        return progress;
    }, [descriptionPlainLength]);

    const descriptionProgressColor = useMemo(() => {
        if (descriptionPlainLength < 50) return colors.dangerLight;
        if (descriptionPlainLength <= 150) return colors.warning;
        return colors.successDark;
    }, [colors, descriptionPlainLength]);

    const handleChange = useCallback(
        <T extends keyof TravelFormData>(name: T, value: TravelFormData[T]) => {
            setFormData(prev => ({ ...prev, [name]: value }));
            // Отмечаем поле как "тронутое" для показа ошибок
            setTouchedFields(prev => new Set(prev).add(name as string));
        },
        [setFormData]
    );

    useEffect(() => {
        descriptionHtmlRef.current = String(formData.description ?? '');
    }, [formData.description]);

    useEffect(() => {
        dictation.bindFinalTextHandler((text) => {
            const next = appendPlainTextToHtml(descriptionHtmlRef.current, text);
            descriptionHtmlRef.current = next;
            handleChange('description', next as any);
        });
    }, [dictation, handleChange]);

    const appendToDescription = useCallback(
        (plainText: string) => {
            const base = descriptionHtmlRef.current;
            const next = appendPlainTextToHtml(base, plainText);
            descriptionHtmlRef.current = next;
            handleChange('description', next as any);
        },
        [handleChange]
    );

    const readUriAsText = useCallback(async (uri: string): Promise<string> => {
        const safeUri = String(uri ?? '');
        if (!safeUri) return '';

        // Web: blob/data/http urls can be read via fetch()
        if (Platform.OS === 'web' && /^(blob:|data:|https?:)/i.test(safeUri)) {
            const res = await fetch(safeUri);
            return await res.text();
        }

        // Native: file:// (and in some cases content://) via expo-file-system
        return await FileSystem.readAsStringAsync(safeUri, { encoding: FileSystem.EncodingType.UTF8 });
    }, []);

    const importDescriptionText = useCallback(async () => {
        setIsImportingDescriptionText(true);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];

            const size = typeof asset.size === 'number' ? asset.size : null;
            if (size != null && size > 1024 * 1024) {
                await showToast({
                    type: 'error',
                    text1: i18nT('travel:components.travel.ContentUpsertSection.slishkom_bolshoy_fayl_1ebf9152'),
                    text2: i18nT('travel:components.travel.ContentUpsertSection.pozhaluysta_vyberite_tekst_do_1_mb_naprimer__8509c3f4'),
                });
                return;
            }

            const text = await readUriAsText(String(asset.uri ?? ''));
            const cleaned = String(text ?? '').trim();
            if (!cleaned) {
                await showToast({
                    type: 'error',
                    text1: i18nT('travel:components.travel.ContentUpsertSection.pustoy_tekst_976bbb80'),
                    text2: i18nT('travel:components.travel.ContentUpsertSection.fayl_ne_soderzhit_teksta_ili_ne_udalos_proch_098f5f71'),
                });
                return;
            }

            appendToDescription(cleaned);
            await showToast({
                type: 'success',
                text1: i18nT('travel:components.travel.ContentUpsertSection.tekst_dobavlen_1e512740'),
                text2: asset.name ? i18nT('travel:components.travel.ContentUpsertSection.fayl_value1_d4e3846e', { value1: asset.name }) : undefined,
            });
        } catch (err: any) {
            await showToast({
                type: 'error',
                text1: i18nT('travel:components.travel.ContentUpsertSection.ne_udalos_importirovat_02dba43d'),
                text2: err?.message ? String(err.message) : i18nT('travel:components.travel.ContentUpsertSection.poprobuyte_drugoy_fayl_naprimer_txt_558af228'),
            });
        } finally {
            setIsImportingDescriptionText(false);
        }
    }, [appendToDescription, readUriAsText]);

    const pasteDescriptionText = useCallback(async () => {
        setIsPastingDescriptionText(true);
        try {
            const text = await Clipboard.getStringAsync();
            const cleaned = String(text ?? '').trim();
            if (!cleaned) {
                await showToast({
                    type: 'error',
                    text1: i18nT('travel:components.travel.ContentUpsertSection.bufer_pust_a2a2ce35'),
                    text2: i18nT('travel:components.travel.ContentUpsertSection.skopiruyte_tekst_i_poprobuyte_snova_cc524644'),
                });
                return;
            }
            appendToDescription(cleaned);
            await showToast({ type: 'success', text1: i18nT('travel:components.travel.ContentUpsertSection.tekst_dobavlen_1e512740'), text2: i18nT('travel:components.travel.ContentUpsertSection.iz_bufera_obmena_acc66fc3') });
        } catch (err: any) {
            await showToast({
                type: 'error',
                text1: i18nT('travel:components.travel.ContentUpsertSection.ne_udalos_vstavit_f7a02dca'),
                text2: err?.message ? String(err.message) : i18nT('travel:components.travel.ContentUpsertSection.poprobuyte_snova_efd38252'),
            });
        } finally {
            setIsPastingDescriptionText(false);
        }
    }, [appendToDescription]);

    // Получить ошибку для поля (показываем только если поле было "тронуто")
    const getError = useCallback((field: string) => {
        if (!touchedFields.has(field)) return null;
        return getFieldError(field, validationErrors);
    }, [touchedFields, validationErrors]);

    const formProgress = useMemo(() => {
        const requiredFields = ['name', 'description', 'countries', 'categories'];
        const filledFields = requiredFields.filter(field => {
            const value = (formData as any)[field];
            if (Array.isArray(value)) return value.length > 0;
            return value && String(value).trim().length > 0;
        });
        return Math.round((filledFields.length / requiredFields.length) * 100);
    }, [formData]);

    const idTravelStr = useMemo(
        () => (formData?.id != null ? String(formData.id) : undefined),
        [formData?.id]
    );

    const renderEditorSection = useCallback(
        (
            title: string, 
            content: string | undefined | null, 
            onChange: (val: string) => void,
            error: string | null = null,
            required: boolean = false,
            hint?: string,
            fieldKey?: string,
        ) => {
            const key = fieldKey;
            const handleLayout = (event: NativeSyntheticEvent<LayoutChangeEvent['nativeEvent']>) => {
                if (!key) return;
                const y = event.nativeEvent.layout.y;
                setFieldPositions(prev => ({ ...prev, [key]: y }));
            };

            const isDescription = key === 'description';

            return (
                <View style={styles.sectionEditor} onLayout={handleLayout}>
                    <View style={styles.editorHeader}>
                        <Text style={styles.editorLabel}>
                            {title}
                            {required && <Text style={styles.required}> *</Text>}
                        </Text>
                        {!!hint && (
                            <Text style={styles.editorHint}>{hint}</Text>
                        )}
                        {isDescription && (
                            <>
                                <View style={styles.descriptionProgressContainer}>
                                    <View style={styles.descriptionProgressTrack}>
                                        <View
                                            style={[
                                                styles.descriptionProgressFill,
                                                {
                                                    width: `${descriptionProgress}%`,
                                                    backgroundColor: descriptionProgressColor,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                                <View style={styles.descriptionStatusRow}>
                                    <Text
                                        style={[
                                            styles.descriptionStatusText,
                                            descriptionPlainLength < 50 && styles.descriptionStatusTextWarning,
                                            descriptionPlainLength >= 50 && styles.descriptionStatusTextSuccess,
                                        ]}
                                    >
                                        {descriptionStatusText}
                                    </Text>
                                    <Text style={styles.descriptionCounterText}>{descriptionPlainLength} {i18nT('travel:components.travel.ContentUpsertSection.simvolov_d0f4cacb')}</Text>
                                </View>

                                {isMobile ? (
                                    <TouchableOpacity
                                        style={styles.descriptionToolsToggle}
                                        onPress={() => setAreDescriptionToolsVisible(value => !value)}
                                        accessibilityRole="button"
                                        accessibilityState={{ expanded: areDescriptionToolsVisible }}
                                        accessibilityLabel={areDescriptionToolsVisible ? i18nT('travel:components.travel.ContentUpsertSection.skryt_instrumenty_opisaniya_511ee840') : i18nT('travel:components.travel.ContentUpsertSection.pokazat_instrumenty_opisaniya_1671a933')}
                                    >
                                        <Text style={styles.descriptionToolsToggleText}>
                                            {areDescriptionToolsVisible ? i18nT('travel:components.travel.ContentUpsertSection.skryt_instrumenty_29c91146') : i18nT('travel:components.travel.ContentUpsertSection.instrumenty_diktovka_import_vstavka_9ac3d594')}
                                        </Text>
                                        <Feather
                                            name={areDescriptionToolsVisible ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.primaryText}
                                        />
                                    </TouchableOpacity>
                                ) : null}

                                {(!isMobile || areDescriptionToolsVisible) && (
                                <View style={styles.descriptionActionsRow}>
                                    {Platform.OS === 'web' && dictation.isSupported ? (
                                        <Button
                                            size="sm"
                                            variant={dictation.isListening ? 'danger' : 'outline'}
                                            label={dictation.isListening ? i18nT('travel:components.travel.ContentUpsertSection.stop_b7ef349a') : i18nT('travel:components.travel.ContentUpsertSection.nadiktovat_9eaa89e4')}
                                            icon={<Feather name={dictation.isListening ? 'square' : 'mic'} size={16} color={dictation.isListening ? colors.textOnPrimary : colors.text} />}
                                            onPress={() => (dictation.isListening ? dictation.stop() : dictation.start())}
                                            style={styles.descriptionActionButton}
                                        />
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            label={i18nT('travel:components.travel.ContentUpsertSection.diktovka_fc4af390')}
                                            icon={<Feather name="mic" size={16} color={colors.text} />}
                                            disabled
                                            style={styles.descriptionActionButton}
                                        />
                                    )}

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        label={isImportingDescriptionText ? i18nT('travel:components.travel.ContentUpsertSection.import_e9e80ad6') : i18nT('travel:components.travel.ContentUpsertSection.import_teksta_f9185f51')}
                                        icon={<Feather name="upload" size={16} color={colors.text} />}
                                        loading={isImportingDescriptionText}
                                        disabled={isImportingDescriptionText}
                                        onPress={importDescriptionText}
                                        style={styles.descriptionActionButton}
                                    />

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        label={isPastingDescriptionText ? i18nT('travel:components.travel.ContentUpsertSection.vstavka_d9165414') : i18nT('travel:components.travel.ContentUpsertSection.vstavit_d3c07b2b')}
                                        icon={<Feather name="clipboard" size={16} color={colors.text} />}
                                        loading={isPastingDescriptionText}
                                        disabled={isPastingDescriptionText}
                                        onPress={pasteDescriptionText}
                                        style={styles.descriptionActionButton}
                                    />
                                </View>
                                )}

                                {(!isMobile || areDescriptionToolsVisible) && Platform.OS === 'web' && dictation.isSupported && dictation.isListening && dictation.interimText ? (
                                    <Text style={styles.dictationInterimText}>
                                        {dictation.interimText}
                                    </Text>
                                ) : null}

                                {(!isMobile || areDescriptionToolsVisible) && Platform.OS !== 'web' ? (
                                    <Text style={styles.dictationHint}>
                                        {i18nT('travel:components.travel.ContentUpsertSection.podskazka_na_telefone_mozhno_ispolzovat_mikr_27251d78')}</Text>
                                ) : null}

                                {!isMobile ? (
                                    <Text style={styles.descriptionAnchorHint}>{descriptionAnchorHint}</Text>
                                ) : null}
                                {!!error && (
                                    <View style={styles.errorContainer}>
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                    {isDescription && isMobile ? (
                        <>
                            {isRichDescription ? (
                                <TouchableOpacity
                                    style={styles.descriptionMobileInput}
                                    activeOpacity={0.8}
                                    onPress={() => setIsDescriptionFullscreen(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel={i18nT('travel:components.travel.ContentUpsertSection.otkryt_rasshirennyy_redaktor_opisaniya_c0770e8e')}
                                    testID="travel-wizard.basic.description.mobile-rich-preview"
                                >
                                    <Text
                                        style={{ color: descriptionPlainLength ? colors.text : colors.textMuted, fontSize: 15, lineHeight: 22 }}
                                        numberOfLines={6}
                                    >
                                        {descriptionPlainText || (hint ?? i18nT('travel:components.travel.ContentUpsertSection.defaultDescriptionHint'))}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                                        <Feather name="lock" size={13} color={colors.textMuted} />
                                        <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>
                                            {i18nT('travel:components.travel.ContentUpsertSection.formattedDescriptionHint')}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ) : (
                            <TextInput
                                style={styles.descriptionMobileInput}
                                multiline
                                textAlignVertical="top"
                                value={mobileDescriptionDraft}
                                onFocus={() => {
                                    isMobileDescriptionFocusedRef.current = true;
                                }}
                                onBlur={() => {
                                    isMobileDescriptionFocusedRef.current = false;
                                    setMobileDescriptionDraft(descriptionPlainText);
                                }}
                                onChangeText={(text) => {
                                    // Keep the native input controlled by the exact draft while it is focused.
                                    // The HTML serializer trims a trailing space, so deriving value directly from
                                    // formData made Android remove that space before the next word was entered.
                                    setMobileDescriptionDraft(text);
                                    const next = plainTextToHtml(text);
                                    descriptionHtmlRef.current = next;
                                    onChange(next);
                                }}
                                placeholder={hint ?? i18nT('travel:components.travel.ContentUpsertSection.defaultDescriptionHint')}
                                placeholderTextColor={colors.textMuted}
                                accessibilityLabel={i18nT('travel:components.travel.ContentUpsertSection.opisanie_puteshestviya_75a5cc4c')}
                                testID="travel-wizard.basic.description.mobile-input"
                            />
                            )}
                            <TouchableOpacity
                                style={styles.descriptionAdvancedButton}
                                onPress={() => setIsDescriptionFullscreen(true)}
                                accessibilityRole="button"
                                accessibilityLabel={i18nT('travel:components.travel.ContentUpsertSection.otkryt_rasshirennyy_redaktor_opisaniya_c0770e8e')}
                            >
                                <Feather name="edit-3" size={16} color={colors.primaryText} />
                                <Text style={styles.descriptionAdvancedButtonText}>{i18nT('travel:components.travel.ContentUpsertSection.rasshirennyy_redaktor_37259fe6')}</Text>
                            </TouchableOpacity>

                            <Modal
                                visible={isDescriptionFullscreen}
                                animationType="slide"
                                presentationStyle="fullScreen"
                                onRequestClose={() => setIsDescriptionFullscreen(false)}
                            >
                                <SafeAreaView style={styles.modalSafeArea}>
                                    <KeyboardAvoidingView
                                        style={styles.modalKeyboardAvoiding}
                                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                        enabled={Platform.OS !== 'web'}
                                    >
                                    <View style={styles.modalShell}>
                                        <View style={styles.modalHeader}>
                                            <View style={styles.modalHeaderSide}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        if (isDescription) {
                                                            handleChange('description', descriptionHtmlRef.current as any);
                                                        }
                                                        setIsDescriptionFullscreen(false);
                                                    }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    style={[
                                                        styles.modalActionButton,
                                                        isCompactFullscreenHeader && styles.modalActionButtonCompact,
                                                    ]}
                                                    accessibilityLabel={i18nT('travel:components.travel.ContentUpsertSection.zakryt_polnoekrannyy_redaktor_89b88fa5')}
                                                >
                                                    <View style={styles.modalActionContent}>
                                                        <Feather name="x" size={14} color={colors.primaryText} />
                                                        {!isCompactFullscreenHeader && (
                                                            <Text style={styles.modalHeaderAction}>{i18nT('travel:components.travel.ContentUpsertSection.zakryt_f8478810')}</Text>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={styles.modalHeaderCenter}>
                                                <Text style={styles.modalHeaderTitle}>{i18nT('travel:components.travel.ContentUpsertSection.opisanie_cdbe94cb')}</Text>
                                                <Text style={styles.modalHeaderSubtitle}>{descriptionPlainLength} {i18nT('travel:components.travel.ContentUpsertSection.simvolov_d0f4cacb')}</Text>
                                            </View>
                                            <View style={[styles.modalHeaderSide, styles.modalHeaderSideRight]}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        if (isDescription) {
                                                            handleChange('description', descriptionHtmlRef.current as any);
                                                        }
                                                        setIsDescriptionFullscreen(false);
                                                    }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    style={[
                                                        styles.modalActionButton,
                                                        styles.modalActionButtonPrimary,
                                                        isCompactFullscreenHeader && styles.modalActionButtonCompact,
                                                    ]}
                                                    accessibilityLabel={i18nT('travel:components.travel.ContentUpsertSection.sohranit_i_zakryt_polnoekrannyy_redaktor_77ff80c5')}
                                                >
                                                    <View style={styles.modalActionContent}>
                                                        <Feather name="check" size={14} color={colors.textOnPrimary} />
                                                        {!isCompactFullscreenHeader && (
                                                            <Text style={[styles.modalHeaderAction, styles.modalHeaderActionPrimary]}>{i18nT('travel:components.travel.ContentUpsertSection.gotovo_7fe97ed6')}</Text>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <View style={styles.modalBody}>
                                            <View style={styles.modalEditorCard}>
                                                <Suspense fallback={<View style={{ padding: 20 }}><Text>{i18nT('travel:components.travel.ContentUpsertSection.zagruzka_redaktora_d5683e4b')}</Text></View>}>
                                                    <ArticleEditor
                                                        key={`description-fullscreen-${idTravelStr ?? 'new'}`}
                                                        label={title}
                                                        content={content ?? ''}
                                                        onChange={(value) => {
                                                            if (isDescription) {
                                                                descriptionHtmlRef.current = value;
                                                            }
                                                            onChange(value);
                                                        }}
                                                        onManualSave={isDescription && onManualSave
                                                            ? async (html) => {
                                                                const nextDescription = typeof html === 'string'
                                                                    ? html
                                                                    : String(descriptionHtmlRef.current ?? formData.description ?? '');
                                                                descriptionHtmlRef.current = nextDescription;
                                                                return await onManualSave({
                                                                    description: nextDescription,
                                                                } as TravelFormData);
                                                            }
                                                            : undefined}
                                                        placeholder={hint}
                                                        idTravel={idTravelStr}
                                                        variant="compact"
                                                        chrome="mobile"
                                                    />
                                                </Suspense>
                                            </View>
                                        </View>
                                    </View>
                                    </KeyboardAvoidingView>
                                </SafeAreaView>
                            </Modal>
                        </>
                    ) : (
                        <ArticleEditor
                            key={`${title}-${idTravelStr ?? 'new'}`}
                            label={title}
                            content={content ?? ''}
                            onChange={(value) => {
                                if (isDescription) {
                                    descriptionHtmlRef.current = value;
                                }
                                onChange(value);
                            }}
                            onManualSave={isDescription && onManualSave
                                ? async (html) => {
                                    const nextDescription = typeof html === 'string'
                                        ? html
                                        : String(descriptionHtmlRef.current ?? formData.description ?? '');
                                    descriptionHtmlRef.current = nextDescription;
                                    return await onManualSave({
                                        description: nextDescription,
                                    } as TravelFormData);
                                }
                                : undefined}
                            idTravel={idTravelStr}
                            variant={isDescription ? 'default' : 'compact'}
                            chrome={isMobile ? 'mobile' : 'default'}
                        />
                    )}
                    {isDescription && autosaveStatus && (
                        <View style={styles.autosaveRow}>
                            {autosaveStatus === 'saving' && (
                                <Text style={styles.autosaveText}>{i18nT('travel:components.travel.ContentUpsertSection.avtosohranenie_d4efcd67')}</Text>
                            )}
                            {autosaveStatus === 'saved' && (
                                <Text style={styles.autosaveSuccess}>{i18nT('travel:components.travel.ContentUpsertSection.izmeneniya_sohraneny_7b2917ac')}</Text>
                            )}
                            {autosaveStatus === 'error' && (
                                <Text style={styles.autosaveError}>
                                    {i18nT('travel:components.travel.ContentUpsertSection.ne_udalos_sohranit_izmeneniya_poprobuyte_esc_90d2401c')}</Text>
                            )}
                        </View>
                    )}
                    {!isDescription && !!error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}
                </View>
            );
        },
        [
            autosaveStatus,
            colors.primaryText,
            colors.text,
            colors.textOnPrimary,
            colors.textMuted,
            descriptionAnchorHint,
            descriptionPlainLength,
            descriptionPlainText,
            descriptionProgress,
            descriptionProgressColor,
            descriptionStatusText,
            dictation,
            handleChange,
            idTravelStr,
            importDescriptionText,
            isDescriptionFullscreen,
            isImportingDescriptionText,
            isMobile,
            isRichDescription,
            mobileDescriptionDraft,
            isPastingDescriptionText,
            isCompactFullscreenHeader,
            pasteDescriptionText,
            areDescriptionToolsVisible,
            formData,
            onManualSave,
            styles,
        ]
    );

    useEffect(() => {
        if (!firstErrorField) return;
        const y = fieldPositions[firstErrorField];
        if (y == null || !scrollRef.current) return;
        scrollRef.current.scrollTo({ y: Math.max(y - 40, 0), animated: true });
    }, [firstErrorField, fieldPositions]);

    useEffect(() => {
        if (!focusAnchorId) return;

        const key = (() => {
            if (focusAnchorId === 'travelwizard-basic-name') return 'name';
            if (focusAnchorId === 'travelwizard-basic-description') return 'description';
            return null;
        })();

        if (!key) return;

        if (Platform.OS === 'web') {
            onAnchorHandled?.();
            return;
        }

        const y = fieldPositions[key];
        if (y == null || !scrollRef.current) {
            onAnchorHandled?.();
            return;
        }

        scrollRef.current.scrollTo({ y: Math.max(y - 40, 0), animated: true });
        onAnchorHandled?.();
    }, [fieldPositions, focusAnchorId, onAnchorHandled]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!isDescriptionFullscreen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const key = String(event.key ?? '').toLowerCase();

            if (key === 'escape') {
                event.preventDefault();
                setIsDescriptionFullscreen(false);
                return;
            }

            if ((event.metaKey || event.ctrlKey) && key === 'enter') {
                event.preventDefault();
                setIsDescriptionFullscreen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isDescriptionFullscreen]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!isDescriptionFullscreen) return;
        if (typeof document === 'undefined') return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isDescriptionFullscreen]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ref={scrollRef}
            >
                {/* ✅ УЛУЧШЕНИЕ: Прогресс заполнения формы */}
                {showProgress && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressLabel}>{i18nT('travel:components.travel.ContentUpsertSection.progress_zapolneniya_0a93518d')}</Text>
                            <Text style={styles.progressPercent}>{formProgress}%</Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${formProgress}%` }]} />
                        </View>
                    </View>
                )}

                {(visibleFields == null || visibleFields.includes('name')) && (
                    <View
                        style={styles.section}
                        nativeID="travelwizard-basic-name"
                        onLayout={event => {
                            const y = event.nativeEvent.layout.y;
                            setFieldPositions(prev => ({ ...prev, name: y }));
                        }}
                    >
                        <TextInputComponent
                            label={i18nT('travel:components.travel.ContentUpsertSection.nazvanie_d756dec3')}
                            value={formData.name ?? ''}
                            onChange={value => handleChange('name', value)}
                            error={getError('name')}
                            required={true}
                            hint={i18nT('travel:components.travel.ContentUpsertSection.kratkoe_i_ponyatnoe_nazvanie_ne_menee_3_simv_7fc748ba')}
                        />
                    </View>
                )}

                {(visibleFields == null || visibleFields.includes('description')) &&
                    <View
                        nativeID="travelwizard-basic-description"
                        onLayout={event => {
                            const y = event.nativeEvent.layout.y;
                            setFieldPositions(prev => ({ ...prev, description: y }));
                        }}
                    >
                        {renderEditorSection(
                            i18nT('travel:components.travel.ContentUpsertSection.opisanie_cdbe94cb'),
                            formData.description,
                            val => handleChange('description', val),
                            getError('description'),
                            true,
                            undefined,
                            'description'
                        )}
                    </View>}

                {(visibleFields == null || visibleFields.includes('plus')) &&
                    renderEditorSection(i18nT('travel:components.travel.ContentUpsertSection.plyusy_7e8ecd01'), formData.plus, val => handleChange('plus', val), null, false, i18nT('travel:components.travel.ContentUpsertSection.chto_vam_ponravilos_v_etom_puteshestvii_b2e95dd2'))}

                {(visibleFields == null || visibleFields.includes('minus')) &&
                    renderEditorSection(i18nT('travel:components.travel.ContentUpsertSection.minusy_9b37a35a'), formData.minus, val => handleChange('minus', val), null, false, i18nT('travel:components.travel.ContentUpsertSection.chto_mozhno_uluchshit_46f05590'))}

                {(visibleFields == null || visibleFields.includes('recommendation')) &&
                    renderEditorSection(i18nT('travel:components.travel.ContentUpsertSection.rekomendatsii_566f7fca'), formData.recommendation, val => handleChange('recommendation', val), null, false, i18nT('travel:components.travel.ContentUpsertSection.vashi_sovety_dlya_drugih_puteshestvennikov_49e41714'))}
            </ScrollView>
        </SafeAreaView>
    );
};


export default React.memo(ContentUpsertSection);
