import React from 'react'
import { View } from 'react-native'
import EmptyState from '@/components/ui/EmptyState'
import { translate as i18nT } from '@/i18n'
import type { getStyles } from '@/screens/tabs/QuestsScreen.styles'

type Props = {
  styles: ReturnType<typeof getStyles>
  onRetry: () => void
  /** Повтор уже идёт: кнопка показывает загрузку, а не кажется мёртвой (офлайн запрос ждёт сеть). */
  retrying?: boolean
}

/**
 * Каталог квестов не загрузился (обрыв сети, 5xx): лендинг города или страны не
 * может решить, есть ли такой адрес, и честно говорит об ошибке с повтором вместо
 * «Такого квеста нет» (#2914). Вид — тот же `EmptyState` ошибки, что у каталога
 * путешествий; ленивый чанк, как и экран «не найдено», чтобы не утяжелять маршрут.
 * Head страницы не трогаем: временный сбой — не повод закрывать адрес от индекса.
 */
export default function QuestLandingLoadError({ styles, onRetry, retrying = false }: Props) {
  return (
    <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]} testID="quest-landing-load-error">
      <EmptyState
        density="full"
        icon="wifi-off"
        title={i18nT('quests:components.quests.QuestLandingLoadError.title')}
        description={i18nT('quests:components.quests.QuestLandingLoadError.description')}
        variant="error"
        action={{
          label: i18nT('quests:components.quests.QuestLandingLoadError.retry'),
          icon: 'refresh-cw',
          onPress: onRetry,
          loading: retrying,
          disabled: retrying,
          testID: 'quest-landing-load-error-retry',
        }}
      />
    </View>
  )
}
