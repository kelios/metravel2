// #2357 F2: статус серверной полной книги — этап, реальные счётчики и действия.
// Процент и ETA не выдумываются: полоса появляется только там, где сервер знает
// ожидаемое число (expected), иначе показывается только сделанное.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { BookExportV2Counter, BookExportV2Job, BookExportV2JobStatus } from '@/api/bookExportApi';
import UIButton from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  isFullBookJobActive,
  isFullBookJobDownloadable,
  type FullBookExportController,
} from '@/hooks/useFullBookExport';
import { useThemedColors } from '@/hooks/useTheme';
import { formatDateTime, formatInteger, translate as i18nT } from '@/i18n';
import { formatFileSize } from '@/utils/fileSize';

const statusLabel = (status: BookExportV2JobStatus): string => {
  switch (status) {
    case 'queued':
      return i18nT('export:components.export.FullBookExport.status.queued');
    case 'running':
      return i18nT('export:components.export.FullBookExport.status.running');
    case 'retry_wait':
      return i18nT('export:components.export.FullBookExport.status.retryWait');
    case 'cancel_requested':
      return i18nT('export:components.export.FullBookExport.status.cancelRequested');
    case 'cancelled':
      return i18nT('export:components.export.FullBookExport.status.cancelled');
    case 'done':
      return i18nT('export:components.export.FullBookExport.status.done');
    case 'failed':
      return i18nT('export:components.export.FullBookExport.status.failed');
    case 'expired':
      return i18nT('export:components.export.FullBookExport.status.expired');
    default:
      return i18nT('export:components.export.FullBookExport.stage.unknown');
  }
};

const stageLabel = (stage: string): string => {
  switch (stage) {
    case 'queued':
      return i18nT('export:components.export.FullBookExport.stage.queued');
    case 'snapshot':
      return i18nT('export:components.export.FullBookExport.stage.snapshot');
    case 'awaiting_renderer':
      return i18nT('export:components.export.FullBookExport.stage.awaitingRenderer');
    case 'render':
      return i18nT('export:components.export.FullBookExport.stage.render');
    case 'merge':
      return i18nT('export:components.export.FullBookExport.stage.merge');
    case 'verify':
      return i18nT('export:components.export.FullBookExport.stage.verify');
    case 'done':
      return i18nT('export:components.export.FullBookExport.stage.done');
    default:
      return i18nT('export:components.export.FullBookExport.stage.unknown');
  }
};

const failureHint = (job: BookExportV2Job): string => {
  switch (job.error_code) {
    case 'TRAVEL_ACCESS_DENIED':
      return i18nT('export:components.export.FullBookExport.error.accessDenied');
    case 'REVISION_CONFLICT':
      return i18nT('export:components.export.FullBookExport.error.revisionConflict');
    case 'REBUILD_REQUIRED':
      return i18nT('export:components.export.FullBookExport.error.rebuildRequired');
    default:
      return i18nT('export:components.export.FullBookExport.error.failed');
  }
};

const formatCounter = (counter: BookExportV2Counter): string =>
  counter.expected === null
    ? formatInteger(counter.completed)
    : i18nT('export:components.export.FullBookExport.counterOf', {
        value1: formatInteger(counter.completed),
        value2: formatInteger(counter.expected),
      });

// Полоса — только по известному ожидаемому числу текущего этапа.
const progressCounter = (job: BookExportV2Job): BookExportV2Counter | null => {
  const counter = job.stage === 'snapshot' ? job.counters.travels : job.stage === 'render' ? job.counters.pages : null;
  if (!counter || counter.expected === null || counter.expected <= 0) return null;
  return counter;
};

type Props = {
  controller: FullBookExportController;
};

