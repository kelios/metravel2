// components/trips/planning/TripCreateForm.tsx
// Форма создания запланированной поездки (Sprint 13 / блок D): заголовок, описание,
// дата/время старта, транспорт, видимость, число мест и стартовая точка маршрута.
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import * as yup from 'yup';

import Button from '@/components/ui/Button';
import MiniCalendar from '@/components/calendar/MiniCalendar';
import ConsentCheckbox from '@/components/legal/ConsentCheckbox';
import { useActionConsent } from '@/hooks/useActionConsent';
import { CONSENT_TYPES } from '@/utils/actionConsent';
import type {
  CreateTripInput,
  PlannedTrip,
  RoutePoint,
  TripTransport,
  TripVisibility,
} from '@/api/plannedTrips';
import { useCreateTrip } from '@/hooks/usePlannedTripsApi';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  VISIBILITY_HINT,
  VISIBILITY_LABEL,
  formatTripDisplayDate,
  parseTripIsoDate,
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDefaultTripStartDate, type TripPlanPrefill } from '@/utils/tripPlanLinks';
import { globalFocusStyles } from '@/styles/globalFocus';
import { translate as i18nT } from '@/i18n'


interface Props {
  onCreated?: (trip: PlannedTrip) => void;
  initialValues?: TripPlanPrefill;
}

