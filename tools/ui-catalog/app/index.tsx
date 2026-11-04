import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import CatalogFilterPanel from '@/components/layout/CatalogFilterPanel'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import EmptyState from '@/components/ui/EmptyState'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import IconButton from '@/components/ui/IconButton'
import LinkPressable from '@/components/ui/LinkPressable'
import NavigationLink from '@/components/ui/NavigationLink'
import { SectionSkeleton } from '@/components/ui/SectionSkeleton'
import { Body, Caption, Heading } from '@/components/ui/Typography'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { METRICS } from '@/constants/layout'
import { useTheme, useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'

export default function CatalogScreen() {
  const { example } = useLocalSearchParams<{ example?: string }>()
  const { isDark, setTheme } = useTheme()
  const colors = useThemedColors()
  const [narrow, setNarrow] = useState(false)
  const [selected, setSelected] = useState(true)
  const [retried, setRetried] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Heading level={1}>Каталог компонентов MeTravel</Heading>
      <Body muted>Примеры используют компоненты сайта и локальные данные.</Body>
      <View style={styles.row}>
        <Chip label="Светлая тема" selected={!isDark} onPress={() => setTheme('light')} />
        <Chip label="Тёмная тема" selected={isDark} onPress={() => setTheme('dark')} />
        <Chip label="Узкая колонка" selected={narrow} onPress={() => setNarrow(!narrow)} />
      </View>
      <View style={[styles.examples, narrow && styles.narrow]}>
        <Heading level={2}>Кнопки и фильтры</Heading>
        <View style={styles.row}>
          <Button label="Сохранить" onPress={() => setSelected(true)} />
          <Button label="Сбросить выбранные фильтры" variant="secondary" onPress={() => setSelected(false)} />
          <Button label="Удалить" variant="danger" disabled />
          <Button label="Загрузка" variant="outline" loading />
          <IconButton
            label="Отметить как избранное"
            icon={<Feather name="heart" size={20} color={colors.primaryText} />}
            active={selected}
            onPress={() => setSelected(!selected)}
          />
          <Chip label="Выбранный фильтр" selected={selected} onPress={() => setSelected(!selected)} />
        </View>

        <Heading level={2}>Ссылки</Heading>
        <LinkPressable
          href={{ pathname: '/', params: { example: 'links' } }}
          style={[styles.link, globalFocusStyles.focusable]}
        >
          <Body style={{ color: colors.primaryText, textDecorationLine: 'underline' }}>
            Открыть пример ссылки
          </Body>
        </LinkPressable>
        <NavigationLink
          href={{ pathname: '/', params: { example: 'links' } }}
          selected={example === 'links'}
          style={styles.navigation}
        >
          <Body>Пункт навигации</Body>
        </NavigationLink>
        <Caption>{example === 'links' ? 'Пример открыт' : 'Ссылка ожидает перехода'}</Caption>

        <Heading level={2}>Панель фильтров</Heading>
        <Button label="Открыть фильтры" onPress={() => setFiltersOpen(true)} />
        {filtersOpen ? (
          <CatalogFilterPanel title="Фильтры" overlay onClose={() => setFiltersOpen(false)}>
            <Chip label="Места рядом" selected={selected} onPress={() => setSelected(!selected)} />
          </CatalogFilterPanel>
        ) : null}

        <Heading level={2}>Карточка</Heading>
        <View style={styles.card}>
          <UnifiedTravelCard title="Маршрут выходного дня" metaText="Окрестности Минска" onPress={() => setSelected(true)} />
        </View>

        <Heading level={2}>Загрузка, пустота и ошибка</Heading>
        <SectionSkeleton />
        <EmptyState title="По вашему запросу ничего не найдено" icon="search" density="compact" />
        {retried ? (
          <Body>Повтор выполнен</Body>
        ) : (
          <ErrorDisplay title="Не удалось загрузить пример" message="Проверьте повтор действия." onRetry={() => setRetried(true)} showContact={false} />
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    padding: METRICS.spacing.m,
    gap: METRICS.spacing.m,
    width: '100%',
    maxWidth: METRICS.containers.lg,
    alignSelf: 'center',
  },
  examples: { width: '100%', gap: METRICS.spacing.m },
  narrow: { maxWidth: 320 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: METRICS.spacing.s, alignItems: 'flex-start' },
  navigation: { minHeight: 44, justifyContent: 'center', paddingHorizontal: METRICS.spacing.s },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  card: { maxWidth: METRICS.breakpoints.phone },
})
