// Векторные рисованные иконки блока геймификации в гравюрно-книжной эстетике
// (как BadgeEmblem): тонкая линия на диске «состаренной бумаги».
//   • ProgressionAnimalMedallion — медальон с силуэтом животного тропы.
//   • InventoryLineIcon — мелкие линейные иконки инвентаря персонажа.
//   • MaxLevelLaurel — лавровый венок («максимальный уровень»).
//   • CharacterHeadIcon — силуэт-портрет персонажа.
// react-native-svg: работает на web и native, цвета — из палитры/токенов.

import { memo } from 'react'
import { Platform } from 'react-native'
import Svg, { Circle, G, Line, Path, Polyline } from 'react-native-svg'

import { useTheme } from '@/hooks/useTheme'
import { categoryPalette } from '@/components/achievements/badgeVisuals'
import { lineFor, paperFor } from '@/components/achievements/engravingPaper'
import type { ProgressionLineSlug } from '@/api/gamification'

// Внутренние координаты SVG — нормированный квадрат 100×100 (как в BadgeEmblem).
const VB = 100
const C = VB / 2

// Каждой тропе — своя бумажная палитра (тёплые/холодные тона из эмблем),
// чтобы животные различались тоном диска, а не только силуэтом.
const LINE_PALETTE_CATEGORY: Record<ProgressionLineSlug, string> = {
  dog: 'social', // тёплый розовый — социальная ветка
  boar: 'quests', // карта-схема, землистый — авторская
  fox: 'onboarding', // тёплая бумага — читатель
  bird: 'geo', // холодная синяя — исследователь
}

function a11yHidden() {
  return Platform.OS === 'web'
    ? ({ 'aria-hidden': true, focusable: false } as Record<string, unknown>)
    : ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      } as const)
}

// ── Силуэты животных: профиль головы тонкой линией ───────────────────────────
// Рисуются в зоне ~26..74 диска. Узнаваемость — за счёт характерных черт
// (висячее ухо собаки, клык/пятак кабана, острые уши + морда лисы, клюв птицы).

function AnimalSilhouette({
  slug,
  stroke,
}: {
  slug: ProgressionLineSlug
  stroke: string
}) {
  const common = {
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  }

  switch (slug) {
    case 'dog':
      // Профиль головы пса: округлый лоб, длинная опущенная морда с мочкой носа,
      // явно висячее ухо клином вдоль щеки. Отличие от лисы — ухо не торчит.
      return (
        <G {...common}>
          {/* лоб → переносица → длинная морда вниз к носу → нижняя челюсть → щека */}
          <Path d="M40 39 C40 30 48 26 55 29 C60 31 62 36 63 41 C70 44 78 52 82 61 C83 64 81 67 78 66 L72 63 L68 67 C65 70 60 70 57 67 C52 70 45 68 42 62 C38 55 38 47 40 39 Z" />
          {/* мочка носа на острие морды */}
          <Path d="M82 61 C83 64 81 67 78 66 L74 64" />
          <Circle cx={80} cy={62} r={2} fill={stroke} stroke="none" />
          {/* висячее ухо: клин вниз вдоль щеки */}
          <Path d="M41 39 C32 40 28 49 31 60 C34 64 40 64 43 60 C40 53 40 46 41 39 Z" />
          {/* глаз */}
          <Circle cx={54} cy={42} r={1.7} fill={stroke} stroke="none" />
        </G>
      )
    case 'boar':
      // Профиль кабана: покатый лоб, длинное рыло с плоским пятаком (две ноздри),
      // загнутый клык под рылом, торчащее ухо, щетина-загривок.
      return (
        <G {...common}>
          <Path d="M30 48 C30 38 39 32 49 32 C56 32 61 36 64 42 L72 46 L78 52 C80 54 79 57 76 57 L68 56 C66 63 59 67 51 67 C40 67 30 59 30 48 Z" />
          {/* ухо торчком */}
          <Path d="M41 34 L42 24 L51 30" />
          {/* пятак на острие рыла */}
          <Path d="M72 46 L78 52 C80 54 79 57 76 57" />
          <Line x1={74} y1={50} x2={74} y2={54} />
          {/* клык вверх под рылом */}
          <Path d="M70 58 C66 56 65 49 70 46" />
          {/* щетина на загривке */}
          <Polyline points="43,31 47,25 51,31 55,26 59,32" />
          <Circle cx={50} cy={45} r={1.7} fill={stroke} stroke="none" />
        </G>
      )
    case 'fox':
      // Профиль лисы: острые большие уши, узкая клиновидная морда, пышная скула.
      return (
        <G {...common}>
          <Path d="M36 46 C36 40 40 35 47 34 C46 41 47 47 50 50 C58 52 70 57 75 64 C70 66 60 66 53 64 C49 68 42 68 38 63 C34 57 34 51 36 46 Z" />
          {/* левое острое ухо */}
          <Path d="M36 46 L33 30 L46 39" />
          {/* правое острое ухо */}
          <Path d="M47 34 L54 22 L57 40" />
          {/* нос на острие морды */}
          <Circle cx={75} cy={63} r={1.7} fill={stroke} stroke="none" />
          <Circle cx={46} cy={45} r={1.6} fill={stroke} stroke="none" />
        </G>
      )
    case 'bird':
    default:
      // Профиль птицы (орёл/сокол): округлая голова, загнутый клюв, глаз, хохолок.
      return (
        <G {...common}>
          <Path d="M40 42 C40 33 48 28 56 30 C62 32 66 38 65 45 C70 46 74 47 76 49 C73 52 69 53 65 53 C64 60 58 65 50 65 C42 65 36 59 36 51 C36 47 38 44 40 42 Z" />
          {/* загнутый клюв */}
          <Path d="M65 45 C71 45 77 47 77 49 C77 52 72 53 68 51 C70 50 70 48 67 48" />
          {/* хохолок-перья на затылке */}
          <Polyline points="42,33 36,28 44,29" />
          {/* глаз */}
          <Circle cx={56} cy={42} r={2} fill={stroke} stroke="none" />
          {/* линия пера на крыле */}
          <Path d="M44 56 C50 60 58 60 62 56" />
        </G>
      )
  }
}

