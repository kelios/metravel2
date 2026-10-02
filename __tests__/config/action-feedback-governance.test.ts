/**
 * @jest-environment node
 *
 * #2103 — отклик на действие в одно касание имеет одного владельца.
 *
 * 1. `addFavorite`/`removeFavorite` из UI зовёт только `useFavoriteToggle`
 *    (три сердечка писали отклик тремя способами — отсюда «нет отклика» в
 *    каталоге).
 * 2. Компоненты-переключатели не зовут `showToast`/`haptic*` сами: только
 *    `useActionFeedback.run`.
 *
 * Страж судит КОД, а не прозу (комментарии срезаны), и сам проверен на
 * синтетическом нарушении: см. «матчер ловит…».
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIRS = ['app', 'components', 'screens', 'hooks', 'context', 'utils', 'services', 'stores', 'api'];

/** Владельцы механизма: хук-единственный путь + слой данных избранного. */
const FAVORITE_OWNERS = new Set([
  'hooks/useFavoriteToggle.ts',
  'hooks/useFavoritesData.ts',
  'context/FavoritesContext.tsx',
  'context/FavoritesProvider.tsx',
]);

/** Переключатели, чей отклик обязан идти через useActionFeedback. */
const TOGGLE_COMPONENTS = [
  'components/travel/FavoriteButton.tsx',
  'components/ui/SubscribeButton.tsx',
  'hooks/useSubscription.ts',
  'components/travel/TravelStatusButton.tsx',
  'components/achievements/PeerBadgePickerSheet.tsx',
  'components/MapPage/Map/createMapPopupComponent.tsx',
  'hooks/useAddressListItemActions.ts',
  'components/travel/hooks/usePointListAddPointModel.ts',
];

/** Отклик SubscribeButton живёт в useSubscription (он тоже в списке и проверяется выше). */
const EXPECTED_VIA_PARENT: string[] = ['components/ui/SubscribeButton.tsx'];

export const FAVORITE_CALL = /\b(?:addFavorite|removeFavorite)\b/;
export const DIRECT_FEEDBACK =
  /\b(?:showToast|showToastMessage|hapticImpact|hapticNotification|hapticSelection)\b/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
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
const read = (file: string) => stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'));

describe('Action feedback governance (#2103)', () => {
  it('матчер ловит прямой вызов избранного и тоста/haptic (синтетическая проба)', () => {
    expect(FAVORITE_CALL.test(stripComments('await addFavorite({ id })'))).toBe(true);
    expect(FAVORITE_CALL.test(stripComments('const { removeFavorite } = useFavorites()'))).toBe(true);
    expect(FAVORITE_CALL.test(stripComments('// addFavorite только в хуке\nconst a = 1'))).toBe(false);
    expect(DIRECT_FEEDBACK.test(stripComments("showToast({ type: 'success' })"))).toBe(true);
    expect(DIRECT_FEEDBACK.test(stripComments("hapticImpact('light')"))).toBe(true);
    expect(DIRECT_FEEDBACK.test(stripComments('/* showToast */ run({ commit })'))).toBe(false);
  });

  it('addFavorite/removeFavorite зовёт только useFavoriteToggle (и слой данных)', () => {
    const offenders = SRC_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))
      .map(rel)
      .filter((file) => !FAVORITE_OWNERS.has(file))
      .filter((file) => FAVORITE_CALL.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('переключатели не зовут showToast/haptic напрямую, только useActionFeedback', () => {
    const offenders = TOGGLE_COMPONENTS.filter((file) => DIRECT_FEEDBACK.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('переключатели действительно идут через useActionFeedback/useFavoriteToggle', () => {
    // Иначе страж молча зеленеет, если компонент просто перестал давать отклик.
    const withoutOwner = TOGGLE_COMPONENTS.filter(
      (file) => !/\buse(?:ActionFeedback|FavoriteToggle)\b/.test(read(file)),
    );
    // Исключение — явный список, а не молчаливый пропуск.
    expect(withoutOwner).toEqual(EXPECTED_VIA_PARENT);
  });
});
