import React from 'react';
import { Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { PointsListStyles } from './PointsList';

type BulkProgress = {
  current: number;
  total: number;
} | null;

type PointsListBulkMapBarProps = {
  styles: PointsListStyles;
  isWideScreenWeb: boolean;
  bulkProgress: BulkProgress;
  selectedCount: number;
  isBulkWorking: boolean;
  onBackToList: () => void;
  onClearSelection: () => void;
  onOpenBulkEdit: () => void;
  onOpenDeleteSelected: () => void;
  onDone: () => void;
};

export const PointsListBulkMapBar: React.FC<PointsListBulkMapBarProps> = ({
  styles,
  isWideScreenWeb,
  bulkProgress,
  selectedCount,
  isBulkWorking,
  onBackToList,
  onClearSelection,
  onOpenBulkEdit,
  onOpenDeleteSelected,
  onDone,
}) => {
  return (
    <View
      style={[
        styles.bulkMapBar,
        isWideScreenWeb ? { right: 420 + DESIGN_TOKENS.spacing.lg } : null,
      ]}
    >
      <View style={styles.bulkMapBarRow}>
        <Text style={styles.bulkMapBarText}>
          {bulkProgress
            ? `Удаляем: ${bulkProgress.current}/${bulkProgress.total}`
            : selectedCount > 0
              ? `Выбрано: ${selectedCount}`
              : 'Выберите точки в списке'}
        </Text>
        <View style={styles.bulkMapBarActions}>
          <Button
            label="Список"
            onPress={onBackToList}
            disabled={isBulkWorking}
            size="sm"
            variant="secondary"
            accessibilityLabel="Назад к списку"
          />

          {selectedCount > 0 ? (
            <>
              <Button
                label="Снять"
                onPress={onClearSelection}
                disabled={isBulkWorking}
                size="sm"
                variant="secondary"
                accessibilityLabel="Снять"
              />
              <Button
                label="Изменить"
                onPress={onOpenBulkEdit}
                disabled={isBulkWorking}
                size="sm"
                accessibilityLabel="Изменить"
              />
              <Button
                label="Удалить"
                onPress={onOpenDeleteSelected}
                disabled={isBulkWorking}
                size="sm"
                variant="danger"
                accessibilityLabel="Удалить выбранные"
              />
            </>
          ) : null}

          <Button
            label="Готово"
            onPress={onDone}
            disabled={isBulkWorking}
            size="sm"
            variant="secondary"
            accessibilityLabel="Готово"
          />
        </View>
      </View>
    </View>
  );
};