interface MedallionProps {
  slug: ProgressionLineSlug
  /** Диаметр медальона в px. */
  size?: number
}

/** Медальон тропы: силуэт животного тонкой линией на диске состаренной бумаги. */
function ProgressionAnimalMedallionInner({ slug, size = 40 }: MedallionProps) {
  const { isDark } = useTheme()
  const pal = categoryPalette(LINE_PALETTE_CATEGORY[slug])
  const paper = paperFor(pal.paper, isDark)
  const line = lineFor(pal.line, isDark)

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} {...a11yHidden()}>
      {/* диск состаренной бумаги */}
      <Circle cx={C} cy={C} r={48} fill={paper} />
      {/* внешнее кольцо-обводка */}
      <Circle cx={C} cy={C} r={46} stroke={line} strokeWidth={2} fill="none" />
      {/* внутренняя engraving-обводка */}
      <Circle cx={C} cy={C} r={41} stroke={line} strokeWidth={1} fill="none" opacity={0.55} />
      <AnimalSilhouette slug={slug} stroke={line} />
    </Svg>
  )
}

export const ProgressionAnimalMedallion = memo(ProgressionAnimalMedallionInner)

// ── Иконка персонажа: профиль-портрет в медальоне с акцентом тропы ───────────

interface CharacterHeadProps {
  /** Тропа выбранного/предлагаемого пути — задаёт тон медальона. */
  slug?: ProgressionLineSlug | null
  size?: number
  /** Цвет линии (для контраста с цветной плашкой), иначе — тон бумаги. */
  stroke?: string
  paper?: string
}

/** Портрет персонажа: голова в плаще-капюшоне тонкой линией. */
function CharacterHeadIconInner({
  slug,
  size = 44,
  stroke,
  paper,
}: CharacterHeadProps) {
  const { isDark } = useTheme()
  const pal = categoryPalette(slug ? LINE_PALETTE_CATEGORY[slug] : 'community')
  const discPaper = paper ?? paperFor(pal.paper, isDark)
  const line = stroke ?? lineFor(pal.line, isDark)
  const common = {
    stroke: line,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} {...a11yHidden()}>
      <Circle cx={C} cy={C} r={48} fill={discPaper} />
      <Circle cx={C} cy={C} r={46} stroke={line} strokeWidth={2} fill="none" />
      <G {...common}>
        {/* капюшон/плащ путешественника */}
        <Path d="M30 74 C30 56 38 44 50 44 C62 44 70 56 70 74" />
        <Path d="M30 74 C30 50 38 36 50 36 C62 36 70 50 70 74" />
        {/* голова */}
        <Circle cx={50} cy={52} r={11} />
        {/* воротник-застёжка */}
        <Path d="M44 70 C46 66 54 66 56 70" />
      </G>
    </Svg>
  )
}

export const CharacterHeadIcon = memo(CharacterHeadIconInner)

// ── Лавровый венок: «максимальный уровень» ───────────────────────────────────

interface MaxLevelProps {
  size?: number
  color: string
}

