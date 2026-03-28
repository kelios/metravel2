import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import UIButton from '@/components/ui/Button';
import ProgressIndicator from '@/components/ui/ProgressIndicator';
import { createStyles } from './listTravelStyles';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize';

function WebTextButton({
  label,
  onPress,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: any;
}) {
  const isWeb = Platform.OS === 'web';
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!isWeb) return;

    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;

    const handleActivate = (event: Event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      onPress();
    };

    node.addEventListener('click', handleActivate);
    node.addEventListener('touchend', handleActivate, { passive: false });

    return () => {
      node.removeEventListener('click', handleActivate);
      node.removeEventListener('touchend', handleActivate);
    };
  }, [isWeb, onPress]);

  if (Platform.OS !== 'web') {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
        <Text style={style}>{label}</Text>
      </Pressable>
    );
  }

  return React.createElement(
    'div',
    {
      ref,
      role: 'button',
      tabIndex: 0,
      'aria-label': accessibilityLabel ?? label,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        onPress();
      },
      style: { cursor: 'pointer' },
    },
    <Text style={style}>{label}</Text>,
  );
}

export const ExportBar = memo(function ExportBar({
  isMobile,
  selectedCount,
  allCount,
  onToggleSelectAll,
  onClearSelection,
  onSave,
  onSettings,
  isGenerating,
  progress,
  settingsSummary,
  hasSelection,
  styles,
}: {
  isMobile: boolean;
  selectedCount: number;
  allCount: number;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onSave: () => void;
  onSettings: () => void;
  isGenerating?: boolean;
  progress?: number;
  settingsSummary: string;
  hasSelection: boolean;
  styles?: ReturnType<typeof createStyles>;
}) {
  const colors = useThemedColors();
  const resolvedStyles = useMemo(() => styles ?? createStyles(colors), [colors, styles]);
  const selectionText = selectedCount
    ? `Выбрано ${selectedCount} ${getTravelLabel(selectedCount)}`
    : 'Выберите путешествия для экспорта';

  return (
    <View
      style={[
        resolvedStyles.exportBar,
        isMobile && resolvedStyles.exportBarMobile,
        Platform.OS === 'web' && isMobile && resolvedStyles.exportBarMobileWeb,
      ]}
    >
      <View style={resolvedStyles.exportBarInfo}>
        <Text style={resolvedStyles.exportBarInfoTitle as any}>{selectionText}</Text>
        <View style={resolvedStyles.exportBarMetaRow}>
          <Text style={resolvedStyles.exportBarInfoSubtitle as any}>
            {hasSelection ? `Настройки: ${settingsSummary}` : 'Выберите хотя бы одно путешествие, чтобы включить кнопки'}
          </Text>
          <View style={resolvedStyles.exportBarInfoActions}>
            <WebTextButton
              label={selectedCount === allCount && allCount > 0 ? 'Снять выделение' : 'Выбрать все'}
              onPress={onToggleSelectAll}
              accessibilityLabel={selectedCount === allCount && allCount > 0 ? 'Снять выделение' : 'Выбрать все'}
              style={resolvedStyles.linkButton as any}
            />
            {hasSelection && (
              <WebTextButton
                label="Очистить выбор"
                onPress={onClearSelection}
                accessibilityLabel="Очистить выбор"
                style={resolvedStyles.linkButton as any}
              />
            )}
            {hasSelection && (
              <WebTextButton
                label="Настройки"
                onPress={onSettings}
                accessibilityLabel="Настройки экспорта"
                style={resolvedStyles.linkButton as any}
              />
            )}
          </View>
        </View>
      </View>

      <View style={[resolvedStyles.exportBarButtons, isMobile && resolvedStyles.exportBarButtonsMobile]}>
        <UIButton
          label={isGenerating ? `Генерация... ${progress || 0}%` : 'Сохранить PDF'}
          onPress={onSave}
          disabled={!hasSelection || isGenerating}
        />
      </View>

      {isGenerating && Platform.OS === 'web' && (
        <View style={resolvedStyles.progressWrapper}>
          <ProgressIndicator
            progress={progress ?? 0}
            stage={
              (progress ?? 0) < 30
                ? 'Подготовка данных...'
                : (progress ?? 0) < 60
                  ? 'Генерация содержимого...'
                  : (progress ?? 0) < 90
                    ? 'Обработка изображений...'
                    : 'Создание PDF...'
            }
            message={
              (progress ?? 0) < 30
                ? 'Проверка выбранных путешествий'
                : (progress ?? 0) < 60
                  ? 'Формирование макета'
                  : (progress ?? 0) < 90
                    ? 'Оптимизация изображений'
                    : 'Финальная обработка'
            }
            showPercentage={true}
          />
        </View>
      )}
    </View>
  );
});
