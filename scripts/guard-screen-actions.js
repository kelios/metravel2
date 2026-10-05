#!/usr/bin/env node
// #2101: guard действий экрана деталей (семейство MOBILE-ACTION-LABELS-001).
// На телефоне правка владельца — иконка в строке экрана (`useScreenHeader`),
// удаление/печать/экспорт — подписанные пункты «⋯» (`ActionListSheet`), удаление
// последним, `destructive`, через `ConfirmDialog`. Полноширинная кнопка
// `variant="danger"` и безымянная иконка корзины в теле экрана запрещены.
// Что остаётся в теле на desktop, помечается `SCREEN_HEADER_DESKTOP_PROPS` (блок
// снимается на телефоне). Исключения — только поимённо, с причиной.

const fs = require('node:fs')
const path = require('node:path')

// Экраны деталей и карточки, на которых действует правило.
const ACTION_SCREENS = [
  'app/(tabs)/trips/plan/[id].tsx',
  // #2115: «Удалить диалог» — действие над диалогом, который показывает экран чата.
  'components/messages/ChatView.tsx',
  'components/trips/planning/TripPlanScreenHeader.tsx',
  'components/trips/PublicTripDetail.tsx',
  'components/UserPoints/PointCard.tsx',
  'components/screens/calendar/CalendarScreen.tsx',
  'components/screens/calendar/calendarScreen.parts.tsx',
  // #2148: экран прохождения квеста — страница, визард, его панель и декларация.
  'app/(tabs)/quests/[city]/[questId].tsx',
  'components/quests/QuestWizard.tsx',
  'components/quests/questWizardShell.tsx',
  'components/quests/useQuestScreenHeader.ts',
]