function FullBookJobStatus({ controller }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { job } = controller;

  if (controller.isJobMissing) {
    return (
      <View style={styles.actions}>
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {i18nT('export:components.export.FullBookExport.jobMissing')}
        </Text>
        <UIButton
          label={i18nT('export:components.export.FullBookExport.dismiss')}
          onPress={controller.dismiss}
          variant="ghost"
          size="sm"
        />
      </View>
    );
  }
  if (!job) return controller.isObservingJob ? (
    <Text style={styles.hint} accessibilityLiveRegion="polite">
      {i18nT(controller.isReconnecting
        ? 'export:components.export.FullBookExport.error.observe'
        : 'export:app.tabs.export.zagruzka_7f1a74fb')}
    </Text>
  ) : null;

  const active = isFullBookJobActive(job);
  const downloadable = isFullBookJobDownloadable(job);
  const progress = active ? progressCounter(job) : null;
  const ratio = progress ? Math.min(1, progress.completed / (progress.expected as number)) : 0;
  const actionError = controller.cancelError || controller.retryError;
  const iconName = downloadable ? 'check-circle' : job.status === 'failed' ? 'alert-circle' : active ? 'loader' : 'info';
  const iconColor = downloadable ? colors.success : job.status === 'failed' ? colors.danger : colors.textMuted;
  const sizeBytes = job.download?.size_bytes ?? null;

  return (
    <View style={styles.card} accessibilityLabel={i18nT('export:components.export.FullBookExport.statusRegion')}>
      <View style={styles.headerRow}>
        <Feather name={iconName} size={16} color={iconColor} />
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {active
            ? i18nT('export:components.export.FullBookExport.statusWithStage', {
                value1: statusLabel(job.status),
                value2: stageLabel(job.stage),
              })
            : statusLabel(job.status)}
        </Text>
      </View>

      {progress ? (
        <View
          style={styles.track}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: progress.expected as number, now: progress.completed }}
        >
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      ) : null}

      <View style={styles.counters}>
        <Text style={styles.counter}>
          {i18nT('export:components.export.FullBookExport.counter.travels', { value1: formatCounter(job.counters.travels) })}
        </Text>
        <Text style={styles.counter}>
          {i18nT('export:components.export.FullBookExport.counter.photos', {
            value1: formatCounter(job.counters.mediaOccurrences),
          })}
        </Text>
        {job.counters.pages.completed > 0 || job.counters.pages.expected !== null ? (
          <Text style={styles.counter}>
            {i18nT('export:components.export.FullBookExport.counter.pages', { value1: formatCounter(job.counters.pages) })}
          </Text>
        ) : null}
      </View>

      {controller.isReconnecting ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {i18nT('export:components.export.FullBookExport.reconnecting')}
        </Text>
      ) : null}
      {job.status === 'failed' ? <Text style={styles.error}>{failureHint(job)}</Text> : null}
      {job.status === 'expired' ? (
        <Text style={styles.hint}>{i18nT('export:components.export.FullBookExport.expiredHint')}</Text>
      ) : null}
      {downloadable && job.expires_at ? (
        <Text style={styles.hint}>
          {sizeBytes !== null
            ? i18nT('export:components.export.FullBookExport.readyMeta', {
                value1: formatFileSize(sizeBytes),
                value2: formatDateTime(job.expires_at),
              })
            : i18nT('export:components.export.FullBookExport.readyUntil', { value1: formatDateTime(job.expires_at) })}
        </Text>
      ) : null}
      {actionError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {i18nT('export:components.export.FullBookExport.error.action')}
        </Text>
      ) : null}
      {controller.downloadError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {i18nT('export:components.export.FullBookExport.error.download')}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {downloadable ? (
          <UIButton
            label={i18nT('export:components.export.FullBookExport.download')}
            onPress={controller.download}
            loading={controller.isDownloading}
            disabled={controller.isDownloading}
            size="sm"
            icon={<Feather name="download" size={15} color={colors.textOnPrimary} />}
          />
        ) : null}
        {active ? (
          <UIButton
            label={i18nT('export:components.export.FullBookExport.cancel')}
            onPress={controller.cancel}
            loading={controller.isCancelling}
            disabled={controller.isCancelling || job.status === 'cancel_requested'}
            variant="outline"
            size="sm"
          />
        ) : null}
        {job.status === 'failed' && job.retryable ? (
          <UIButton
            label={i18nT('export:components.export.FullBookExport.retry')}
            onPress={controller.retry}
            loading={controller.isRetrying}
            disabled={controller.isRetrying}
            variant="outline"
            size="sm"
          />
        ) : null}
        {!active ? (
          <UIButton
            label={i18nT('export:components.export.FullBookExport.dismiss')}
            onPress={controller.dismiss}
            variant="ghost"
            size="sm"
          />
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    status: {
      flexShrink: 1,
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
    },
    track: {
      height: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primary,
    },
    counters: {
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    counter: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
    },
    hint: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
    },
    error: {
      color: colors.danger,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
  });

export default React.memo(FullBookJobStatus);
