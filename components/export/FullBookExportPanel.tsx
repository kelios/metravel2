// #2357 F2: «Вся книга за период» на /export (desktop web).
//
// Отдельно от ручного выбора загруженных карточек: период задаёт сервер (B1),
// число найденных путешествий приходит с сервера, а не из загруженных страниц
// каталога. Настройки — та же модалка книги, полный DTO. Сборка идёт серверным
// заданием; страницу можно закрыть, статус восстановится из списка заданий.

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { ApiError } from '@/api/clientErrors';
import BookSettingsModal from '@/components/export/BookSettingsModal';
import UIButton from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  FULL_BOOK_DEFAULT_SORT_ORDER,
  isFullBookJobActive,
  useFullBookExport,
  type FullBookExportController,
} from '@/hooks/useFullBookExport';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT, translatePlural } from '@/i18n';
import { FULL_BOOK_MIN_YEAR, isValidFullBookPeriod } from '@/services/book/fullBookExportSubmission';
import type { BookSettings } from '@/types/bookSettings';
import FullBookJobStatus from './FullBookJobStatus';

const errorCodeOf = (error: unknown): string | null => {
  if (!(error instanceof ApiError)) return null;
  const code = (error.data as { error_code?: unknown } | undefined)?.error_code;
  return typeof code === 'string' ? code : null;
};

const sanitizeYear = (text: string) => text.replace(/[^0-9]/g, '').slice(0, 4);

type Props = {
  controller: FullBookExportController;
  baseSettings: BookSettings;
  userName: string;
};

