import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { TravelComment } from '../../types/comments';

interface CommentFormProps {
  onSubmit: (text: string) => void;
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
  placeholder = 'Написать комментарий...',
  replyTo,
  onCancelReply,
  editComment,
  onCancelEdit,
  autoFocus = false,
}: CommentFormProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (editComment) {
      setText(editComment.text);
      return;
    }

    // When switching to reply mode (or back to normal), start from a clean input.
    setText('');
  }, [editComment, replyTo]);

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (trimmedText) {
      onSubmit(trimmedText);
      setText('');
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
            Ответ на комментарий {replyTo.user_name || `пользователя #${replyTo.user}`}
          </Text>
        </View>
      )}
      {editComment && (
        <View style={styles.editBanner}>
          <Feather name="edit-2" size={14} color={colors.warning} />
          <Text style={styles.editText}>Редактирование комментария</Text>
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
          editable={!isSubmitting}
          accessibilityLabel="Поле ввода комментария"
        />
        <View style={styles.actions}>
          {showCancel && (
            <Pressable
              onPress={handleCancel}
              style={styles.cancelButton}
              accessibilityLabel="Отменить"
              accessibilityRole="button"
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={handleSubmit}
            disabled={!text.trim() || isSubmitting}
            style={[styles.sendButton, (!text.trim() || isSubmitting) && styles.sendButtonDisabled]}
            accessibilityLabel={editComment ? 'Сохранить изменения' : 'Отправить комментарий'}
            accessibilityRole="button"
          >
            {isSubmitting ? (
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
        transition: 'border-color 0.2s ease',
        outline: 'none',
      } as any,
    }),
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  cancelButton: {
    width: 38,
    height: 38,
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
    width: 38,
    height: 38,
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