// Экран, который обязан объявить действия в шапке (`useScreenHeader` прямо или через
// компонент-декларацию).
const REQUIRE_HEADER_DECLARATION = {
  'app/(tabs)/trips/plan/[id].tsx': /TripPlanScreenHeader|useScreenHeader\s*\(/,
  'components/trips/planning/TripPlanScreenHeader.tsx': /useScreenHeader\s*\(/,
  'components/trips/PublicTripDetail.tsx': /useScreenHeader\s*\(/,
  'components/screens/calendar/CalendarScreen.tsx': /useScreenHeader\s*\(/,
  // Визард — единственный владелец действий и сброса квеста: декларацию зовёт он.
  'components/quests/QuestWizard.tsx': /useQuestScreenHeader\s*\(/,
  'components/quests/useQuestScreenHeader.ts': /useScreenHeader\s*\(/,
}

// Файл → причина, почему корзина/danger-кнопка вне «⋯» допустима. Пусто = нарушение.
const EXCEPTIONS = {
  'components/screens/calendar/calendarScreen.parts.tsx':
    'карточка календаря: одно действие, иконка с accessibilityLabel и confirmAction; лист даты — подписанная кнопка внутри листа. Перевод карточки на «⋯» — отдельная карточка.',
}

// #2115: guard видит ВСЕ поверхности удаления, а не только экраны деталей. Корзина
// или `variant="danger"` вне `ACTION_SCREENS` допустимы только поимённо, с видом:
//  row      — действие над одной строкой списка (подпись + подтверждение у строки);
//  bulk     — массовое действие над выбранным в списке;
//  editor   — кнопка внутри открытого редактора/листа объекта (подписана текстом);
//  sheet    — пункт уже открытого меню/листа действий или попапа карты;
//  settings — раздел данных/аккаунта: подписанная кнопка с пояснением и подтверждением;
//  dialog   — кнопка самого диалога подтверждения/модерации.
// Новая находка без решения и запись без находки (устарела) — нарушение.
const SURFACE_KINDS = new Set(['row', 'bulk', 'editor', 'sheet', 'settings', 'dialog'])
const DELETE_SURFACES = {
  'app/(tabs)/favorites.tsx': ['row', 'удалить одну запись «Хочу поехать» из строки; «Очистить» — пункт «⋯» с destructive'],
  'components/UserPoints/PointsListActionsModal.tsx': ['sheet', 'пункт листа действий над точкой'],
  'components/UserPoints/PointsListBulkMapBar.tsx': ['bulk', 'удалить выбранные точки из панели выбора'],
  'components/UserPoints/PointsListBulkModals.tsx': ['dialog', 'кнопки диалогов подтверждения массовых действий'],
  'components/UserPoints/UserPointsMapPointMarker.web.tsx': ['sheet', 'действие попапа точки на карте'],
  'components/listTravel/RecommendationsTabs.tsx': ['row', 'очистить список вкладки; confirmAction на всех платформах (#1556, #2115)'],
  'components/listTravel/TravelListItem.tsx': ['row', 'админское удаление карточки в списке'],
  'components/mainPage/StickySearchBar.tsx': ['row', 'очистить недавние поиски в выпадающем списке'],
  'components/map/EditMarkerModal.tsx': ['editor', 'удалить фото в редакторе метки'],
  'components/map/MarkersListComponent.tsx': ['row', 'удалить метку из списка меток'],
  'components/messages/MessageBubble.tsx': ['row', 'удалить своё сообщение: подпись и подтверждение (web — строка, native — Alert)'],
  'components/messages/ThreadRow.tsx': ['row', 'удалить диалог из строки списка: кнопка по наведению и фокусу (web), долгое нажатие (native); подпись с именем и подтверждение (#2264)'],
  'components/offline/OfflineSaveControl.tsx': ['sheet', 'пункт меню офлайна маршрута, destructive'],
  'components/profile/ProfileCollectionHeader.tsx': ['row', 'desktop: очистить коллекцию в шапке коллекции, с подтверждением'],
  'components/screens/history/HistoryScreen.tsx': ['row', '«Очистить историю» — пункт «⋯» с destructive'],
  'components/screens/profile/ProfileHeaderSection.tsx': ['row', 'очистить список активной вкладки профиля, с подтверждением'],
  'components/settings/DataManagementSection.tsx': ['settings', 'массовая очистка избранного/истории в разделе данных, с подтверждением'],
  'components/settings/DataOwnershipSection.tsx': ['settings', 'удаление своих маршрутов/переписки: пояснение и двухшаговое подтверждение'],
  'components/travel/CommentItem.tsx': ['row', 'удалить комментарий в его меню, ConfirmDialog'],
  'components/travel/ImageGalleryComponent.ios.tsx': ['editor', 'удалить фото в редакторе галереи'],
  'components/travel/PhotoUploadWithPreview.tsx': ['editor', 'удалить фото в загрузчике'],
  'components/travel/PublishModerationAdminPanel.tsx': ['dialog', 'админское отклонение публикации'],
  'components/travel/RecentViews.tsx': ['row', 'очистить «Недавно смотрели», с подтверждением'],
  'components/travel/TravelStatusButton.tsx': ['sheet', '«Убрать из плана» в листе статуса маршрута'],
  'components/travel/WebMapMarkerPopup.tsx': ['sheet', 'действие попапа точки на карте'],
  'components/travel/gallery/GalleryControls.tsx': ['editor', 'удалить фото в редакторе галереи'],
  'components/travel/stepRoute/NativePointList.tsx': ['row', 'удалить точку из списка мастера, Alert с destructive'],
  'components/travel/stepRoute/PointEditorSheet.tsx': ['editor', 'удалить точку в листе редактора (двухшаговое подтверждение)'],
  'components/travel/upsert/WizardExitDialog.tsx': ['dialog', 'кнопка диалога выхода без сохранения'],
  'components/trips/planning/RoutePointEditForm.tsx': ['editor', 'удалить точку в форме правки (черновик маршрута до «Сохранить»)'],
  'components/trips/planning/RoutePointRow.tsx': ['row', 'удалить точку из списка маршрута (черновик до «Сохранить»)'],
  'components/trips/planning/TripPlanCard.tsx': ['row', 'удалить поездку из списка «Мои поездки», confirmAction'],
  'components/trips/planning/TripPlanRouteMap.tsx': ['sheet', 'удалить точку в поповере карты (черновик до «Сохранить»)'],
  'components/trips/planning/TripRouteStoredFiles.tsx': ['row', 'удалить сохранённый оригинал файла, ConfirmDialog'],
  'components/ui/ConfirmDialog.tsx': ['dialog', 'кнопка подтверждения самого диалога'],
}

const SCAN_DIRS = ['app', 'components', 'screens']
const SOURCE_FILE = /\.(tsx?|jsx?)$/

const DESKTOP_MARKER = 'SCREEN_HEADER_DESKTOP_PROPS'
const DANGER_BUTTON = /variant\s*=\s*["']danger["']/
const TRASH_ICON = /["']trash(?:-2)?["']/
// Потребитель пункта «⋯»: `overflow` шапки, `menuActions` карточки или `ActionListSheet`.
// Пункт с `destructive`, который уходит только в ряд чипов, ничего не делает (P2 #2101).
const OVERFLOW_CONSUMER = /\boverflow\s*[:=,}]|\bmenuActions\s*=|<ActionListSheet\b/

const hasNear = (lines, index, back, forward, test) => {
  const from = Math.max(0, index - back)
  const to = Math.min(lines.length - 1, index + forward)
  for (let i = from; i <= to; i += 1) {
    if (test(lines[i])) return true
  }
  return false
}

// Литерал объекта, внутри которого стоит строка: от ближайшей несбалансированной `{`
// назад до парной `}` вперёд.
function enclosingLiteral(source, offset) {
  let depth = 0
  let start = -1
  for (let i = offset; i >= 0; i -= 1) {
    const ch = source[i]
    if (ch === '}') depth += 1
    else if (ch === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth -= 1
    }
  }
  if (start < 0) return ''
  depth = 0
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return ''
}

const isEffectiveDestructiveItem = (source, offset) => {
  const literal = enclosingLiteral(source, offset)
  return /\bdestructive\s*:\s*true\b|\bdestructive\b\s*[,}]/.test(literal) &&
    /\bonPress\b/.test(literal) &&
    OVERFLOW_CONSUMER.test(source)
}

function scanSource(rel, source) {
  const findings = []
  const lines = source.split('\n')
  const exception = EXCEPTIONS[rel]
  let lineStart = 0
  lines.forEach((line, index) => {
    const offset = lineStart + Math.max(0, line.search(TRASH_ICON))
    lineStart += line.length + 1
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
    const inDesktopBlock = hasNear(lines, index, 20, 0, (l) => l.includes(DESKTOP_MARKER))
    if (DANGER_BUTTON.test(line) && !inDesktopBlock && !exception) {
      findings.push(`${rel}:${index + 1}: Button variant="danger" в теле экрана — удаление это пункт «⋯» (destructive) + ConfirmDialog; на desktop блок помечают ${DESKTOP_MARKER}`)
    }
    if (TRASH_ICON.test(line) && !inDesktopBlock && !exception && !isEffectiveDestructiveItem(source, offset)) {
      findings.push(`${rel}:${index + 1}: иконка корзины вне пункта «⋯» с destructive — безымянное удаление в теле экрана запрещено`)
    }
  })
  if (REQUIRE_HEADER_DECLARATION[rel] && !REQUIRE_HEADER_DECLARATION[rel].test(source)) {
    findings.push(`${rel}: экран обязан объявить действия шапки через useScreenHeader`)
  }
  return findings
}

const isCodeLine = (line) => !/^\s*(\/\/|\*|\/\*)/.test(line)
const hasDeleteSurface = (source) =>
  source.split('\n').some((line) => isCodeLine(line) && (TRASH_ICON.test(line) || DANGER_BUTTON.test(line)))

function listSourceFiles(rootDir, dir, out = []) {
  const abs = path.join(rootDir, dir)
  if (!fs.existsSync(abs)) return out
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) listSourceFiles(rootDir, rel, out)
    else if (SOURCE_FILE.test(entry.name)) out.push(rel)
  }
  return out
}

function scanDeleteSurfaces(rootDir) {
  const findings = []
  const withSurface = new Set()
  for (const dir of SCAN_DIRS) {
    for (const rel of listSourceFiles(rootDir, dir)) {
      if (hasDeleteSurface(fs.readFileSync(path.join(rootDir, rel), 'utf8'))) withSurface.add(rel)
    }
  }
  for (const rel of withSurface) {
    if (!ACTION_SCREENS.includes(rel) && !DELETE_SURFACES[rel]) {
      findings.push(`${rel}: корзина или variant="danger" без решения — экран объекта в ACTION_SCREENS (правило #2101) или строка DELETE_SURFACES с видом и причиной`)
    }
  }
  for (const [rel, entry] of Object.entries(DELETE_SURFACES)) {
    const [kind, reason] = Array.isArray(entry) ? entry : []
    if (!SURFACE_KINDS.has(kind) || !String(reason || '').trim()) {
      findings.push(`${rel}: запись DELETE_SURFACES без вида из ${[...SURFACE_KINDS].join('/')} или без причины`)
    }
    if (ACTION_SCREENS.includes(rel)) findings.push(`${rel}: и в ACTION_SCREENS, и в DELETE_SURFACES — решение одно`)
    if (!withSurface.has(rel)) findings.push(`${rel}: запись DELETE_SURFACES устарела — корзины/danger в файле нет`)
  }
  return findings
}

function scanScreenActions(rootDir) {
  const findings = [...scanDeleteSurfaces(rootDir)]
  for (const rel of ACTION_SCREENS) {
    const file = path.join(rootDir, rel)
    if (!fs.existsSync(file)) {
      findings.push(`${rel}: файл из списка не найден — обнови scripts/guard-screen-actions.js`)
      continue
    }
    findings.push(...scanSource(rel, fs.readFileSync(file, 'utf8')))
  }
  for (const [rel, reason] of Object.entries(EXCEPTIONS)) {
    if (!ACTION_SCREENS.includes(rel) || !String(reason).trim()) {
      findings.push(`${rel}: исключение без причины или вне списка экранов`)
    }
  }
  return findings
}

module.exports = { ACTION_SCREENS, EXCEPTIONS, DELETE_SURFACES, scanSource, scanScreenActions, scanDeleteSurfaces }

if (require.main === module) {
  const rootIdx = process.argv.indexOf('--root')
  const root = rootIdx > -1 ? path.resolve(process.argv[rootIdx + 1]) : process.cwd()
  const findings = scanScreenActions(root)
  if (findings.length) {
    console.error('guard-screen-actions failed:\n' + findings.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log(`guard-screen-actions ok (${ACTION_SCREENS.length} files)`)
}
