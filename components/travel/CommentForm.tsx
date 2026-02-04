import React, { useState, useEffect } from 'react';
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
          <Text style={styles.replyText}>
            Ответ на комментарий {replyTo.user_name || `пользователя #${replyTo.user}`}
          </Text>
        </View>
      )}
      {editComment && (
        <View style={styles.editBanner}>
          <Text style={styles.editText}>Редактирование комментария</Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={DESIGN_TOKENS.colors.textSubtle}
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
              <Feather name="x" size={20} color={DESIGN_TOKENS.colors.textMuted} />
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
              <ActivityIndicator size="small" color={DESIGN_TOKENS.colors.textOnPrimary} />
            ) : (
              <Feather name="send" size={20} color={DESIGN_TOKENS.colors.textOnPrimary} />
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

const styles = StyleSheet.create<Record<string, any>>({
  container: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    padding: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
    ...(Platform.OS === 'web' ? {
      boxShadow: DESIGN_TOKENS.shadows.light,
    } : DESIGN_TOKENS.shadowsNative.light),
  },
  replyBanner: {
    backgroundColor: DESIGN_TOKENS.colors.infoSoft,
    padding: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm - 6,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  replyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm - 1,
    color: DESIGN_TOKENS.colors.info,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
  editBanner: {
    backgroundColor: DESIGN_TOKENS.colors.warningSoft,
    padding: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm - 6,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  editText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm - 1,
    color: DESIGN_TOKENS.colors.warning,
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
    fontSize: DESIGN_TOKENS.typography.sizes.md - 1,
    lineHeight: 20,
    color: DESIGN_TOKENS.colors.text,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: DESIGN_TOKENS.colors.disabled,
  },
  charCount: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: DESIGN_TOKENS.colors.textSubtle,
    textAlign: 'right',
    marginTop: DESIGN_TOKENS.spacing.xxs,
  },
});
