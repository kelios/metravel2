// components/quests/QuestTrustBar.tsx
// Метаданные маршрута и раскрытие об ИИ на стартовом экране квеста (#1480).
//
// До этого знакомство с квестом начиналось с рамки-предупреждения на восемь
// строк: «сведения могут содержать неточности». Раскрытие обязательно и
// остаётся, но здесь оно свёрнуто в одну строку и стоит рядом с проверяемыми
// фактами о маршруте — число точек, длина, сверка точек с картой. Развёрнутый
// текст тот же самый (ключ `QuestWizard.aiDisclosure`), плюс кнопка отчёта:
// риск превращается в канал правок, а не в дисклеймер вместо приветствия.
//
// Длины маршрута здесь намеренно нет: точную даёт только маршрутизация, а её
// на стартовом экране никто не делает. Сумма прямых между точками занижает
// путь примерно на треть и на десктопе стояла бы рядом с панелью карты, где
// уже написано «Пеший маршрут готов: 4,5 км» — два разных числа об одном
// маршруте доверие не поднимают.
//
// Свой раскрывающийся ряд, а не `components/ui/CollapsibleBlock`: тот рисует
// карточку с рамкой, иконкой в плашке, кнопкой скрытия и отступом снизу —
// ровно тот вес, от которого страница здесь и избавляется.
import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import QuestInaccuracyReportModal from './QuestInaccuracyReportModal'
import { notifyQuest } from './questWizardHelpers'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'
import type { QuestCountModel } from '@/utils/questCountModel'

const { spacing, radii } = DESIGN_TOKENS

type Props = {
  /** Число настоящих точек маршрута (без intro). */
  pointsCount?: number
  /** Canonical detail count model; `pointsCount` remains a test/legacy fallback. */
  countModel?: QuestCountModel
  questTitle: string
  questId?: string
  cityId?: string
}

type FactProps = {
  styles: ReturnType<typeof createStyles>
  icon: React.ComponentProps<typeof Feather>['name']
  color: string
  text: string
}

function QuestTrustFact({ styles, icon, color, text }: FactProps) {
  return (
    <View style={styles.fact}>
      <Feather name={icon} size={13} color={color} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  )
}

function QuestTrustBar({ pointsCount = 0, countModel, questTitle, questId, cityId }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [expanded, setExpanded] = useState(false)
  const [reportVisible, setReportVisible] = useState(false)

  const toggle = useCallback(() => setExpanded((prev) => !prev), [])
  const openReport = useCallback(() => setReportVisible(true), [])
  const closeReport = useCallback(() => setReportVisible(false), [])
  const handleSent = useCallback(() => {
    notifyQuest(i18nT('quests:components.quests.QuestTrustBar.reportSent'))
  }, [])

  return (
    <View style={styles.container} testID="quest-trust-bar">
      <View style={styles.facts}>
        {countModel?.source === 'explicit' ? (
          <QuestTrustFact
            styles={styles}
            icon="list"
            color={colors.brandText}
            text={i18nT('quests:components.quests.questWizardShell.countBreakdown', {
              total: countModel.total,
              required: countModel.required,
              optional: countModel.optional,
              start: countModel.start,
              final: countModel.final,
            })}
          />
        ) : (
          <QuestTrustFact
            styles={styles}
            icon="map-pin"
            color={colors.brandText}
            text={i18nT('quests:components.quests.QuestTrustBar.pointsCount', {
              count: countModel?.total ?? pointsCount,
            })}
          />
        )}
        <QuestTrustFact
          styles={styles}
          icon="check-circle"
          color={colors.success}
          text={i18nT('quests:components.quests.QuestTrustBar.geoVerified')}
        />
      </View>

      <Pressable
        onPress={toggle}
        style={styles.disclosureToggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded
            ? i18nT('quests:components.quests.QuestTrustBar.aiCollapse')
            : i18nT('quests:components.quests.QuestTrustBar.aiExpand')
        }
        testID="quest-ai-disclosure-toggle"
      >
        <Feather name="info" size={13} color={colors.textMuted} />
        <Text style={styles.disclosureShort}>
          {i18nT('quests:components.quests.QuestTrustBar.aiShort')}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </Pressable>

      {expanded ? (
        <View style={styles.disclosureBody} testID="quest-ai-disclosure">
          <Text style={styles.disclosureText}>
            {i18nT('quests:components.quests.QuestWizard.aiDisclosure')}
          </Text>
          <Button
            label={i18nT('quests:components.quests.QuestTrustBar.reportInaccuracy')}
            onPress={openReport}
            variant="outline"
            size="sm"
            icon={<Feather name="flag" size={14} color={colors.primaryText} />}
            testID="quest-report-inaccuracy"
          />
        </View>
      ) : null}

      {/* Монтируем только по нажатию: стартовый экран квеста не должен платить
          формой, которую большинство игроков никогда не откроет. */}
      {reportVisible ? (
        <QuestInaccuracyReportModal
          visible
          onClose={closeReport}
          onSent={handleSent}
          questTitle={questTitle}
          questId={questId}
          cityId={cityId}
        />
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      // Внешний отступ даёт обёртка `styles.section` карточки шага — свой
      // marginBottom здесь только раздваивал бы зазор до истории квеста.
      gap: spacing.xs,
    },
    facts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    fact: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: '100%',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    factText: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    disclosureToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      paddingRight: spacing.xs,
      // Строка-раскрытие — полноценный таргет: гард считает объявленную высоту,
      // а не то, что даст padding вокруг 13px текста.
      minHeight: Platform.OS === 'android' ? 48 : 44,
    },
    disclosureShort: {
      fontSize: 12,
      color: colors.textMuted,
      textDecorationLine: 'underline',
    },
    disclosureBody: {
      gap: spacing.sm,
      alignItems: 'flex-start',
      padding: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    disclosureText: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
  })

export default QuestTrustBar
