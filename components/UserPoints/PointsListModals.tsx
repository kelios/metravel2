import React from 'react'

import type { usePointsBulkActions } from './usePointsBulkActions'
import type { usePointsDeletePoint } from './usePointsDeletePoint'
import type { usePointsManualForm } from './usePointsManualForm'
import { PointsListActionsModal } from './PointsListActionsModal'
import { PointsListBulkModals } from './PointsListBulkModals'
import { PointsListManualModal } from './PointsListManualModal'
import type { PointsListStyles } from './types'

type Props = {
  styles: PointsListStyles
  bulk: ReturnType<typeof usePointsBulkActions>
  manual: ReturnType<typeof usePointsManualForm>
  deletion: ReturnType<typeof usePointsDeletePoint>
  manualCoordsValue: string
  categoryOptions: React.ComponentProps<typeof PointsListManualModal>['categoryOptions']
  manualColorOptions: string[]
  showActions: boolean
  onCloseActions: () => void
  exportError: string | null
  isExporting: boolean
  onExport: () => void
  onImport: () => void
  onStartSelection: () => void
  onRequestDeleteAll: () => void
}

/**
 * Модальные окна «Моих точек»: действия, массовые операции и форма точки
 * (#3135: вынесены из `PointsList`, проводка без изменений). Состояние живёт в
 * хуках `usePointsBulkActions` / `usePointsManualForm` / `usePointsDeletePoint`,
 * сюда приходят их результаты целиком.
 */
export const PointsListModals: React.FC<Props> = ({
  styles,
  bulk,
  manual,
  deletion,
  manualCoordsValue,
  categoryOptions,
  manualColorOptions,
  showActions,
  onCloseActions,
  exportError,
  isExporting,
  onExport,
  onImport,
  onStartSelection,
  onRequestDeleteAll,
}) => (
  <>
    <PointsListActionsModal
      styles={styles}
      visible={showActions}
      exportError={exportError}
      isExporting={isExporting}
      onClose={onCloseActions}
      onImport={onImport}
      onExport={onExport}
      onOpenManualAdd={manual.openManualAdd}
      onStartSelection={onStartSelection}
      onDeleteAll={onRequestDeleteAll}
    />

    <PointsListBulkModals
      styles={styles}
      pointToDelete={deletion.pointToDelete}
      onClosePointDelete={() => deletion.setPointToDelete(null)}
      onConfirmPointDelete={deletion.confirmDeletePoint}
      showBulkEdit={bulk.showBulkEdit}
      onCloseBulkEdit={() => bulk.setShowBulkEdit(false)}
      bulkStatus={bulk.bulkStatus}
      onBulkStatusChange={bulk.setBulkStatus}
      onApplyBulkEdit={bulk.applyBulkEdit}
      showConfirmDeleteSelected={bulk.showConfirmDeleteSelected}
      onCloseConfirmDeleteSelected={() => bulk.setShowConfirmDeleteSelected(false)}
      selectedCount={bulk.selectedIds.length}
      onDeleteSelected={bulk.deleteSelected}
      showConfirmDeleteAll={bulk.showConfirmDeleteAll}
      onCloseConfirmDeleteAll={() => bulk.setShowConfirmDeleteAll(false)}
      onDeleteAll={bulk.deleteAll}
      isBulkWorking={bulk.isBulkWorking}
    />

    <PointsListManualModal
      styles={styles}
      visible={manual.showManualAdd}
      editingPointId={manual.editingPointId}
      onClose={manual.closeManualAdd}
      manualName={manual.manualName}
      onChangeName={(v) => {
        manual.setManualNameTouched(true)
        manual.setManualName(v)
      }}
      manualError={manual.manualError}
      manualCoords={manualCoordsValue}
      manualLat={manual.manualLat}
      onChangeLat={(v) => {
        manual.setManualLat(v)
        manual.syncCoordsFromInputs(v, manual.manualLng)
      }}
      manualLng={manual.manualLng}
      onChangeLng={(v) => {
        manual.setManualLng(v)
        manual.syncCoordsFromInputs(manual.manualLat, v)
      }}
      categoryOptions={categoryOptions}
      manualCategoryIds={manual.manualCategoryIds}
      onChangeCategoryIds={manual.setManualCategoryIds}
      manualColorOptions={manualColorOptions}
      manualColor={manual.manualColor}
      onChangeColor={manual.setManualColor}
      isSavingManual={manual.isSavingManual}
      onSave={manual.handleSaveManual}
    />
  </>
)
