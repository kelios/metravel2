// components/trips/TripApplyForm.tsx
// Flow «Хочу поехать» (#412): сообщение организатору + ссылки на соцсети,
// обязательные чекбоксы согласия и дисклеймер «MeTravel не организует».
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';

import Button from '@/components/ui/Button';
import ConsentCheckbox from '@/components/legal/ConsentCheckbox';
import SafetyNotice from '@/components/ui/SafetyNotice';
import type { PublicTrip } from '@/api/publicTrips';
import { useSubmitApplication } from '@/hooks/usePublicTripsApi';
import { useActionConsent } from '@/hooks/useActionConsent';
import { CONSENT_TYPES } from '@/utils/actionConsent';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PublicTrip;
  onSubmitted?: () => void;
}

const DISCLAIMER =
  'MeTravel не организует поездки и не является их участником. Это площадка для знакомства попутчиков — все договорённости, оплата и ответственность остаются на участниках.';

function parseLinks(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function TripApplyForm({ trip, onSubmitted }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const submit = useSubmitApplication();
  const tripApplyConsent = useActionConsent(CONSENT_TYPES.TRIP_APPLY);

  const [message, setMessage] = useState('');
  const [links, setLinks] = useState('');
  const [agreeRules, setAgreeRules] = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    agreeRules &&
    agreeDisclaimer &&
    !submit.isPending;

  const handleSubmit = () => {
    setError(null);
    if (message.trim().length < 10) {
      setError('Напишите пару слов о себе — почему хотите поехать (минимум 10 символов).');
      return;
    }
    submit.mutate(
      {
        tripId: trip.id,
        message: message.trim(),
        socialLinks: parseLinks(links),
      },
      {
        onSuccess: () => {
          // Заявка принята → фиксируем факт согласия (локально + BE #435).
          void tripApplyConsent.grant();
          onSubmitted?.();
        },
        onError: () =>
          setError('Не удалось отправить заявку. Попробуйте ещё раз позже.'),
      },
    );
  };

  return (
    <View style={styles.wrap} testID="trip-apply-form">
      <Text style={styles.heading}>Хочу поехать</Text>

      <Text style={styles.label}>Сообщение организатору</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Расскажите о себе: опыт, чем будете полезны, что ждёте от поездки"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.textArea}
        testID="trip-apply-message"
      />

      <Text style={styles.label}>Ссылки на соцсети (по желанию)</Text>
      <TextInput
        value={links}
        onChangeText={setLinks}
        placeholder="Instagram, Strava, Telegram… по одной на строку"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={styles.input}
        testID="trip-apply-links"
      />
      <Text style={styles.hint}>
        Ссылки помогут организатору познакомиться с вами. Они видны только ему.
      </Text>

      <View style={styles.consentBlock}>
        <ConsentCheckbox
          checked={agreeRules}
          onToggle={setAgreeRules}
          testID="trip-apply-consent-rules"
        >
          Я ознакомился с{' '}
          <Link href="/trip-rules" style={styles.link}>
            правилами поездок
          </Link>{' '}
          и{' '}
          <Link href="/community-rules" style={styles.link}>
            правилами сообщества
          </Link>
          .
        </ConsentCheckbox>
        <ConsentCheckbox
          checked={agreeDisclaimer}
          onToggle={setAgreeDisclaimer}
          testID="trip-apply-consent-disclaimer"
        >
          Я понимаю, что MeTravel не организует поездку и не несёт
          ответственности за договорённости участников.
        </ConsentCheckbox>
      </View>

      <SafetyNotice text={DISCLAIMER} style={styles.disclaimer} />

      {error ? (
        <Text style={styles.error} testID="trip-apply-error">
          {error}
        </Text>
      ) : null}

      <Button
        label="Отправить заявку"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={submit.isPending}
        fullWidth
        testID="trip-apply-submit"
      />
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      minHeight: 96,
      textAlignVertical: 'top',
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    consentBlock: { gap: 12, marginTop: 6 },
    link: { color: colors.primaryText, fontWeight: '600' },
    disclaimer: { marginTop: 4 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  });

export default React.memo(TripApplyForm);
