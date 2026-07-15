import React from 'react';
import { Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { PointsListStyles } from './types';
import { translate as i18nT } from '@/i18n'


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
            ? i18nT('map:components.UserPoints.PointsListBulkMapBar.udalyaem_value1_value2_aef51245', { value1: bulkProgress.current, value2: bulkProgress.total })
            : selectedCount > 0
              ? i18nT('map:components.UserPoints.PointsListBulkMapBar.vybrano_value1_dc022d4b', { value1: selectedCount })
              : i18nT('map:components.UserPoints.PointsListBulkMapBar.vyberite_tochki_v_spiske_d2006efc')}
        </Text>
        <View style={styles.bulkMapBarActions}>
          <Button
            label={i18nT('map:components.UserPoints.PointsListBulkMapBar.spisok_41c8b9c5')}
            onPress={onBackToList}
            disabled={isBulkWorking}
            size="sm"
            variant="secondary"
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkMapBar.nazad_k_spisku_a72b9334')}
          />

          {selectedCount > 0 ? (
            <>
              <Button
                label={i18nT('map:components.UserPoints.PointsListBulkMapBar.snyat_575b693f')}
                onPress={onClearSelection}
                disabled={isBulkWorking}
                size="sm"
                variant="secondary"
                accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkMapBar.snyat_575b693f')}
              />
              <Button
                label={i18nT('map:components.UserPoints.PointsListBulkMapBar.izmenit_d066c372')}
                onPress={onOpenBulkEdit}
                disabled={isBulkWorking}
                size="sm"
                accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkMapBar.izmenit_d066c372')}
              />
              <Button
                label={i18nT('map:components.UserPoints.PointsListBulkMapBar.udalit_b55d2000')}
                onPress={onOpenDeleteSelected}
                disabled={isBulkWorking}
                size="sm"
                variant="danger"
                accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkMapBar.udalit_vybrannye_c4749ebe')}
              />
            </>
          ) : null}

          <Button
            label={i18nT('map:components.UserPoints.PointsListBulkMapBar.gotovo_e773b749')}
            onPress={onDone}
            disabled={isBulkWorking}
            size="sm"
            variant="secondary"
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkMapBar.gotovo_e773b749')}
          />
        </View>
      </View>
    </View>
  );
};
