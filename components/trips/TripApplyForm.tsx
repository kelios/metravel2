// components/trips/TripApplyForm.tsx
// Flow «Хочу поехать» (#412): сообщение организатору + ссылки на соцсети,
// обязательные чекбоксы согласия и дисклеймер «MeTravel не организует».
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';

import Button from '@/components/ui/Button';
import ConsentCheckbox from '@/components/legal/ConsentCheckbox';
import SafetyNotice from '@/components/ui/SafetyNotice';
import { isDuplicateTripApplicationError, type PublicTrip } from '@/api/publicTrips';
import { useSubmitApplication } from '@/hooks/usePublicTripsApi';
import { useActionConsent } from '@/hooks/useActionConsent';
import { CONSENT_TYPES } from '@/utils/actionConsent';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface Props {
  trip: PublicTrip;
  onSubmitted?: () => void;
}

export const getTripApplyErrorMessage = (error: unknown): string =>
  isDuplicateTripApplicationError(error)
    ? i18nT('tripsStatic:tripApply.duplicateError')
    : i18nT('tripsStatic:tripApply.genericError');

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
  const [hasExistingApplication, setHasExistingApplication] = useState(false);

  const canSubmit =
    agreeRules &&
    agreeDisclaimer &&
    !submit.isPending &&
    !hasExistingApplication;

  const handleSubmit = () => {
    setError(null);
    if (message.trim().length < 10) {
      setError(i18nT('trips:components.trips.TripApplyForm.napishite_paru_slov_o_sebe_pochemu_hotite_po_36f0afb5'));
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
        onError: (submitError) => {
          if (isDuplicateTripApplicationError(submitError)) {
            setHasExistingApplication(true);
          }
          setError(getTripApplyErrorMessage(submitError));
        },
      },
    );
  };

  return (
    <View style={styles.wrap} testID="trip-apply-form">
      <Text style={styles.heading}>{i18nT('trips:components.trips.TripApplyForm.hochu_poehat_4a92c1e8')}</Text>

      <Text style={styles.label}>{i18nT('trips:components.trips.TripApplyForm.soobschenie_organizatoru_ee7cee00')}</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={i18nT('trips:components.trips.TripApplyForm.rasskazhite_o_sebe_opyt_chem_budete_polezny__03fac933')}
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.textArea}
        testID="trip-apply-message"
      />

      <Text style={styles.label}>{i18nT('trips:components.trips.TripApplyForm.ssylki_na_sotsseti_po_zhelaniyu_09a87889')}</Text>
      <TextInput
        value={links}
        onChangeText={setLinks}
        placeholder={i18nT('trips:components.trips.TripApplyForm.instagram_strava_telegram_po_odnoy_na_stroku_48adfb4b')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={styles.input}
        testID="trip-apply-links"
      />
      <Text style={styles.hint}>
        {i18nT('trips:components.trips.TripApplyForm.ssylki_pomogut_organizatoru_poznakomitsya_s__b5b89f75')}</Text>

      <View style={styles.consentBlock}>
        <ConsentCheckbox
          checked={agreeRules}
          onToggle={setAgreeRules}
          testID="trip-apply-consent-rules"
        >
          {i18nT('trips:components.trips.TripApplyForm.ya_oznakomilsya_s_243e7620')}{' '}
          <Link href="/trip-rules" style={styles.link}>
            {i18nT('trips:components.trips.TripApplyForm.pravilami_poezdok_c465f9f0')}</Link>{' '}
          {i18nT('trips:components.trips.TripApplyForm.i_ad42550a')}{' '}
          <Link href="/community-rules" style={styles.link}>
            {i18nT('trips:components.trips.TripApplyForm.pravilami_soobschestva_409de536')}</Link>
          .
        </ConsentCheckbox>
        <ConsentCheckbox
          checked={agreeDisclaimer}
          onToggle={setAgreeDisclaimer}
          testID="trip-apply-consent-disclaimer"
        >
          {i18nT('trips:components.trips.TripApplyForm.ya_ponimayu_chto_metravel_ne_organizuet_poez_324c6668')}</ConsentCheckbox>
      </View>

      <SafetyNotice text={i18nT('tripsStatic:tripApply.disclaimer')} style={styles.disclaimer} />

      {error ? (
        <Text style={styles.error} testID="trip-apply-error">
          {error}
        </Text>
      ) : null}

      <Button
        label={hasExistingApplication ? i18nT('trips:components.trips.TripApplyForm.zayavka_uzhe_otpravlena_0dde292e') : i18nT('trips:components.trips.TripApplyForm.otpravit_zayavku_81fc35af')}
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
