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

const Lucide = Platform.OS === 'web' ? require('lucide-react') : require('lucide-react-native');
const Send = (Lucide as any).Send as any;
const X = (Lucide as any).X as any;
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
    } else {
      setText('');
    }
  }, [editComment]);

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
            Ответ на комментарий {replyTo.user_name || 'пользователя'}
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
          placeholderTextColor="#999"
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
              disabled={isSubmitting}
              accessibilityLabel="Отменить"
            >
              <X size={20} color="#666" />
            </Pressable>
          )}
          <Pressable
            onPress={handleSubmit}
            style={[styles.submitButton, !text.trim() && styles.submitButtonDisabled]}
            disabled={!text.trim() || isSubmitting}
            accessibilityLabel={editComment ? 'Сохранить изменения' : 'Отправить комментарий'}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" />
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  replyBanner: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '500',
  },
  editBanner: {
    backgroundColor: '#fff3e0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  editText: {
    fontSize: 13,
    color: '#f57c00',
    fontWeight: '500',
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
    fontSize: 15,
    lineHeight: 20,
    color: '#000',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
});
