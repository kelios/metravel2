import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import ConsentCheckbox from '@/components/legal/ConsentCheckbox';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import { AUTH_TERMS_CONSENT } from '@/utils/actionConsent';

/**
 * #2132 (Apple 1.2): согласие с условиями — условие создания аккаунта, а не
 * отдельный вызов после входа. Форма держит одну галку над всеми провайдерами;
 * пока она снята, кнопки email, Apple, Google и Facebook видимы, но неактивны.
 *
 * `termsVersion` есть только при отмеченной галке: клиент никогда не отправляет
 * серверу согласие, которого человек не давал (#2128 пишет его из тела запроса).
 */
type AuthTermsAcceptanceOptions = {
  /**
   * #2898, web: согласие даётся самим действием входа/регистрации. Рядом с
   * кнопками всегда видна строка «Нажимая …, вы принимаете …» со ссылками на
   * оба документа (clickwrap), отдельной галки-барьера нет. Сервер по-прежнему
   * получает `termsVersion` только вместе с действием человека — без нажатия
   * ни один запрос с согласием не уходит.
   *
   * Native оставляет явную галку #2132: её требовал App Review (1.2 UGC), и
   * повторная отправка iOS-приложения ещё не прошла — менять механизм там без
   * решения владельца нельзя.
   */
  consentByAction?: boolean;
};

export function useAuthTermsAcceptance({ consentByAction = false }: AuthTermsAcceptanceOptions = {}) {
  const [checked, setChecked] = useState(false);
  const accepted = consentByAction || checked;
  return {
    accepted,
    consentByAction,
    setAccepted: setChecked,
    termsVersion: accepted ? AUTH_TERMS_CONSENT.version : undefined,
  };
}

type AuthTermsGateProps = {
  accepted: boolean;
  onChange: (next: boolean) => void;
  /** #2898: вместо галки — уведомление «Нажимая …, вы принимаете …» (web). */
  consentByAction?: boolean;
  /** Подсказка «отметьте, чтобы войти» — только на формах входа и регистрации. */
  showHint?: boolean;
  testID?: string;
};

export default function AuthTermsGate({
  accepted,
  onChange,
  consentByAction = false,
  showHint = true,
  testID = 'auth-terms-gate',
}: AuthTermsGateProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const documents = (
    <>
      <Link href="/terms" style={styles.link}>
        {i18nT('authStatic:terms.termsLink')}
      </Link>{' '}
      {i18nT('authStatic:terms.and')}{' '}
      <Link href="/community-rules" style={styles.link}>
        {i18nT('authStatic:terms.rulesLink')}
      </Link>
      {i18nT('authStatic:terms.suffix')}
    </>
  );

  if (consentByAction) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.notice} testID={`${testID}-notice`}>
          {i18nT('authStatic:terms.byActionPrefix')}{' '}
          {documents}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <ConsentCheckbox
        checked={accepted}
        onToggle={onChange}
        testID={`${testID}-checkbox`}
        accessibilityLabel={i18nT(AUTH_TERMS_CONSENT.labelKey)}
      >
        {i18nT('authStatic:terms.prefix')}{' '}
        {documents}
      </ConsentCheckbox>
      {accepted || !showHint ? null : (
        <Text style={styles.hint} testID={`${testID}-hint`}>
          {i18nT('authStatic:terms.hint')}
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      gap: 4,
      marginBottom: 16,
    },
    link: {
      color: colors.primaryText,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    notice: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
