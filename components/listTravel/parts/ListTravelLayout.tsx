import { Platform, View } from 'react-native'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SidebarFilters from '../SidebarFilters'
import RightColumn from '../RightColumn'

type SidebarFiltersProps = React.ComponentProps<typeof SidebarFilters>
type RightColumnProps = React.ComponentProps<typeof RightColumn>

type ListTravelLayoutProps = {
  rootStyle: any
  deleteId: number | null
  deleteError: string | null
  onConfirmDelete: () => void
  onCloseDelete: () => void
  sidebar: Pick<
    SidebarFiltersProps,
    | 'isMobile'
    | 'filterGroups'
    | 'filter'
    | 'onSelect'
    | 'total'
    | 'isSuper'
    | 'setSearch'
    | 'resetFilters'
    | 'isVisible'
    | 'isLoading'
    | 'onClose'
    | 'containerStyle'
  >
  rightColumn: RightColumnProps
}

export default function ListTravelLayout({
  rootStyle,
  deleteId,
  deleteError,
  onConfirmDelete,
  onCloseDelete,
  sidebar,
  rightColumn,
}: ListTravelLayoutProps) {
  return (
    <View style={rootStyle}>
      {/* Диалог подтверждения удаления (web) */}
      {Platform.OS === 'web' && (
        <ConfirmDialog
          visible={!!deleteId}
          title="Удалить путешествие?"
          message={deleteError ?? 'Это действие нельзя отменить.'}
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={onConfirmDelete}
          onClose={onCloseDelete}
          confirmTestID="confirm-delete-button"
          cancelTestID="cancel-delete-button"
        />
      )}
      <SidebarFilters {...sidebar} />

      <RightColumn {...rightColumn} />
    </View>
  )
}
