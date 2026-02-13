import React, { memo, useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import UIButton from '@/components/ui/Button';
import ProgressIndicator from '@/components/ui/ProgressIndicator';
import { createStyles } from './listTravelStyles';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize';

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
        <Text style={resolvedStyles.exportBarInfoSubtitle as any}>
          {hasSelection ? `Настройки: ${settingsSummary}` : 'Выберите хотя бы одно путешествие, чтобы включить кнопки'}
        </Text>
        <View style={resolvedStyles.exportBarInfoActions}>
          <Pressable onPress={onToggleSelectAll} accessibilityRole="button">
            <Text style={resolvedStyles.linkButton as any}>
              {selectedCount === allCount && allCount > 0 ? 'Снять выделение' : 'Выбрать все'}
            </Text>
          </Pressable>
          {hasSelection && (
            <Pressable onPress={onClearSelection} accessibilityRole="button">
              <Text style={resolvedStyles.linkButton as any}>Очистить выбор</Text>
            </Pressable>
          )}
          {hasSelection && (
            <Pressable onPress={onSettings} accessibilityRole="button">
              <Text style={resolvedStyles.linkButton as any}>Настройки</Text>
            </Pressable>
          )}
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
