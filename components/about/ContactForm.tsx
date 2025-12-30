import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { aboutStyles } from './aboutStyles';

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
  emailRef: React.RefObject<TextInput>;
  messageRef: React.RefObject<TextInput>;
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
}) => (
  <View style={aboutStyles.contactSection}>
    <View style={aboutStyles.contactHeader}>
      <Text style={aboutStyles.contactTitle}>Связаться с нами</Text>
      <Text style={aboutStyles.contactSubtitle}>Есть вопросы или предложения? Напишите нам!</Text>
    </View>

    <View style={aboutStyles.form}>
      {response.text !== '' && (
        <Text role="alert" aria-live="polite" style={[aboutStyles.response, response.error ? aboutStyles.err : aboutStyles.ok]}>
          {response.text}
        </Text>
      )}

      {/* honeypot */}
      <TextInput
        style={aboutStyles.honeypot}
        value={hp}
        onChangeText={onChangeHp}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        placeholder="Do not fill"
      />

      <TextInput
        style={[
          aboutStyles.input,
          invalidName && aboutStyles.inputErr,
          inputFocus.name && aboutStyles.inputFocused,
          globalFocusStyles.focusable,
        ]}
        placeholder="Имя"
        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
        value={name}
        onChangeText={onChangeName}
        returnKeyType="next"
        onFocus={onFocusName}
        onBlur={onBlurName}
        onSubmitEditing={onSubmitEditingEmail}
      />
      {invalidName && (
        <View style={aboutStyles.errorContainer}>
          <Text style={aboutStyles.fieldErr}>Укажите имя</Text>
        </View>
      )}

      <TextInput
        ref={emailRef}
        style={[
          aboutStyles.input,
          invalidEmail && aboutStyles.inputErr,
          inputFocus.email && aboutStyles.inputFocused,
          globalFocusStyles.focusable,
        ]}
        placeholder="Email"
        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
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
        <View style={aboutStyles.errorContainer}>
          <Text style={aboutStyles.fieldErr}>Неверный e-mail</Text>
        </View>
      )}

      <TextInput
        ref={messageRef}
        style={[
          aboutStyles.input,
          aboutStyles.message,
          invalidMessage && aboutStyles.inputErr,
          inputFocus.message && aboutStyles.inputFocused,
          globalFocusStyles.focusable,
        ]}
        placeholder="Сообщение"
        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
        value={message}
        onChangeText={onChangeMessage}
        multiline
        blurOnSubmit={false}
        onKeyPress={onKeyPress}
        onFocus={onFocusMessage}
        onBlur={onBlurMessage}
        onSubmitEditing={Platform.OS !== 'web' ? () => onSubmit() : undefined}
      />
      {invalidMessage && (
        <View style={aboutStyles.errorContainer}>
          <Text style={aboutStyles.fieldErr}>Напишите сообщение</Text>
        </View>
      )}

      <Pressable
        onPress={onToggleAgree}
        style={({ pressed }) => [aboutStyles.agreeRow, pressed && aboutStyles.agreeRowPressed]}
      >
        <View style={[aboutStyles.checkbox, agree && aboutStyles.checkboxChecked]}>
          {agree ? <Text style={aboutStyles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={[aboutStyles.agreeLabel, invalidAgree && aboutStyles.fieldErr]}>
          Согласен(на) на обработку персональных данных
        </Text>
      </Pressable>
      {invalidAgree && <Text style={aboutStyles.fieldErr}>Нужно согласие</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={isDisabled}
        style={({ pressed }) => [
          aboutStyles.submitButton,
          isDisabled && aboutStyles.submitButtonDisabled,
          pressed && !isDisabled && aboutStyles.submitButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={sending ? 'Отправка сообщения' : 'Отправить сообщение'}
      >
        {sending ? (
          <View style={aboutStyles.submitButtonContent}>
            <ActivityIndicator size="small" color={DESIGN_TOKENS.colors.surface} style={{ marginRight: 8 }} />
            <Text style={aboutStyles.submitButtonText}>Отправка…</Text>
          </View>
        ) : (
          <Text style={aboutStyles.submitButtonText}>Отправить</Text>
        )}
      </Pressable>
    </View>
  </View>
);
