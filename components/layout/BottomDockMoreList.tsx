import React, { Suspense, useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { globalFocusStyles } from '@/styles/globalFocus'
import { useDeferredUnreadCount } from '@/hooks/useDeferredUnreadCount'
import { translate as i18nT } from '@/i18n'
import type { BottomDockMoreMenuItem } from './bottomDockModel'
import { buildBottomDockMoreSections, type BottomDockMoreAccountState } from './bottomDockMoreSections'
import { SeasonalThemeToggleLazy, ThemeToggleLazy } from './themeTogglesLazy'
import LanguageOptionList from './LanguageOptionList'

type MoreListStyles = {
  moreList: StyleProp<ViewStyle>
  moreListContent: StyleProp<ViewStyle>
  moreDivider: StyleProp<ViewStyle>
  moreItem: StyleProp<ViewStyle>
  moreItemText: StyleProp<TextStyle>
}

type MoreListView = 'menu' | 'language' | 'theme'
type OpenView = (view: Exclude<MoreListView, 'menu'>) => void
type RenderItem = (item: BottomDockMoreMenuItem, openView: OpenView) => React.ReactNode

type SectionsProps = {
  account: BottomDockMoreAccountState
  dividerStyle: StyleProp<ViewStyle>
  renderItem: RenderItem
  openView: OpenView
}

function MoreMenuSections({ account, dividerStyle, renderItem, openView }: SectionsProps) {
  return (
    <>
      {buildBottomDockMoreSections(account).map((section, sectionIndex, sections) => (
        <React.Fragment key={section.key}>
          {section.items.map((item) => renderItem(item, openView))}
          {sectionIndex < sections.length - 1 ? <View style={dividerStyle} /> : null}
        </React.Fragment>
      ))}
    </>
  )
}

// Счётчик непрочитанных «Сообщений» читается только у вошедшего и только пока
// лист открыт (секция смонтирована): гостю запрос не нужен вовсе.
function AuthenticatedMoreMenuSections(props: SectionsProps) {
  const { count } = useDeferredUnreadCount(true, true)
  return <MoreMenuSections {...props} account={{ ...props.account, unreadCount: count }} />
}

type Props = {
  styles: MoreListStyles
  iconColor: string
  /** Состояние аккаунта: секция аккаунта и ролевые пункты (#2152, #2779). */
  account: BottomDockMoreAccountState
  /** Рендер пункта; `openView` — для пунктов-действий («Язык интерфейса», «Тема оформления»). */
  renderItem: RenderItem
  /** Закрыть лист «Ещё» целиком (после выбора языка). */
  onClose: () => void
  testID?: string
}

/**
 * Содержимое листа «Ещё» — одно для трёх веток (web, native Modal, Gorhom) и
 * единственное меню телефона (#2779): его открывают и пункт «Ещё» дока, и кнопка
 * меню шапки. «Язык интерфейса» (#2100) и «Тема оформления» открываются
 * подэкраном ВНУТРИ этого же листа: второй Modal поверх закрывающегося на iOS
 * UIKit не показывает (Fabric `RCTModalHostViewComponentView` не ждёт закрытия
 * первого).
 */
function BottomDockMoreList({ styles, iconColor, account, renderItem, onClose, testID }: Props) {
  const [view, setView] = useState<MoreListView>('menu')
  const openView = useCallback<OpenView>((next) => setView(next), [])
  const handleLanguageChosen = useCallback(() => {
    setView('menu')
    onClose()
  }, [onClose])

  const backRow = (title: string, backTestID: string) => (
    <Pressable
      onPress={() => setView('menu')}
      style={[styles.moreItem, globalFocusStyles.focusable]}
      accessibilityRole="button"
      accessibilityLabel={i18nT('navigation:components.layout.HeaderContextBar.nazad_ffc60b96')}
      testID={backTestID}
    >
      <Feather name="chevron-left" size={18} color={iconColor} />
      <Text style={styles.moreItemText}>{title}</Text>
    </Pressable>
  )

  return (
    <ScrollView
      testID={testID}
      style={styles.moreList}
      contentContainerStyle={styles.moreListContent}
      keyboardShouldPersistTaps="handled"
    >
      {view === 'language' ? (
        <>
          {backRow(i18nT('common:language.settingTitle'), 'footer-more-language-back')}
          <LanguageOptionList onChosen={handleLanguageChosen} testIDPrefix="more-language-option" />
        </>
      ) : view === 'theme' ? (
        <>
          {backRow(i18nT('navigation:components.layout.AccountMenu.tema_oformleniya_06b0d02a'), 'footer-more-theme-back')}
          <Suspense fallback={null}>
            <View style={{ gap: 10, paddingHorizontal: 4, paddingBottom: 8 }} testID="footer-more-theme-options">
              <ThemeToggleLazy compact layout="horizontal" showLabels />
              <SeasonalThemeToggleLazy compact layout="horizontal" showLabels />
            </View>
          </Suspense>
        </>
      ) : account.isAuthenticated ? (
        <AuthenticatedMoreMenuSections account={account} dividerStyle={styles.moreDivider} renderItem={renderItem} openView={openView} />
      ) : (
        <MoreMenuSections account={account} dividerStyle={styles.moreDivider} renderItem={renderItem} openView={openView} />
      )}
    </ScrollView>
  )
}

export default React.memo(BottomDockMoreList)
