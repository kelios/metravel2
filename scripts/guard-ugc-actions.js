#!/usr/bin/env node
// #2133 (Apple 1.2(c)): у каждого типа пользовательского контента есть жалоба.
//
// Типы — `CONTENT_TYPES` из `types/contentSafety.ts` (зеркало REPORTABLE_CONTENT
// бэка, #2129). Реестр ниже называет рендеры UGC и типы, которые каждый из них
// показывает. Рендер обязан строить ссылку `makeContentRef('<тип>', …)` и
// подключать общий слой (`ContentSafetyActions` / `useContentSafetyActions` или
// `UserSafetyMenu` для профиля). Поверхность `list` (объект в ленте) скрываемого
// типа (`hideable: true` в `CONTENT_SAFETY_POLICY`) оборачивает объект в
// `HiddenContentGate`; `detail` (страница или шапка одного объекта) — нет. Каждый тип покрыт хотя бы
// одним рендером или исключён поимённо с причиной. Обратная проверка: файл,
// который строит ссылку или рисует меню, но не записан в реестр, — нарушение,
// чтобы реестр не отставал от кода.

const fs = require('node:fs')
const path = require('node:path')

const TYPES_FILE = 'types/contentSafety.ts'

const SURFACES = new Set(['list', 'detail'])
const UGC_RENDERS = {
  'components/profile/UserSafetyMenu.tsx': { surface: 'detail', types: ['user'] },
  'components/messages/ChatView.tsx': { surface: 'detail', types: ['user'] },
  'components/listTravel/TravelListItem.tsx': { surface: 'list', types: ['travel'] },
  'components/travel/details/TravelAuthorQuickLink.tsx': { surface: 'detail', types: ['travel'] },
  'components/travel/compactSideBar/parts/AuthorBlock.tsx': { surface: 'detail', types: ['travel'] },
  'components/travel/CommentItem.tsx': { surface: 'list', types: ['travel_comment'] },
  'components/places/PlaceCommentItem.tsx': { surface: 'list', types: ['place_comment'] },
  'components/messages/MessageBubble.tsx': { surface: 'list', types: ['message'] },
  'components/trips/chat/TripChatPanel.tsx': { surface: 'list', types: ['trip_chat_message'] },
  'components/quests/QuestReviewsModal.tsx': { surface: 'list', types: ['quest_review'] },
  'components/travel/FullscreenGallery.tsx': { surface: 'detail', types: ['photo'] },
  'components/travel/FullscreenGallery.web.tsx': { surface: 'detail', types: ['photo'] },
  'components/trips/PublicTripDetail.tsx': { surface: 'detail', types: ['trip'] },
}

// Тип → почему у него нет своего рендера с меню. Пусто = нарушение.
const EXEMPT_TYPES = {
  quest_review_photo: 'фото отзыва квеста показывается только внутри отзыва; жалоба — пункт меню отзыва (quest_review)',
  trip_route_template: 'шаблоны маршрутов не имеют публичного рендера: только в своём конструкторе поездки',
  trip_report: 'отчёт о поездке виден только в приватном экране своей поездки',
}

// Где живёт сам слой: здесь ссылки строятся генерически, не по типу.
const LAYER_FILES = new Set([
  'components/safety/ContentSafetyActions.tsx',
  'components/safety/useContentSafetyActions.tsx',
  'components/safety/HiddenContentGate.tsx',
  'components/safety/ReportReasonSheet.tsx',
])

