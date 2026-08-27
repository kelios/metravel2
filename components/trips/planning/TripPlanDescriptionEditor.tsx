import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useSoftKeyboardInset } from '@/hooks/useSoftKeyboardInset';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { formatInteger } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';
import { normalizeHttpOrInternalUrl } from '@/utils/externalLinks';
import { webTextStyle } from '@/utils/webProps';
import { WIZARD_KEYBOARD_BEHAVIOR } from '@/components/travel/upsert/wizardKeyboard';

type TextSelection = { start: number; end: number };
type EditorTarget = 'inline' | 'fullscreen';
type SelectionOverride = { target: EditorTarget; selection: TextSelection };

interface TripPlanDescriptionEditorProps {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  placeholder: string;
  editable?: boolean;
}

const clampSelection = (selection: TextSelection, textLength: number): TextSelection => {
  const start = Math.min(Math.max(0, selection.start), textLength);
  const end = Math.min(Math.max(start, selection.end), textLength);
  return { start, end };
};

export default function TripPlanDescriptionEditor({
  value,
  onChangeText,
  label,
  placeholder,
  editable = true,
}: TripPlanDescriptionEditorProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isMobile } = useResponsive();
  const { contentViewportInset } = useSoftKeyboardInset();
  const { t } = useTranslation();
  const inlineInputRef = useRef<TextInput>(null);
  const fullscreenInputRef = useRef<TextInput>(null);
  const linkInputRef = useRef<TextInput>(null);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [linkDialogVisible, setLinkDialogVisible] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const selectionRef = useRef<TextSelection>({
    start: value.length,
    end: value.length,
  });
  const insertionSelectionRef = useRef<TextSelection>(selectionRef.current);
  const [selectionOverride, setSelectionOverride] = useState<SelectionOverride>();
  const selectionOverrideTargetRef = useRef<EditorTarget | null>(null);
  const wasFullscreenVisibleRef = useRef(false);

  const restoreSelection = useCallback((
    target: EditorTarget,
    nextSelection: TextSelection,
    textLength = value.length,
  ) => {
    const next = clampSelection(nextSelection, textLength);
    selectionRef.current = next;
    selectionOverrideTargetRef.current = target;
    setSelectionOverride({ target, selection: next });
  }, [value.length]);

  useEffect(() => {
    const next = clampSelection(selectionRef.current, value.length);
    selectionRef.current = next;
    setSelectionOverride((current) => (current
      ? { ...current, selection: clampSelection(current.selection, value.length) }
      : current));
  }, [value.length]);

  useEffect(() => {
    if (!fullscreenVisible) return undefined;
    const target = linkDialogVisible ? linkInputRef : fullscreenInputRef;
    const timer = setTimeout(() => target.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [fullscreenVisible, linkDialogVisible]);

  useEffect(() => {
    if (wasFullscreenVisibleRef.current && !fullscreenVisible) {
      const timer = setTimeout(() => inlineInputRef.current?.focus(), 0);
      wasFullscreenVisibleRef.current = fullscreenVisible;
      return () => clearTimeout(timer);
    }
    wasFullscreenVisibleRef.current = fullscreenVisible;
    return undefined;
  }, [fullscreenVisible]);

  const handleSelectionChange = useCallback((
    target: EditorTarget,
    nextSelection: TextSelection,
  ) => {
    if (
      selectionOverrideTargetRef.current
      && selectionOverrideTargetRef.current !== target
    ) {
      return;
    }
    selectionRef.current = clampSelection(nextSelection, value.length);
    // Selection is controlled only long enough to restore it after a mode/focus
    // transition. Keeping it controlled while the user types can move the
    // cursor back to the previous render before the native selection event.
    if (selectionOverrideTargetRef.current === target) {
      selectionOverrideTargetRef.current = null;
      setSelectionOverride(undefined);
    }
  }, [value.length]);

  const handleInlineSelectionChange = useCallback((
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    handleSelectionChange('inline', event.nativeEvent.selection);
  }, [handleSelectionChange]);

  const handleFullscreenSelectionChange = useCallback((
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    handleSelectionChange('fullscreen', event.nativeEvent.selection);
  }, [handleSelectionChange]);

  const handleChangeText = useCallback((nextValue: string) => {
    selectionOverrideTargetRef.current = null;
    setSelectionOverride(undefined);
    onChangeText(nextValue);
  }, [onChangeText]);

  const closeLinkDialog = useCallback(() => {
    setLinkDialogVisible(false);
    setLinkValue('');
    setLinkError(null);
    restoreSelection('fullscreen', insertionSelectionRef.current);
  }, [restoreSelection]);

  const closeFullscreen = useCallback(() => {
    setLinkDialogVisible(false);
    setLinkError(null);
    restoreSelection('inline', selectionRef.current);
    setFullscreenVisible(false);
  }, [restoreSelection]);

  const openFullscreen = useCallback(() => {
    restoreSelection('fullscreen', selectionRef.current);
    setFullscreenVisible(true);
  }, [restoreSelection]);

  const openLinkDialog = useCallback(() => {
    insertionSelectionRef.current = selectionRef.current;
    setLinkValue('');
    setLinkError(null);
    setLinkDialogVisible(true);
  }, []);

  const insertLink = useCallback(() => {
    const normalized = normalizeHttpOrInternalUrl(linkValue);
    if (!normalized) {
      setLinkError(t('trips:components.trips.planning.TripPlanDescriptionEditor.invalidUrl'));
      return;
    }

    const target = clampSelection(insertionSelectionRef.current, value.length);
    const nextValue = `${value.slice(0, target.start)}${normalized}${value.slice(target.end)}`;
    const nextCursor = target.start + normalized.length;
    onChangeText(nextValue);
    restoreSelection('fullscreen', { start: nextCursor, end: nextCursor }, nextValue.length);
    setLinkDialogVisible(false);
    setLinkValue('');
    setLinkError(null);
  }, [linkValue, onChangeText, restoreSelection, t, value]);

  const fullscreenLabel = t(
    'trips:components.trips.planning.TripPlanDescriptionEditor.openFullscreen',
  );

  return (
    <View style={styles.container} testID="trip-plan-description-editor">
      <View style={styles.inlineHeader}>
        <Text style={styles.label}>{label}</Text>
        <IconButton
          icon={<Feather name="maximize-2" size={18} color={colors.primaryDark} />}
          label={fullscreenLabel}
          onPress={openFullscreen}
          disabled={!editable}
          size="sm"
          showLabel={!isMobile}
          showTooltip
          testID="trip-plan-description-open-fullscreen"
        />
      </View>
      <TextInput
        ref={inlineInputRef}
        value={value}
        onChangeText={handleChangeText}
        onSelectionChange={handleInlineSelectionChange}
        selection={selectionOverride?.target === 'inline' ? selectionOverride.selection : undefined}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        editable={editable}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={styles.inlineInput}
        accessibilityLabel={label}
        testID="trip-plan-edit-description"
      />

      <Modal
        visible={fullscreenVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeFullscreen}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.keyboardFrame}
            behavior={WIZARD_KEYBOARD_BEHAVIOR}
            enabled={Platform.OS !== 'web'}
            testID="trip-plan-description-keyboard-frame"
          >
            <View
              style={[
                styles.fullscreenShell,
                contentViewportInset > 0 ? { paddingBottom: contentViewportInset } : null,
              ]}
              accessibilityViewIsModal
              testID="trip-plan-description-fullscreen"
            >
              <View style={styles.fullscreenHeader}>
                <Button
                  label={t('trips:app.tabs.trips.plan.id.zakryt_87bc8fb5')}
                  onPress={closeFullscreen}
                  variant="ghost"
                  size="sm"
                  testID="trip-plan-description-close"
                />
                <View style={styles.fullscreenTitleBlock}>
                  <Text style={styles.fullscreenTitle}>{label}</Text>
                  <Text style={styles.characterCount} testID="trip-plan-description-count">
                    {t('trips:components.trips.planning.TripPlanDescriptionEditor.characterCount', {
                      count: formatInteger(value.length),
                    })}
                  </Text>
                </View>
                <Button
                  label={t('trips:components.trips.planning.TripPlanDescriptionEditor.done')}
                  onPress={closeFullscreen}
                  variant="primary"
                  size="sm"
                  testID="trip-plan-description-done"
                />
              </View>

              <View style={styles.editorBody}>
                <TextInput
                  ref={fullscreenInputRef}
                  value={value}
                  onChangeText={handleChangeText}
                  onSelectionChange={handleFullscreenSelectionChange}
                  selection={selectionOverride?.target === 'fullscreen'
                    ? selectionOverride.selection
                    : undefined}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textMuted}
                  editable={editable}
                  multiline
                  textAlignVertical="top"
                  style={styles.fullscreenInput}
                  accessibilityLabel={label}
                  testID="trip-plan-description-fullscreen-input"
                />
              </View>

              <View style={styles.footer}>
                <Button
                  label={t('trips:components.trips.planning.TripPlanDescriptionEditor.addLink')}
                  onPress={openLinkDialog}
                  variant="secondary"
                  size="sm"
                  icon={<Feather name="link-2" size={16} color={colors.primaryDark} />}
                  disabled={!editable}
                  testID="trip-plan-description-add-link"
                />
                <Text style={styles.footerHint}>
                  {t('trips:components.trips.planning.TripPlanDescriptionEditor.saveHint')}
                </Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal
          visible={linkDialogVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeLinkDialog}
        >
          <KeyboardAvoidingView
            style={styles.dialogKeyboardFrame}
            behavior={WIZARD_KEYBOARD_BEHAVIOR}
            enabled={Platform.OS !== 'web'}
          >
            <Pressable
              style={styles.dialogBackdrop}
              onPress={closeLinkDialog}
              testID="trip-plan-description-link-backdrop"
            >
              <Pressable
                style={styles.dialogCard}
                onPress={() => undefined}
                accessibilityViewIsModal
                testID="trip-plan-description-link-dialog"
              >
                <Text style={styles.dialogTitle}>
                  {t('trips:components.trips.planning.TripPlanDescriptionEditor.addLink')}
                </Text>
                <TextInput
                  ref={linkInputRef}
                  value={linkValue}
                  onChangeText={(nextValue) => {
                    setLinkValue(nextValue);
                    setLinkError(null);
                  }}
                  placeholder={t(
                    'trips:components.trips.planning.TripPlanDescriptionEditor.linkPlaceholder',
                  )}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={insertLink}
                  style={styles.linkInput}
                  accessibilityLabel={t(
                    'trips:components.trips.planning.TripPlanDescriptionEditor.linkAddress',
                  )}
                  testID="trip-plan-description-link-input"
                />
                {linkError ? (
                  <Text
                    style={styles.dialogError}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    testID="trip-plan-description-link-error"
                  >
                    {linkError}
                  </Text>
                ) : null}
                <View style={styles.dialogActions}>
                  <Button
                    label={t('trips:app.tabs.trips.plan.id.otmena_66379efd')}
                    onPress={closeLinkDialog}
                    variant="ghost"
                    size="sm"
                    testID="trip-plan-description-link-cancel"
                  />
                  <Button
                    label={t('trips:components.trips.planning.TripPlanDescriptionEditor.insert')}
                    onPress={insertLink}
                    size="sm"
                    testID="trip-plan-description-link-insert"
                  />
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    width: '100%',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  inlineHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  label: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  inlineInput: {
    width: '100%',
    // Eight 20px lines + 2 * 8px vertical padding + 2px border.
    minHeight: 184,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 20,
    ...Platform.select({ web: webTextStyle({ outlineWidth: 0 }) }),
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardFrame: { flex: 1 },
  fullscreenShell: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  fullscreenHeader: {
    minHeight: 64,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.xs,
    backgroundColor: colors.surface,
  },
  fullscreenTitleBlock: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  fullscreenTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: 21,
    fontWeight: '700',
    color: colors.text,
  },
  characterCount: {
    marginTop: 2,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
  editorBody: {
    flex: 1,
    minHeight: 0,
    padding: DESIGN_TOKENS.spacing.sm,
  },
  fullscreenInput: {
    flex: 1,
    width: '100%',
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.lg,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: 24,
    ...Platform.select({ web: webTextStyle({ outlineWidth: 0 }) }),
  },
  footer: {
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.surface,
  },
  footerHint: {
    flex: 1,
    minWidth: 180,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 17,
    color: colors.textMuted,
  },
  dialogKeyboardFrame: { flex: 1 },
  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.overlay,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: DESIGN_TOKENS.spacing.lg,
    gap: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.surface,
    ...Platform.select({
      web: { boxShadow: DESIGN_TOKENS.shadows.modal },
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },
  dialogTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.text,
  },
  linkInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    ...Platform.select({ web: webTextStyle({ outlineWidth: 0 }) }),
  },
  dialogError: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.danger,
  },
  dialogActions: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
});
