import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { globalFocusStyles } from '@/styles/globalFocus'
import { translate as i18nT } from '@/i18n'
import type { BottomDockMoreMenuItem } from './bottomDockModel'
import { buildBottomDockMoreSections } from './bottomDockMoreSections'
import LanguageOptionList from './LanguageOptionList'

type MoreListStyles = {
  moreList: StyleProp<ViewStyle>
  moreListContent: StyleProp<ViewStyle>
  moreDivider: StyleProp<ViewStyle>
  moreItem: StyleProp<ViewStyle>
  moreItemText: StyleProp<TextStyle>
}

type Props = {
  styles: MoreListStyles
  iconColor: string
  /** Ролевые пункты аккаунта в листе (#2152) — из общей модели меню аккаунта. */
  isSuperuser?: boolean
  /** Какие пункты показывает эта ветка листа (web / native Modal / Gorhom). */
  itemFilter: (item: BottomDockMoreMenuItem) => boolean
  /** Рендер пункта-перехода; `openLanguage` — для пункта-действия «Язык интерфейса». */
  renderItem: (item: BottomDockMoreMenuItem, openLanguage: () => void) => React.ReactNode
  /** Закрыть лист «Ещё» целиком (после выбора языка). */
  onClose: () => void
  testID?: string
}

/**
 * Содержимое листа «Ещё» — одно для трёх веток (web, native Modal, Gorhom).
 * «Язык интерфейса» (#2100) открывается подэкраном ВНУТРИ этого же листа: второй
 * Modal поверх закрывающегося на iOS UIKit не показывает (Fabric
 * `RCTModalHostViewComponentView` не ждёт закрытия первого).
 */
function BottomDockMoreList({ styles, iconColor, isSuperuser, itemFilter, renderItem, onClose, testID }: Props) {
  const [view, setView] = useState<'menu' | 'language'>('menu')
  const openLanguage = useCallback(() => setView('language'), [])
  const handleLanguageChosen = useCallback(() => {
    setView('menu')
    onClose()
  }, [onClose])

  return (
    <ScrollView
      testID={testID}
      style={styles.moreList}
      contentContainerStyle={styles.moreListContent}
      keyboardShouldPersistTaps="handled"
    >
      {view === 'language' ? (
        <>
          <Pressable
            onPress={() => setView('menu')}
            style={[styles.moreItem, globalFocusStyles.focusable]}
            accessibilityRole="button"
            accessibilityLabel={i18nT('navigation:components.layout.HeaderContextBar.nazad_ffc60b96')}
            testID="footer-more-language-back"
          >
            <Feather name="chevron-left" size={18} color={iconColor} />
            <Text style={styles.moreItemText}>{i18nT('common:language.settingTitle')}</Text>
          </Pressable>
          <LanguageOptionList onChosen={handleLanguageChosen} testIDPrefix="more-language-option" />
        </>
      ) : (
        buildBottomDockMoreSections({ isSuperuser })
          .map((section) => ({ key: section.key, items: section.items.filter(itemFilter) }))
          .filter((section) => section.items.length > 0)
          .map((section, sectionIndex, sections) => (
            <React.Fragment key={section.key}>
              {section.items.map((item) => renderItem(item, openLanguage))}
              {sectionIndex < sections.length - 1 ? <View style={styles.moreDivider} /> : null}
            </React.Fragment>
          ))
      )}
    </ScrollView>
  )
}

export default React.memo(BottomDockMoreList)
