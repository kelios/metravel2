import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { TravelComment } from '../../types/comments';
import { translate as i18nT } from '@/i18n'


interface CommentFormProps {
  onSubmit: (text: string) => void | Promise<unknown>;
  isSubmitting?: boolean;
  placeholder?: string;
  replyTo?: TravelComment | null;
  onCancelReply?: () => void;
  editComment?: TravelComment | null;
  onCancelEdit?: () => void;
  autoFocus?: boolean;
}

export function CommentForm({
  onSubmit,
  isSubmitting = false,
  placeholder = i18nT('travel:components.travel.CommentForm.napisat_kommentariy_a7fcfc3e'),
  replyTo,
  onCancelReply,
  editComment,
  onCancelEdit,
  autoFocus = false,
}: CommentFormProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState('');
  const [localSubmitPending, setLocalSubmitPending] = useState(false);
  const submitInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const submitting = isSubmitting || localSubmitPending;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (editComment) {
      setText(editComment.text);
      return;
    }

    // When switching to reply mode (or back to normal), start from a clean input.
    setText('');
    // Намеренно зависим от стабильных id, а не от identity объектов editComment/replyTo:
    // новая ссылка после рефетча списка не должна затирать черновик пользователя.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editComment?.id, replyTo?.id]);

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || submitting || submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    const result = onSubmit(trimmedText);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setLocalSubmitPending(true);
      try {
        await result;
        if (mountedRef.current) {
          setText('');
        }
      } catch {
        // Keep the draft text in place so the user can retry.
      } finally {
        if (mountedRef.current) {
          setLocalSubmitPending(false);
        }
        submitInFlightRef.current = false;
      }
    } else {
      setText('');
      submitInFlightRef.current = false;
    }
  };

  const handleCancel = () => {
    setText('');
    if (replyTo && onCancelReply) {
      onCancelReply();
    }
    if (editComment && onCancelEdit) {
      onCancelEdit();
    }
  };

  const showCancel = replyTo || editComment;

  return (
    <View style={styles.container}>
      {replyTo && (
        <View style={styles.replyBanner}>
          <Feather name="corner-down-right" size={14} color={colors.info} />
          <Text style={styles.replyText}>
            {i18nT('travel:components.travel.CommentForm.otvet_na_kommentariy_a0809c56')}{replyTo.user_name || `пользователя #${replyTo.user}`}
          </Text>
        </View>
      )}
      {editComment && (
        <View style={styles.editBanner}>
          <Feather name="edit-2" size={14} color={colors.warning} />
          <Text style={styles.editText}>{i18nT('travel:components.travel.CommentForm.redaktirovanie_kommentariya_dd78c1d0')}</Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={2000}
          autoFocus={autoFocus}
          editable={!submitting}
          accessibilityLabel={i18nT('travel:components.travel.CommentForm.pole_vvoda_kommentariya_28d820cb')}
        />
        <View style={styles.actions}>
          {showCancel && (
            <Pressable
              onPress={handleCancel}
              style={styles.cancelButton}
              accessibilityLabel={i18nT('travel:components.travel.CommentForm.otmenit_74db5ada')}
              accessibilityRole="button"
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={!text.trim() || submitting}
            style={[styles.sendButton, (!text.trim() || submitting) && styles.sendButtonDisabled]}
            accessibilityLabel={editComment ? i18nT('travel:components.travel.CommentForm.sohranit_izmeneniya_babe9090') : i18nT('travel:components.travel.CommentForm.otpravit_kommentariy_6c9d6765')}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Feather name="send" size={18} color={colors.textOnPrimary} />
            )}
          </Pressable>
        </View>
      </View>
      {text.length > 1800 && (
        <Text style={styles.charCount}>
          {text.length} / 2000
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create<Record<string, any>>({
  container: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.infoSoft,
    padding: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  replyText: {
    fontSize: 12,
    color: colors.info,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningSoft,
    padding: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    borderWidth: 1,
    borderColor: colors.warningAlpha40,
  },
  editText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        outlineWidth: 0,
        outlineStyle: 'none',
        outlineColor: 'transparent',
        ':focus': {
          borderColor: colors.primary,
          boxShadow: `0 0 0 2px ${colors.primaryAlpha30 ?? 'rgba(0,0,0,0.08)'}`,
        },
      } as any,
    }),
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
    }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  sendButtonDisabled: {
    backgroundColor: colors.disabled,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      } as any,
    }),
  },
  charCount: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: DESIGN_TOKENS.spacing.xxs,
  },
});
