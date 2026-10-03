/**
 * @jest-environment node
 *
 * #2104 — у вида «пусто» один владелец: `components/ui/EmptyState.tsx`
 * (`density: 'full' | 'compact'`, правило — docs/DESIGN_SYSTEM.md «Empty states»).
 *
 * 1. Вне владельца запрещены стилевые ключи круга-подложки пустого состояния:
 *    `empty*Icon*`, `empty*Circle*` (самописная заглушка всегда начинается с них —
 *    так появились круг 88 панели карты, круг 64 комментариев и другие размеры).
 * 2. Вне владельца запрещены собственные компоненты и файлы `*EmptyState*`
 *    (PascalCase), если файл не строится на `ui/EmptyState`.
 *
 * Исключения — поимённо, с причиной. Страж судит код без комментариев и сам
 * проверен на синтетическом нарушении (первый тест).
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIRS = ['app', 'components', 'screens', 'hooks'];
const OWNER = 'components/ui/EmptyState.tsx';
const OWNER_IMPORT = /from\s+['"]@\/components\/ui\/EmptyState['"]/;

export const EMPTY_CIRCLE_KEY = /\bempty\w*(?:Icon|Circle)\w*\s*:/;
export const OWN_EMPTY_COMPONENT = /\b(?:function|const|class)\s+((?:[A-Z]\w*)?EmptyState\w*)\b/;
const OWN_EMPTY_FILE = /^(?:[A-Z]\w*)?EmptyState\w*\.tsx?$/;

/** Файл → причина, почему собственный вид «пусто» допустим. */
const EXCEPTIONS: Record<string, string> = {
  'components/travel/TravelRatingSection.tsx':
    'пустой блок оценки сам является вводом: звёзды, сохранение и успех внутри — не заглушка списка',
  'components/home/HomeInspirationSection.tsx':
    'редакционная карточка главной: плашка «Пока без совпадений» и слот CTA секции, не пустой список',
  'components/home/homeInspirationStyles.ts': 'стили той же карточки главной (см. HomeInspirationSection)',
  'components/trips/planning/TripPlanningEmptyState.tsx':
    'онбординг вкладки поездок: список шагов и пример маршрута, а не заглушка «нет данных»',
  'components/MapPage/MapMobile/MapEmptyStateToast.tsx': 'тост поверх карты, не блок пустого состояния',
};

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

export function findViolations(file: string, source: string): string[] {
  const code = stripComments(source);
  const out: string[] = [];
  code.split('\n').forEach((line, index) => {
    if (EMPTY_CIRCLE_KEY.test(line)) out.push(`${file}:${index + 1} ключ круга пустого состояния: ${line.trim()}`);
  });
  if (!OWNER_IMPORT.test(code)) {
    const own = code.match(OWN_EMPTY_COMPONENT);
    if (own) out.push(`${file}: собственный компонент ${own[1]} без ui/EmptyState`);
    if (OWN_EMPTY_FILE.test(path.basename(file))) out.push(`${file}: собственный файл заглушки без ui/EmptyState`);
  }
  return out;
}

describe('Empty state governance (#2104)', () => {
  it('матчер ловит самописную заглушку (синтетическая проба)', () => {
    expect(findViolations('x.ts', 'const s = { emptyIconCircle: { width: 88 } }')).toHaveLength(1);
    expect(findViolations('x.ts', 'emptyStateIconWrap: { borderRadius: 32 },')).toHaveLength(1);
    expect(findViolations('x.tsx', 'export function PanelEmptyState() { return null }')).toHaveLength(1);
    expect(findViolations('x.tsx', 'function EmptyState({ title }) { return null }')).toHaveLength(1);
    expect(findViolations('LocalEmptyState.tsx', 'export default 1')).toHaveLength(1);
    // Обёртка над владельцем и комментарии — не нарушение.
    expect(
      findViolations(
        'x.tsx',
        "import EmptyState from '@/components/ui/EmptyState'\nconst ScreenEmptyState = () => null",
      ),
    ).toHaveLength(0);
    expect(findViolations('x.ts', '// emptyIconCircle был здесь\nconst emptyWrap = {}')).toHaveLength(0);
    expect(findViolations('x.ts', 'function getEmptyStateMessage() {}')).toHaveLength(0);
  });

  it('вне ui/EmptyState нет собственных заглушек, кроме поимённых исключений', () => {
    const violations: string[] = [];
    for (const dir of SRC_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const name = rel(file);
        if (name === OWNER || EXCEPTIONS[name]) continue;
        violations.push(...findViolations(name, fs.readFileSync(file, 'utf8')));
      }
    }
    expect(violations).toEqual([]);
  });

  it('каждое исключение существует и всё ещё нужно', () => {
    const stale = Object.keys(EXCEPTIONS).filter((name) => {
      const file = path.join(ROOT, name);
      if (!fs.existsSync(file)) return true;
      return findViolations(name, fs.readFileSync(file, 'utf8')).length === 0;
    });
    expect(stale).toEqual([]);
  });
});
