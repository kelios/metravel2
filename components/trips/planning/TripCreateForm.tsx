// components/trips/planning/TripCreateForm.tsx
// Форма создания запланированной поездки (Sprint 13 / блок D): заголовок, описание,
// дата/время старта, транспорт, видимость, число мест и стартовая точка маршрута.
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import * as yup from 'yup';

import Button from '@/components/ui/Button';
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
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  onCreated?: (trip: PlannedTrip) => void;
}

const TRANSPORT_OPTIONS: TripTransport[] = ['car', 'bike', 'foot', 'public', 'mixed'];
const VISIBILITY_OPTIONS: TripVisibility[] = ['public', 'followers', 'private'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

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

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .min(3, 'Название должно быть не короче 3 символов')
    .required('Введите название поездки'),
  description: yup.string().trim(),
  startDate: yup
    .string()
    .trim()
    .required('Укажите дату старта')
    .matches(DATE_RE, 'Дата в формате ГГГГ-ММ-ДД')
    .test('valid-date', 'Некорректная дата', (value) => {
      if (!value) return false;
      const d = new Date(value);
      return !Number.isNaN(d.getTime());
    }),
  startTime: yup
    .string()
    .trim()
    .test('valid-time', 'Время в формате ЧЧ:ММ', (value) =>
      !value ? true : TIME_RE.test(value),
    ),
  transport: yup.string().oneOf(TRANSPORT_OPTIONS).required(),
  visibility: yup.string().oneOf(VISIBILITY_OPTIONS).required(),
  seatsTotal: yup
    .string()
    .trim()
    .required('Укажите число мест')
    .test('valid-seats', 'От 1 до 50 мест', (value) => {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 50;
    }),
  startPointName: yup.string().trim(),
  createTelegramGroup: yup.boolean().default(false),
  startLat: yup
    .string()
    .trim()
    .test('valid-lat', 'Широта от -90 до 90', (value) => {
      if (!value) return true;
      const n = Number(value);
      return Number.isFinite(n) && n >= -90 && n <= 90;
    }),
  startLng: yup
    .string()
    .trim()
    .test('valid-lng', 'Долгота от -180 до 180', (value) => {
      if (!value) return true;
      const n = Number(value);
      return Number.isFinite(n) && n >= -180 && n <= 180;
    }),
});

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

function TripCreateForm({ onCreated }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const create = useCreateTrip();
  const consent = useActionConsent(CONSENT_TYPES.TRIP_ORGANIZER);

  const [values, setValues] = useState<FormValues>({
    title: '',
    description: '',
    startDate: '',
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

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});
    if (!consentChecked) {
      setSubmitError('Подтвердите согласие организатора, чтобы создать поездку.');
      return;
    }
    void consent.grant();
    try {
      const valid = await schema.validate(values, { abortEarly: false });
      const input: CreateTripInput = {
        title: valid.title.trim(),
        description: (valid.description ?? '').trim(),
        startDate: valid.startDate.trim(),
        startTime: valid.startTime?.trim() ? valid.startTime.trim() : null,
        transport: valid.transport as TripTransport,
        visibility: valid.visibility as TripVisibility,
        seatsTotal: Number(valid.seatsTotal),
        startPoint: buildStartPoint(values),
        createTelegramGroup: values.createTelegramGroup,
      };
      create.mutate(input, {
        onSuccess: (trip) => onCreated?.(trip),
        onError: () =>
          setSubmitError('Не удалось создать поездку. Попробуйте ещё раз позже.'),
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
      <Text style={styles.heading}>Новая поездка</Text>

      <Text style={styles.label}>Название</Text>
      <TextInput
        value={values.title}
        onChangeText={(t) => setField('title', t)}
        placeholder="Например: Озёра Браславщины на выходные"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="trip-create-title"
      />
      {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}

      <Text style={styles.label}>Описание (по желанию)</Text>
      <TextInput
        value={values.description}
        onChangeText={(t) => setField('description', t)}
        placeholder="Идея поездки, что хотите увидеть, ожидания от попутчиков"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.textArea}
        testID="trip-create-description"
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Дата старта</Text>
          <TextInput
            value={values.startDate}
            onChangeText={(t) => setField('startDate', t)}
            placeholder="2026-07-11"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
            testID="trip-create-start-date"
          />
          {errors.startDate ? (
            <Text style={styles.error}>{errors.startDate}</Text>
          ) : null}
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Время (по желанию)</Text>
          <TextInput
            value={values.startTime}
            onChangeText={(t) => setField('startTime', t)}
            placeholder="08:00"
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

      <Text style={styles.label}>Транспорт</Text>
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {TRANSPORT_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Видимость</Text>
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {VISIBILITY_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{VISIBILITY_HINT[values.visibility]}</Text>

      <Text style={styles.label}>Число мест</Text>
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

      <Text style={styles.label}>Точка старта (по желанию)</Text>
      <TextInput
        value={values.startPointName}
        onChangeText={(t) => setField('startPointName', t)}
        placeholder="Например: Минск, площадь Победы"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="trip-create-start-point-name"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <TextInput
            value={values.startLat}
            onChangeText={(t) => setField('startLat', t)}
            placeholder="Широта"
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
            placeholder="Долгота"
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

      <ConsentCheckbox
        checked={values.createTelegramGroup}
        onToggle={(next) => setField('createTelegramGroup', next)}
        testID="trip-create-telegram-group"
        accessibilityLabel="Создать Telegram-группу для участников"
      >
        Создать Telegram-группу для участников
      </ConsentCheckbox>

      <ConsentCheckbox
        checked={consentChecked}
        onToggle={setConsentChecked}
        testID="trip-create-consent"
        accessibilityLabel="Согласие организатора с правилами и отказом от ответственности"
      >
        Я организатор поездки: беру на себя ответственность за встречу и маршрут,
        понимаю, что MeTravel не несёт ответственности за поездку, и принимаю{' '}
        <Link href={'/community-rules' as never} style={styles.link}>
          правила сообщества
        </Link>{' '}
        и{' '}
        <Link href={'/disclaimer' as never} style={styles.link}>
          отказ от ответственности
        </Link>
        .
      </ConsentCheckbox>

      {submitError ? (
        <Text style={styles.error} testID="trip-create-error">
          {submitError}
        </Text>
      ) : null}

      <Button
        label="Запланировать поездку"
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
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    chipText: { fontSize: 13, color: colors.textSecondary },
    chipTextActive: { color: colors.primary, fontWeight: '600' },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    link: { color: colors.primary, fontWeight: '600' },
  });

export default React.memo(TripCreateForm);