export function FullBookExportPanel({ controller, baseSettings, userName }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentYear = new Date().getFullYear();
  const initialPeriod = controller.savedPeriod ?? { yearFrom: currentYear - 1, yearTo: currentYear };
  const [yearFromText, setYearFromText] = useState(String(initialPeriod.yearFrom));
  const [yearToText, setYearToText] = useState(String(initialPeriod.yearTo));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const period = useMemo(
    () => ({ yearFrom: Number(yearFromText), yearTo: Number(yearToText) }),
    [yearFromText, yearToText],
  );
  const isPeriodValid = isValidFullBookPeriod(period, currentYear);
  const { draft, job } = controller;
  const jobActive = isFullBookJobActive(job) || controller.isObservingJob;
  const findErrorCode = errorCodeOf(controller.findPeriodError);

  const handleFind = useCallback(() => {
    if (!isPeriodValid) return;
    controller.findPeriod(period);
  }, [controller, isPeriodValid, period]);

  const handleYearFrom = useCallback(
    (text: string) => {
      setYearFromText(sanitizeYear(text));
      controller.clearDraft();
    },
    [controller],
  );
  const handleYearTo = useCallback(
    (text: string) => {
      setYearToText(sanitizeYear(text));
      controller.clearDraft();
    },
    [controller],
  );

  const settingsDefaults = useMemo<BookSettings>(
    () => ({ ...baseSettings, sortOrder: FULL_BOOK_DEFAULT_SORT_ORDER }),
    [baseSettings],
  );

  // Модалка ждёт onSave и закрывается только после принятого задания; при
  // ошибке остаётся открытой, а причина видна под панелью.
  const handleSubmit = useCallback(
    async (settings: BookSettings) => {
      await controller.submit(settings);
    },
    [controller],
  );

  const periodLabel = i18nT('export:components.export.FullBookExport.periodRange', {
    value1: String(draft?.yearFrom ?? period.yearFrom),
    value2: String(draft?.yearTo ?? period.yearTo),
  });

  return (
    <View style={styles.panel} accessibilityLabel={i18nT('export:components.export.FullBookExport.title')}>
      {draft ? (
        <BookSettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSubmit}
          defaultSettings={settingsDefaults}
          travelCount={draft.travelCount}
          userName={userName}
          mode="save"
        />
      ) : null}

      <View style={styles.headerRow}>
        <Feather name="book" size={16} color={colors.primary} />
        <Text style={styles.title} accessibilityRole="header">
          {i18nT('export:components.export.FullBookExport.title')}
        </Text>
      </View>
      <Text style={styles.hint}>{i18nT('export:components.export.FullBookExport.hint')}</Text>

      <View style={styles.periodRow}>
        <View style={styles.yearField}>
          <Text style={styles.yearLabel}>{i18nT('export:components.export.FullBookExport.yearFrom')}</Text>
          <TextInput
            value={yearFromText}
            onChangeText={handleYearFrom}
            keyboardType="numeric"
            maxLength={4}
            editable={!controller.isFindingPeriod && !controller.isSubmitting}
            style={styles.yearInput}
            accessibilityLabel={i18nT('export:components.export.FullBookExport.yearFromA11y')}
            testID="full-book-year-from"
          />
        </View>
        <View style={styles.yearField}>
          <Text style={styles.yearLabel}>{i18nT('export:components.export.FullBookExport.yearTo')}</Text>
          <TextInput
            value={yearToText}
            onChangeText={handleYearTo}
            keyboardType="numeric"
            maxLength={4}
            editable={!controller.isFindingPeriod && !controller.isSubmitting}
            style={styles.yearInput}
            accessibilityLabel={i18nT('export:components.export.FullBookExport.yearToA11y')}
            testID="full-book-year-to"
          />
        </View>
        <UIButton
          label={i18nT('export:components.export.FullBookExport.find')}
          onPress={handleFind}
          disabled={!isPeriodValid || controller.isFindingPeriod || controller.isSubmitting || jobActive}
          loading={controller.isFindingPeriod}
          variant="outline"
          size="sm"
          testID="full-book-find"
        />
      </View>

      {!isPeriodValid ? (
        <Text style={styles.error}>
          {i18nT('export:components.export.FullBookExport.invalidPeriod', {
            value1: String(FULL_BOOK_MIN_YEAR),
            value2: String(currentYear),
          })}
        </Text>
      ) : null}
      {controller.findPeriodError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {findErrorCode === 'EMPTY_SELECTION'
            ? i18nT('export:components.export.FullBookExport.empty')
            : i18nT('export:components.export.FullBookExport.error.find')}
        </Text>
      ) : null}

      {draft ? (
        <View style={styles.foundRow}>
          <Text style={styles.found} accessibilityLiveRegion="polite" testID="full-book-found">
            {translatePlural('export:components.export.FullBookExport.found', draft.travelCount, {
              value1: periodLabel,
            })}
          </Text>
          <UIButton
            label={i18nT('export:components.export.FullBookExport.configure')}
            onPress={() => setIsSettingsOpen(true)}
            disabled={controller.isSubmitting || jobActive}
            loading={controller.isSubmitting}
            size="sm"
            icon={<Feather name="book-open" size={15} color={colors.textOnPrimary} />}
            testID="full-book-configure"
          />
        </View>
      ) : null}
      {controller.submitError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {errorCodeOf(controller.submitError) === 'REVISION_CONFLICT'
            ? i18nT('export:components.export.FullBookExport.error.revisionConflict')
            : i18nT('export:components.export.FullBookExport.error.submit')}
        </Text>
      ) : null}

      <FullBookJobStatus controller={controller} />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    panel: {
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '700',
    },
    hint: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
    },
    periodRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    yearField: {
      width: 96,
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    yearLabel: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
    },
    yearInput: {
      width: '100%',
      minHeight: 38,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
      textAlign: 'center',
    },
    foundRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    found: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
    },
    error: {
      color: colors.danger,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
    },
  });

type SectionProps = Omit<Props, 'controller'>;

// Точка входа для /export: грузится лениво только на desktop web и ничего не
// показывает, пока сервер не подтвердит готовность полного конвейера книги.
function FullBookExportSection({ baseSettings, userName }: SectionProps) {
  const controller = useFullBookExport({ enabled: true });
  if (!controller.isAvailable) return null;
  return <FullBookExportPanel controller={controller} baseSettings={baseSettings} userName={userName} />;
}

export default React.memo(FullBookExportSection);
