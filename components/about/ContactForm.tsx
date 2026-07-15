import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useAboutStyles } from './aboutStyles';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


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
      <Text style={styles.contactTitle}>{i18nT('home:components.about.ContactForm.svyazatsya_s_nami_6710884b')}</Text>
      <Text style={styles.contactSubtitle}>{i18nT('home:components.about.ContactForm.est_voprosy_ili_predlozheniya_napishite_nam_9548fc8e')}</Text>
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
        autoComplete="off"
        placeholder={i18nT('home:components.about.ContactForm.do_not_fill_d576b690')}
      />

      <TextInput
        style={[
          styles.input,
          invalidName && styles.inputErr,
          inputFocus.name && styles.inputFocused,
          globalFocusStyles.focusable,
        ]}
        placeholder={i18nT('home:components.about.ContactForm.imya_8ff1243b')}
        accessibilityLabel={i18nT('home:components.about.ContactForm.imya_8ff1243b')}
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={onChangeName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onFocus={onFocusName}
        onBlur={onBlurName}
        onSubmitEditing={onSubmitEditingEmail}
      />
      {invalidName && (
        <View style={styles.errorContainer}>
          <Text style={styles.fieldErr}>{i18nT('home:components.about.ContactForm.ukazhite_imya_111e75b0')}</Text>
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
        placeholder={i18nT('home:components.about.ContactForm.email_9d826bfd')}
        accessibilityLabel={i18nT('home:components.about.ContactForm.email_9d826bfd')}
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="next"
        onFocus={onFocusEmail}
        onBlur={onBlurEmail}
        onSubmitEditing={onSubmitEditingMessage}
      />
      {invalidEmail && (
        <View style={styles.errorContainer}>
          <Text style={styles.fieldErr}>{i18nT('home:components.about.ContactForm.nevernyy_e_mail_31ba55fd')}</Text>
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
        placeholder={i18nT('home:components.about.ContactForm.soobschenie_a7b64c0e')}
        accessibilityLabel={i18nT('home:components.about.ContactForm.soobschenie_a7b64c0e')}
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
      <Text style={styles.helperText}>{i18nT('home:components.about.ContactForm.shift_enter_novaya_stroka_enter_otpravit_web_26a15cc6')}</Text>
      {invalidMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.fieldErr}>{i18nT('home:components.about.ContactForm.napishite_soobschenie_6a0a05bf')}</Text>
        </View>
      )}

      <Pressable
        onPress={onToggleAgree}
        style={({ pressed }) => [styles.agreeRow, pressed && styles.agreeRowPressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agree }}
        accessibilityLabel={i18nT('home:components.about.ContactForm.soglasen_na_obrabotku_personalnyh_dannyh_2823c5ba')}
      >
        <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
          {agree ? <Feather name="check" size={15} color={colors.textOnPrimary} /> : null}
        </View>
        <Text style={[styles.agreeLabel, invalidAgree && styles.fieldErr]}>
          {i18nT('home:components.about.ContactForm.soglasen_na_na_obrabotku_personalnyh_dannyh_ffa70353')}</Text>
      </Pressable>
      {invalidAgree && <Text style={styles.fieldErr}>{i18nT('home:components.about.ContactForm.nuzhno_soglasie_add49b70')}</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.submitButton,
          isDisabled && styles.submitButtonDisabled,
          pressed && !isDisabled && styles.submitButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={sending ? i18nT('home:components.about.ContactForm.otpravka_soobscheniya_49acc4df') : i18nT('home:components.about.ContactForm.otpravit_soobschenie_44e9eb71')}
      >
        {sending ? (
          <View style={styles.submitButtonContent}>
            <ActivityIndicator size="small" color={colors.textOnPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>{i18nT('home:components.about.ContactForm.otpravka_68816a2a')}</Text>
          </View>
        ) : (
          <Text style={styles.submitButtonText}>{i18nT('home:components.about.ContactForm.otpravit_879fca58')}</Text>
        )}
      </Pressable>
    </View>
  </View>
  );
};
