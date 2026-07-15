import { Platform, View, type StyleProp, type ViewStyle } from 'react-native'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SidebarFilters from '../SidebarFilters'
import RightColumn from '../RightColumn'
import { translate as i18nT } from '@/i18n'


type SidebarFiltersProps = React.ComponentProps<typeof SidebarFilters>
type RightColumnProps = React.ComponentProps<typeof RightColumn>

type ListTravelLayoutProps = {
  rootStyle: StyleProp<ViewStyle>
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
    | 'isMeTravel'
    | 'setSearch'
    | 'resetFilters'
    | 'isVisible'
    | 'isLoading'
    | 'isError'
    | 'onRetry'
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
          title={i18nT('travel:components.listTravel.parts.ListTravelLayout.udalit_puteshestvie_10878612')}
          message={deleteError ?? i18nT('travel:components.listTravel.parts.ListTravelLayout.deleteIrreversible')}
          confirmText={i18nT('travel:components.listTravel.parts.ListTravelLayout.udalit_306481cb')}
          cancelText={i18nT('travel:components.listTravel.parts.ListTravelLayout.otmena_19a369ba')}
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
