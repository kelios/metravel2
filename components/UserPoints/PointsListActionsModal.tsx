import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import Button from '@/components/ui/Button';

type Props = {
  styles: Record<string, any>;
  visible: boolean;
  exportError: string | null;
  isExporting: boolean;
  onClose: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenManualAdd: () => void;
  onStartSelection: () => void;
  onDeleteAll: () => void;
};

export const PointsListActionsModal: React.FC<Props> = ({
  styles,
  visible,
  exportError,
  isExporting,
  onClose,
  onImport,
  onExport,
  onOpenManualAdd,
  onStartSelection,
  onDeleteAll,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionsOverlay}>
        <Pressable
          style={styles.actionsBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть меню"
        />

        <View style={styles.actionsModal}>
          <Text style={styles.actionsTitle}>Действия</Text>

          {exportError ? <Text style={styles.manualErrorText}>{exportError}</Text> : null}

          <Button
            label="Импорт"
            onPress={onImport}
            accessibilityLabel="Импорт"
            fullWidth
            style={styles.actionsButton}
          />

          <Button
            label={isExporting ? 'Экспорт…' : 'Экспорт'}
            onPress={onExport}
            accessibilityLabel="Экспорт"
            fullWidth
            loading={isExporting}
            style={styles.actionsButton}
          />

          <Button
            label="Добавить вручную"
            onPress={onOpenManualAdd}
            accessibilityLabel="Добавить вручную"
            fullWidth
            style={styles.actionsButton}
          />

          <Button
            label="Выбрать точки"
            onPress={onStartSelection}
            accessibilityLabel="Выбрать точки"
            fullWidth
            style={styles.actionsButton}
          />

          <Button
            label="Удалить все точки"
            onPress={onDeleteAll}
            accessibilityLabel="Удалить все точки"
            fullWidth
            variant="danger"
            style={styles.actionsButton}
          />

          <Button
            label="Отмена"
            onPress={onClose}
            accessibilityLabel="Отмена"
            fullWidth
            variant="ghost"
          />
        </View>
      </View>
    </Modal>
  );
};