const SCAN_DIRS = ['app', 'components', 'screens', 'hooks']
const LAYER_USE = /\b(?:ContentSafetyActions|useContentSafetyActions|UserSafetyMenu)\b/
const REF_CALL = /\bmakeContentRef\s*\(\s*['"]([a-z_]+)['"]/g
const MENU_USE = /<ContentSafetyActions\b|\buseContentSafetyActions\s*\(/

function readContentTypes(source) {
  const block = source.match(/CONTENT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  const types = block ? [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : []
  const hideable = new Set()
  for (const m of source.matchAll(/^\s*([a-z_]+):\s*\{[^}]*\bhideable:\s*true\b/gm)) hideable.add(m[1])
  return { types, hideable }
}

function listSourceFiles(rootDir, dir) {
  const abs = path.join(rootDir, dir)
  if (!fs.existsSync(abs)) return []
  const out = []
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listSourceFiles(rootDir, rel))
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(rel.split(path.sep).join('/'))
  }
  return out
}

const refTypesIn = (source) => new Set([...source.matchAll(REF_CALL)].map((m) => m[1]))

function scanRender(rel, source, { surface, types: declared }, hideable) {
  const findings = []
  if (!LAYER_USE.test(source)) {
    findings.push(`${rel}: рендер UGC без ContentSafetyActions/useContentSafetyActions/UserSafetyMenu`)
  }
  const built = refTypesIn(source)
  for (const type of declared) {
    if (!built.has(type)) findings.push(`${rel}: тип "${type}" из реестра не строит makeContentRef('${type}', …)`)
    if (surface === 'list' && hideable.has(type) && !/<HiddenContentGate\b/.test(source)) {
      findings.push(`${rel}: тип "${type}" скрываемый (hideable) — объект ленты оборачивается в HiddenContentGate`)
    }
  }
  for (const type of built) {
    if (!declared.includes(type)) findings.push(`${rel}: строит ссылку "${type}", которой нет в реестре файла`)
  }
  return findings
}

// #3214: необратимое удаление пользовательских данных в мастере статьи и на карте
// спрашивает подтверждение. Вопрос — `confirmAction` (web: ConfirmDialogHost,
// native: системный Alert) или обёртка над ним из CONFIRM_HELPERS; поведение по
// `JEST_WORKER_ID` не ветвится, иначе тесты проверяют защиту, которой нет на сайте.
const DESTRUCTIVE_SCOPE = ['components/travel', 'components/map']
const CONFIRM_HELPERS = {
  'utils/confirmRemoveRoutePoint.ts': 'confirmRemoveRoutePoint',
}
// Компонент сам не спрашивает, а передаёт нажатие владельцу, который спрашивает.
// Владелец обязан звать вопрос — это проверяется, запись без него не спасает.
const DELEGATED_REMOVALS = {
  'components/travel/gallery/GalleryGrid.tsx': {
    owner: 'components/travel/gallery/ImageGallery.tsx',
    reason: 'onDelete плитки — ImageGallery.handleDeleteImage с confirmAction',
  },
  'components/travel/InstagramPublishPanel.tsx': {
    reason: 'onRemoveImage исключает фото из подборки публикации; фото и статья не удаляются',
  },
}
const JEST_BRANCH = /\bJEST_WORKER_ID\b/
const API_DELETE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@\/api\/[^'"]+['"]/g
const DIRECT_REMOVAL_EVENT = /\bon(?:Press|Click|Activate|LongPress)=\{\s*\(\)\s*=>\s*((?:on|handle)\w*(?:Remove|Delete)\w*)\s*\(/g

function asksConfirmation(source) {
  const names = ['confirmAction', ...Object.values(CONFIRM_HELPERS)]
  return names.some((name) => new RegExp(`\\b${name}\\s*\\(`).test(source)) || /<ConfirmDialog\b/.test(source)
}

function apiDeleteCalls(source) {
  const names = []
  for (const match of source.matchAll(API_DELETE_IMPORT)) {
    for (const part of match[1].split(',')) {
      const local = part.replace(/\btype\s+/, '').split(/\s+as\s+/).pop().trim()
      if (/^(?:delete|remove)[A-Z]\w*$/.test(local) && new RegExp(`\\b${local}\\s*\\(`).test(source)) names.push(local)
    }
  }
  return names
}

function scanDestructiveActions(rootDir) {
  const findings = []
  for (const [rel, name] of Object.entries(CONFIRM_HELPERS)) {
    const file = path.join(rootDir, rel)
    if (!fs.existsSync(file)) continue
    const source = fs.readFileSync(file, 'utf8')
    if (!new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`).test(source) || !/\bconfirmAction\s*\(/.test(source)) {
      findings.push(`${rel}: ${name} обязан вызывать confirmAction`)
    }
  }
  for (const dir of DESTRUCTIVE_SCOPE) {
    for (const rel of listSourceFiles(rootDir, dir)) {
      const source = fs.readFileSync(path.join(rootDir, rel), 'utf8')
      if (JEST_BRANCH.test(source)) {
        findings.push(`${rel}: ветвление по JEST_WORKER_ID в коде приложения — тесты должны идти тем же путём, что сайт`)
      }
      const asks = asksConfirmation(source)
      for (const name of apiDeleteCalls(source)) {
        if (!asks) findings.push(`${rel}: ${name}(…) удаляет данные на сервере без confirmAction`)
      }
      const delegated = DELEGATED_REMOVALS[rel]
      for (const match of source.matchAll(DIRECT_REMOVAL_EVENT)) {
        if (asks) continue
        if (!delegated) {
          findings.push(`${rel}: нажатие сразу вызывает ${match[1]}(…) без confirmAction — спроси или опиши владельца в DELEGATED_REMOVALS`)
          continue
        }
        if (!String(delegated.reason || '').trim()) findings.push(`${rel}: DELEGATED_REMOVALS без причины`)
        const ownerFile = delegated.owner && path.join(rootDir, delegated.owner)
        if (delegated.owner && (!fs.existsSync(ownerFile) || !asksConfirmation(fs.readFileSync(ownerFile, 'utf8')))) {
          findings.push(`${rel}: владелец ${delegated.owner} не спрашивает подтверждение`)
        }
        break
      }
    }
  }
  return findings
}

function scanUgcActions(rootDir) {
  const findings = []
  const typesPath = path.join(rootDir, TYPES_FILE)
  if (!fs.existsSync(typesPath)) return [`${TYPES_FILE}: не найден`]
  const { types, hideable } = readContentTypes(fs.readFileSync(typesPath, 'utf8'))
  if (!types.length) return [`${TYPES_FILE}: не найден список CONTENT_TYPES`]
  const known = new Set(types)

  const covered = new Set()
  for (const [rel, entry] of Object.entries(UGC_RENDERS)) {
    const declared = Array.isArray(entry?.types) ? entry.types : []
    if (!SURFACES.has(entry?.surface) || !declared.length) {
      findings.push(`${rel}: запись реестра без surface list/detail или без типов`)
      continue
    }
    const file = path.join(rootDir, rel)
    if (!fs.existsSync(file)) {
      findings.push(`${rel}: файл из реестра не найден — обнови scripts/guard-ugc-actions.js`)
      continue
    }
    for (const type of declared) {
      if (!known.has(type)) findings.push(`${rel}: тип "${type}" не объявлен в CONTENT_TYPES`)
      covered.add(type)
    }
    findings.push(...scanRender(rel, fs.readFileSync(file, 'utf8'), entry, hideable))
  }

  for (const [type, reason] of Object.entries(EXEMPT_TYPES)) {
    if (!known.has(type)) findings.push(`исключение "${type}": такого типа нет в CONTENT_TYPES`)
    if (!String(reason || '').trim()) findings.push(`исключение "${type}" без причины`)
    if (covered.has(type)) findings.push(`тип "${type}" и в реестре рендеров, и в исключениях — решение одно`)
  }
  for (const type of types) {
    if (!covered.has(type) && !EXEMPT_TYPES[type]) {
      findings.push(`тип "${type}" без рендера с жалобой: добавь рендер в UGC_RENDERS или исключение с причиной`)
    }
  }

  for (const dir of SCAN_DIRS) {
    for (const rel of listSourceFiles(rootDir, dir)) {
      if (UGC_RENDERS[rel] || LAYER_FILES.has(rel)) continue
      const source = fs.readFileSync(path.join(rootDir, rel), 'utf8')
      if (refTypesIn(source).size || MENU_USE.test(source)) {
        findings.push(`${rel}: строит ContentRef или рисует меню безопасности вне реестра UGC_RENDERS`)
      }
    }
  }
  findings.push(...scanDestructiveActions(rootDir))
  return findings
}

module.exports = {
  UGC_RENDERS,
  EXEMPT_TYPES,
  DELEGATED_REMOVALS,
  readContentTypes,
  scanRender,
  scanDestructiveActions,
  scanUgcActions,
}

if (require.main === module) {
  const rootIdx = process.argv.indexOf('--root')
  const root = rootIdx > -1 ? path.resolve(process.argv[rootIdx + 1]) : process.cwd()
  const findings = scanUgcActions(root)
  if (findings.length) {
    console.error('guard-ugc-actions failed:\n' + findings.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }
  console.log(`guard-ugc-actions ok (${Object.keys(UGC_RENDERS).length} renders, ${Object.keys(EXEMPT_TYPES).length} exempt types)`)
}