/** Лавровый венок тонкой линией — маркер достигнутого максимума. */
function MaxLevelLaurelInner({ size = 18, color }: MaxLevelProps) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} {...a11yHidden()}>
      <G {...common}>
        {/* ветви */}
        <Path d="M40 78 C26 66 26 42 40 28" />
        <Path d="M60 78 C74 66 74 42 60 28" />
        {/* листья слева */}
        <Path d="M40 40 C32 38 28 42 30 50 C36 49 40 46 40 40 Z" />
        <Path d="M38 54 C30 53 26 58 29 65 C35 63 38 60 38 54 Z" />
        <Path d="M44 68 C37 68 33 73 36 80 C42 77 45 74 44 68 Z" />
        {/* листья справа */}
        <Path d="M60 40 C68 38 72 42 70 50 C64 49 60 46 60 40 Z" />
        <Path d="M62 54 C70 53 74 58 71 65 C65 63 62 60 62 54 Z" />
        <Path d="M56 68 C63 68 67 73 64 80 C58 77 55 74 56 68 Z" />
        {/* звезда-плод сверху */}
        <Path d="M50 22 L53 30 L61 30 L55 35 L57 43 L50 38 L43 43 L45 35 L39 30 L47 30 Z" />
      </G>
    </Svg>
  )
}

export const MaxLevelLaurel = memo(MaxLevelLaurelInner)

// ── Инвентарь персонажа: мелкие линейные предметы ────────────────────────────

export type InventoryIconKey =
  | 'collar'
  | 'backpack'
  | 'compass'
  | 'map'
  | 'medals'
  | 'cape'

function InventoryGlyph({ icon, stroke }: { icon: string; stroke: string }) {
  const common = {
    stroke,
    strokeWidth: 6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  }
  switch (icon) {
    case 'collar':
      // Ошейник: замкнутое кольцо-ремешок с пряжкой сверху и висячим жетоном снизу.
      return (
        <G {...common}>
          {/* кольцо-ремешок */}
          <Circle cx={50} cy={46} r={26} />
          {/* пряжка сверху */}
          <Path d="M42 20 L42 30 L58 30 L58 20" />
          <Line x1={50} y1={20} x2={50} y2={30} />
          {/* подвес и жетон снизу */}
          <Line x1={50} y1={72} x2={50} y2={78} />
          <Circle cx={50} cy={84} r={6} />
        </G>
      )
    case 'backpack':
      // Рюкзак: корпус, клапан, лямка.
      return (
        <G {...common}>
          <Path d="M30 44 C30 30 70 30 70 44 L70 76 L30 76 Z" />
          <Path d="M40 34 C40 24 60 24 60 34" />
          <Path d="M38 44 L62 44 L62 56 L38 56 Z" />
          <Line x1={50} y1={56} x2={50} y2={64} />
        </G>
      )
    case 'compass':
      // Компас: корпус-круг и стрелка-ромб.
      return (
        <G {...common}>
          <Circle cx={50} cy={52} r={26} />
          <Path d="M50 36 L58 52 L50 68 L42 52 Z" />
          <Line x1={50} y1={20} x2={50} y2={26} />
        </G>
      )
    case 'map':
      // Карта: сложенный лист с пунктиром-маршрутом.
      return (
        <G {...common}>
          <Path d="M24 32 L42 38 L58 32 L76 38 L76 72 L58 66 L42 72 L24 66 Z" />
          <Line x1={42} y1={38} x2={42} y2={72} />
          <Line x1={58} y1={32} x2={58} y2={66} />
        </G>
      )
    case 'medals':
      // Медаль: лента и диск-звезда.
      return (
        <G {...common}>
          <Path d="M40 24 L48 50" />
          <Path d="M60 24 L52 50" />
          <Circle cx={50} cy={62} r={16} />
          <Path d="M50 52 L53 60 L61 60 L55 65 L57 72 L50 68 L43 72 L45 65 L39 60 L47 60 Z" />
        </G>
      )
    case 'cape':
    default:
      // Плащ: воротник-застёжка и развевающаяся ткань.
      return (
        <G {...common}>
          <Path d="M38 28 C44 34 56 34 62 28" />
          <Path d="M38 28 C26 44 24 64 30 78 C40 70 60 70 70 78 C76 64 74 44 62 28" />
          <Circle cx={50} cy={32} r={3} fill={stroke} stroke="none" />
        </G>
      )
  }
}

interface InventoryIconProps {
  icon: InventoryIconKey
  size?: number
  color: string
}

/** Мелкая линейная иконка инвентаря персонажа в едином гравюрном стиле. */
function InventoryLineIconInner({ icon, size = 16, color }: InventoryIconProps) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`} {...a11yHidden()}>
      <InventoryGlyph icon={icon} stroke={color} />
    </Svg>
  )
}

export const InventoryLineIcon = memo(InventoryLineIconInner)