const TRANSPORT_OPTIONS: TripTransport[] = ['car', 'bike', 'foot', 'public', 'mixed'];
// БЭК хранит только is_public: 'followers' молча деградировал в «Личная» —
// не предлагаем, пока бэк не поддержит уровень видимости.
const VISIBILITY_OPTIONS: TripVisibility[] = ['public', 'private'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
export const parseTripCreateIsoDate = parseTripIsoDate;
export const formatTripCreateDisplayDate = formatTripDisplayDate;

interface FormValues {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  transport: TripTransport;
  visibility: TripVisibility;
  seatsTotal: string;
  startPointName: string;
  startLat: string;
  startLng: string;
  createTelegramGroup: boolean;
}

const createSchema = () => yup.object({
  title: yup
    .string()
    .trim()
    .required(i18nT('tripsStatic:tripCreate.validation.titleRequired'))
    .min(3, i18nT('tripsStatic:tripCreate.validation.titleMin')),
  description: yup.string().trim(),
  startDate: yup
    .string()
    .trim()
    .required(i18nT('tripsStatic:tripCreate.validation.startDateRequired'))
    .matches(DATE_RE, i18nT('tripsStatic:tripCreate.validation.startDateFormat'))
    .test('valid-date', i18nT('tripsStatic:tripCreate.validation.startDateInvalid'), (value) => {
      if (!value) return false;
      const d = new Date(value);
      return !Number.isNaN(d.getTime());
    }),
  startTime: yup
    .string()
    .trim()
    .test('valid-time', i18nT('tripsStatic:tripCreate.validation.startTimeFormat'), (value) =>
      !value ? true : TIME_RE.test(value),
    ),
  transport: yup.string().oneOf(TRANSPORT_OPTIONS).required(),
  visibility: yup.string().oneOf(VISIBILITY_OPTIONS).required(),
  seatsTotal: yup
    .string()
    .trim()
    .required(i18nT('tripsStatic:tripCreate.validation.seatsRequired'))
    .test('valid-seats', i18nT('tripsStatic:tripCreate.validation.seatsRange'), (value) => {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 50;
    }),
  startPointName: yup.string().trim(),
  createTelegramGroup: yup.boolean().default(false),
  startLat: yup
    .string()
    .trim()
    .test('valid-lat', i18nT('tripsStatic:tripCreate.validation.latitudeRange'), (value) => {
      if (!value) return true;
      const n = Number(value);
      return Number.isFinite(n) && n >= -90 && n <= 90;
    }),
  startLng: yup
    .string()
    .trim()
    .test('valid-lng', i18nT('tripsStatic:tripCreate.validation.longitudeRange'), (value) => {
      if (!value) return true;
      const n = Number(value);
      return Number.isFinite(n) && n >= -180 && n <= 180;
    }),
});

const FIELD_ERROR_ORDER: (keyof FormValues)[] = [
  'title',
  'startDate',
  'startTime',
  'seatsTotal',
  'startLat',
  'startLng',
];

const buildStartPoint = (values: FormValues): RoutePoint | null => {
  const name = values.startPointName.trim();
  if (!name) return null;
  const lat = values.startLat.trim();
  const lng = values.startLng.trim();
  const coordinates: [number, number] | null =
    lat && lng ? [Number(lng), Number(lat)] : null;
  return {
    id: 'start',
    type: 'place',
    name,
    coordinates,
    placeId: null,
    description: null,
  };
};

function TripCreateForm({ onCreated, initialValues }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webDateInputStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      borderRadius: 12,
      padding: '10px 12px',
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      lineHeight: '20px',
      outline: 'none',
      boxSizing: 'border-box',
    }),
    [colors],
  );
  const create = useCreateTrip();
  const consent = useActionConsent(CONSENT_TYPES.TRIP_ORGANIZER);

  const [values, setValues] = useState<FormValues>({
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    startDate: initialValues?.startDate ?? getDefaultTripStartDate(),
    startTime: '',
    transport: 'car',
    visibility: 'public',
    seatsTotal: '4',
    startPointName: '',
    startLat: '',
    startLng: '',
    createTelegramGroup: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const startDateDisplay = useMemo(
    () => formatTripCreateDisplayDate(values.startDate),
    [values.startDate],
  );
  const firstFieldError = useMemo(() => {
    for (const key of FIELD_ERROR_ORDER) {
      if (errors[key]) return errors[key];
    }
    return null;
  }, [errors]);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const openStartDatePicker = () => setDatePickerVisible(true);
  const closeStartDatePicker = () => setDatePickerVisible(false);
  const handleStartDateSelect = (date: string) => {
    setField('startDate', date);
    setDatePickerVisible(false);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});
    if (!consentChecked) {
      setSubmitError(i18nT('trips:components.trips.planning.TripCreateForm.podtverdite_soglasie_organizatora_chtoby_soz_fc79dbb1'));
      return;
    }
    void consent.grant();
    try {
      const valid = await createSchema().validate(values, { abortEarly: false });
      const input: CreateTripInput = {
        title: valid.title.trim(),
        description: (valid.description ?? '').trim(),
        startDate: valid.startDate.trim(),
        startTime: valid.startTime?.trim() ? valid.startTime.trim() : null,
        transport: valid.transport as TripTransport,
        visibility: valid.visibility as TripVisibility,
        seatsTotal: Number(valid.seatsTotal),
        startPoint: buildStartPoint(values),
        createTelegramGroup: false,
      };
      create.mutate(input, {
        onSuccess: (trip) => onCreated?.(trip),
        onError: () =>
          setSubmitError(i18nT('trips:components.trips.planning.TripCreateForm.ne_udalos_sozdat_poezdku_poprobuyte_esche_ra_f2723719')),
      });
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        const next: Partial<Record<keyof FormValues, string>> = {};
        for (const inner of err.inner) {
          if (inner.path && !next[inner.path as keyof FormValues]) {
            next[inner.path as keyof FormValues] = inner.message;
          }
        }
        setErrors(next);
      }
    }
  };

  return (
    <View style={styles.wrap} testID="trip-create-form">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.TripCreateForm.novaya_poezdka_1901be53')}</Text>

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.nazvanie_1cff860a')}</Text>
      <TextInput
        value={values.title}
        onChangeText={(t) => setField('title', t)}
        placeholder={i18nT('trips:components.trips.planning.TripCreateForm.naprimer_ozera_braslavschiny_na_vyhodnye_b602de55')}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="trip-create-title"
      />
      {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.opisanie_po_zhelaniyu_ca092e13')}</Text>
      <TextInput
        value={values.description}
        onChangeText={(t) => setField('description', t)}
        placeholder={i18nT('trips:components.trips.planning.TripCreateForm.ideya_poezdki_ssylki_chto_hotite_uvidet_ozhi_d96cfbbf')}
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.textArea}
        testID="trip-create-description"
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.data_starta_051d8790')}</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={values.startDate}
              onChange={(event) => setField('startDate', event.target.value)}
              aria-label={i18nT('trips:components.trips.planning.TripCreateForm.data_starta_051d8790')}
              data-testid="trip-create-start-date"
              style={webDateInputStyle}
            />
          ) : (
            <>
              <Pressable
                onPress={openStartDatePicker}
                accessibilityRole="button"
                accessibilityLabel={i18nT('trips:components.trips.planning.TripCreateForm.vybrat_datu_starta_b5b7ab99')}
                accessibilityHint={i18nT('trips:components.trips.planning.TripCreateForm.otkroet_kalendar_vybora_daty_0583ffc3')}
                style={[styles.datePickerTrigger, globalFocusStyles.focusable]}
                testID="trip-create-start-date"
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text
                  style={[
                    styles.datePickerText,
                    !values.startDate && styles.datePickerPlaceholder,
                  ]}
                  numberOfLines={1}
                  testID="trip-create-start-date-value"
                >
                  {startDateDisplay}
                </Text>
              </Pressable>
              <Modal
                visible={datePickerVisible}
                transparent
                animationType="fade"
                onRequestClose={closeStartDatePicker}
                statusBarTranslucent
              >
                <Pressable
                  style={styles.datePickerOverlay}
                  onPress={closeStartDatePicker}
                  testID="trip-create-date-picker-backdrop"
                >
                  <Pressable
                    style={styles.datePickerSheet}
                    onPress={() => undefined}
                    testID="trip-create-date-picker"
                  >
                    <View style={styles.datePickerHeader}>
                      <View style={styles.datePickerTitleRow}>
                        <Feather name="calendar" size={18} color={colors.primary} />
                        <Text style={styles.datePickerTitle}>{i18nT('trips:components.trips.planning.TripCreateForm.data_starta_051d8790')}</Text>
                      </View>
                      <Text style={styles.datePickerHint}>
                        {i18nT('trips:components.trips.planning.TripCreateForm.vyberite_den_v_kalendare_otmena_ne_izmenit_t_3eba0aae')}</Text>
                    </View>
                    <View style={styles.datePickerCalendar}>
                      <MiniCalendar
                        entries={[]}
                        selectedDate={values.startDate || null}
                        focusDate={values.startDate || getDefaultTripStartDate()}
                        onDayPress={handleStartDateSelect}
                        accentColor={colors.primary}
                        accentSoftColor={colors.primaryLight}
                      />
                    </View>
                    <Button
                      label={i18nT('trips:components.trips.planning.TripCreateForm.otmena_b15b4282')}
                      onPress={closeStartDatePicker}
                      variant="secondary"
                      fullWidth
                      testID="trip-create-start-date-cancel"
                    />
                  </Pressable>
                </Pressable>
              </Modal>
            </>
          )}
          {errors.startDate ? (
            <Text style={styles.error}>{errors.startDate}</Text>
          ) : null}
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.vremya_po_zhelaniyu_681acf37')}</Text>
          <TextInput
            value={values.startTime}
            onChangeText={(t) => setField('startTime', t)}
            placeholder={i18nT('trips:components.trips.planning.TripCreateForm.naprimer_08_00_536b52a7')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
            testID="trip-create-start-time"
          />
          {errors.startTime ? (
            <Text style={styles.error}>{errors.startTime}</Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.transport_3e664411')}</Text>
      <View style={styles.chips}>
        {TRANSPORT_OPTIONS.map((option) => {
          const active = values.transport === option;
          return (
            <Pressable
              key={option}
              onPress={() => setField('transport', option)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`trip-create-transport-${option}`}
            >
              <Feather
                name={TRANSPORT_ICON_NAME[option] as never}
                size={13}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text
                numberOfLines={1}
                textBreakStrategy="simple"
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {TRANSPORT_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.vidimost_7bd64d56')}</Text>
      <View style={styles.chips}>
        {VISIBILITY_OPTIONS.map((option) => {
          const active = values.visibility === option;
          return (
            <Pressable
              key={option}
              onPress={() => setField('visibility', option)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`trip-create-visibility-${option}`}
            >
              <Text
                numberOfLines={1}
                textBreakStrategy="simple"
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {VISIBILITY_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{VISIBILITY_HINT[values.visibility]}</Text>

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.chislo_mest_d9075ef5')}</Text>
      <TextInput
        value={values.seatsTotal}
        onChangeText={(t) => setField('seatsTotal', t.replace(/[^0-9]/g, ''))}
        placeholder="4"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        style={styles.input}
        testID="trip-create-seats"
      />
      {errors.seatsTotal ? (
        <Text style={styles.error}>{errors.seatsTotal}</Text>
      ) : null}

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripCreateForm.tochka_starta_po_zhelaniyu_f2b51d15')}</Text>
      <TextInput
        value={values.startPointName}
        onChangeText={(t) => setField('startPointName', t)}
        placeholder={i18nT('trips:components.trips.planning.TripCreateForm.naprimer_minsk_ploschad_pobedy_2b2fb722')}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="trip-create-start-point-name"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <TextInput
            value={values.startLat}
            onChangeText={(t) => setField('startLat', t)}
            placeholder={i18nT('trips:components.trips.planning.TripCreateForm.shirota_1d753d15')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
            testID="trip-create-start-lat"
          />
          {errors.startLat ? (
            <Text style={styles.error}>{errors.startLat}</Text>
          ) : null}
        </View>
        <View style={styles.col}>
          <TextInput
            value={values.startLng}
            onChangeText={(t) => setField('startLng', t)}
            placeholder={i18nT('trips:components.trips.planning.TripCreateForm.dolgota_e82f7abe')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
            testID="trip-create-start-lng"
          />
          {errors.startLng ? (
            <Text style={styles.error}>{errors.startLng}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.disabledNotice} testID="trip-create-telegram-unavailable">
        <Feather name="send" size={15} color={colors.textMuted} />
        <Text style={styles.hint}>
          {i18nT('trips:components.trips.planning.TripCreateForm.telegram_gruppa_dlya_uchastnikov_poyavitsya__f43fac89')}</Text>
      </View>

      <ConsentCheckbox
        checked={consentChecked}
        onToggle={setConsentChecked}
        testID="trip-create-consent"
        accessibilityLabel={i18nT('trips:components.trips.planning.TripCreateForm.soglasie_organizatora_s_pravilami_i_otkazom__aedac6a7')}
      >
        {i18nT('trips:components.trips.planning.TripCreateForm.ya_organizator_poezdki_beru_na_sebya_otvetst_74b68913')}{' '}
        <Link href={'/community-rules' as never} style={styles.link}>
          {i18nT('trips:components.trips.planning.TripCreateForm.pravila_soobschestva_6d9ab0e4')}</Link>{' '}
        {i18nT('trips:components.trips.planning.TripCreateForm.i_7de6b56d')}{' '}
        <Link href={'/disclaimer' as never} style={styles.link}>
          {i18nT('trips:components.trips.planning.TripCreateForm.otkaz_ot_otvetstvennosti_12a25d18')}</Link>
        .
      </ConsentCheckbox>

      {submitError ? (
        <Text style={styles.error} testID="trip-create-error">
          {submitError}
        </Text>
      ) : null}

      {!submitError && firstFieldError ? (
        <Text style={styles.errorSummary} testID="trip-create-first-error">
          {firstFieldError}
        </Text>
      ) : null}

      <Button
        label={i18nT('trips:components.trips.planning.TripCreateForm.zaplanirovat_poezdku_5e8537a1')}
        onPress={handleSubmit}
        loading={create.isPending}
        disabled={create.isPending || !consentChecked}
        fullWidth
        testID="trip-create-submit"
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
    row: { flexDirection: 'row', gap: 10 },
    col: { flex: 1, gap: 6 },
    datePickerTrigger: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      minHeight: Platform.OS === 'android' ? 48 : 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    datePickerText: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    datePickerPlaceholder: { color: colors.textMuted },
    datePickerOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
      padding: 16,
    },
    datePickerSheet: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      gap: 12,
    },
    datePickerHeader: { gap: 6 },
    datePickerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    datePickerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    datePickerHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    datePickerCalendar: { marginHorizontal: -16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    // #672: базовый вес '600'. На Android normal-weight (400) текст в чипе
    // измеряется Yoga на ~20% уже, чем реально рендерится → чип обхватывает
    // заниженную ширину и лейбл обрезается («На велосипе…»). Вес 600 меряется
    // корректно (потому active-чип всегда был полным). Active/inactive
    // различаются цветом/бордером/фоном, не весом.
    chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    chipTextActive: { color: colors.primaryText, fontWeight: '600' },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    disabledNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
    },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    errorSummary: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    link: { color: colors.primaryText, fontWeight: '600' },
  });

export default React.memo(TripCreateForm);
