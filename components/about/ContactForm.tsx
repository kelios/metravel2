import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useAboutStyles } from './aboutStyles';
import { useThemedColors } from '@/hooks/useTheme';

type ContactFormProps = {
  response: { text: string; error: boolean };
  hp: string;
  onChangeHp: (v: string) => void;
  name: string;
  email: string;
  message: string;
  onChangeName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangeMessage: (v: string) => void;
  invalidName: boolean;
  invalidEmail: boolean;
  invalidMessage: boolean;
  invalidAgree: boolean;
  agree: boolean;
  onToggleAgree: () => void;
  onSubmit: () => void;
  isDisabled: boolean;
  sending: boolean;
  inputFocus: { name?: boolean; email?: boolean; message?: boolean };
  onFocusName: () => void;
  onBlurName: () => void;
  onFocusEmail: () => void;
  onBlurEmail: () => void;
  onFocusMessage: () => void;
  onBlurMessage: () => void;
  onKeyPress: (e: any) => void;
  emailRef: React.RefObject<TextInput | null>;
  messageRef: React.RefObject<TextInput | null>;
  onSubmitEditingEmail: () => void;
  onSubmitEditingMessage: () => void;
};

export const ContactForm: React.FC<ContactFormProps> = ({
  response,
  hp,
  onChangeHp,
  name,
  email,
  message,
  onChangeName,
  onChangeEmail,
  onChangeMessage,
  invalidName,
  invalidEmail,
  invalidMessage,
  invalidAgree,
  agree,
  onToggleAgree,
  onSubmit,
  isDisabled,
  sending,
  inputFocus,
  onFocusName,
  onBlurName,
  onFocusEmail,
  onBlurEmail,
  onFocusMessage,
  onBlurMessage,
  onKeyPress,
  emailRef,
  messageRef,
  onSubmitEditingEmail,
  onSubmitEditingMessage,
}) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
  return (
  <View style={styles.contactSection}>
    <View style={styles.contactHeader}>
      <Text style={styles.contactTitle}>Связаться с нами</Text>
      <Text style={styles.contactSubtitle}>Есть вопросы или предложения? Напишите нам!</Text>
    </View>

    <View style={styles.form}>
      {response.text !== '' && (
        <Text role="alert" aria-live="polite" style={[styles.response, response.error ? styles.err : styles.ok]}>
          {response.text}
        </Text>
      )}

      {/* honeypot */}
      <TextInput
        style={styles.honeypot}
        value={hp}
        onChangeText={onChangeHp}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        placeholder="Do not fill"
      />

      <TextInput
        style={[
          styles.input,
          invalidName && styles.inputErr,
          inputFocus.name && styles.inputFocused,
          globalFocusStyles.focusable,
        ]}
        placeholder="Имя"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={onChangeName}
        returnKeyType="next"
        onFocus={onFocusName}
        onBlur={onBlurName}
        onSubmitEditing={onSubmitEditingEmail}
      />
      {invalidName && (
        <View style={styles.errorContainer}>
          <Text style={styles.fieldErr}>Укажите имя</Text>
        </View>
      )}

      <TextInput
        ref={emailRef}
        style={[
          styles.input,
          invalidEmail && styles.inputErr,
          inputFocus.email && styles.inputFocused,
          globalFocusStyles.focusable,
        ]}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="next"
        onFocus={onFocusEmail}
        onBlur={onBlurEmail}
        onSubmitEditing={onSubmitEditingMessage}
      />
      {invalidEmail && (
        <View style={styles.errorContainer}>
          <Text style={styles.fieldErr}>Неверный e-mail</Text>
        </View>
      )}

      <TextInput
        ref={messageRef}
        style={[
          styles.input,
          styles.message,
          invalidMessage && styles.inputErr,
          inputFocus.message && styles.inputFocused,
          globalFocusStyles.focusable,
        ]}
        placeholder="Сообщение"
        placeholderTextColor={colors.textMuted}
        value={message}
        onChangeText={onChangeMessage}
        multiline
        blurOnSubmit={false}
        onKeyPress={onKeyPress}
        onFocus={onFocusMessage}
        onBlur={onBlurMessage}
        onSubmitEditing={Platform.OS !== 'web' ? () => onSubmit() : undefined}
      />
      <Text style={styles.helperText}>Shift+Enter — новая строка, Enter — отправить (web)</Text>
      {invalidMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.fieldErr}>Напишите сообщение</Text>
        </View>
      )}

      <Pressable
        onPress={onToggleAgree}
        style={({ pressed }) => [styles.agreeRow, pressed && styles.agreeRowPressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agree }}
        accessibilityLabel="Согласен на обработку персональных данных"
      >
        <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
          {agree ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={[styles.agreeLabel, invalidAgree && styles.fieldErr]}>
          Согласен(на) на обработку персональных данных
        </Text>
      </Pressable>
      {invalidAgree && <Text style={styles.fieldErr}>Нужно согласие</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.submitButton,
          isDisabled && styles.submitButtonDisabled,
          pressed && !isDisabled && styles.submitButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={sending ? 'Отправка сообщения' : 'Отправить сообщение'}
      >
        {sending ? (
          <View style={styles.submitButtonContent}>
            <ActivityIndicator size="small" color={colors.textOnPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>Отправка…</Text>
          </View>
        ) : (
          <Text style={styles.submitButtonText}>Отправить</Text>
        )}
      </Pressable>
    </View>
  </View>
  );
};
