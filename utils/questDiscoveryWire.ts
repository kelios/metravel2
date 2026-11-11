// #3234: inline-JSON страницы каталога — 343 строки по ~850 байт, и треть из них —
// значения, одинаковые почти у каждой строки. Loader отдаёт строку без полей,
// равных значению по умолчанию, граница маршрута дописывает их обратно.
// Умолчание считается от самой строки, поэтому `expand(compact(row))` равен
// `row` дословно, а повторное `expand` ничего не меняет.
import type { ApiQuestMeta } from '@/api/quests';
import type { QuestDiscovery } from '@/utils/questDiscovery';

/**
 * Wire form of the route loader data: rows omit fields equal to their default.
 * They travel under `rows`, not `quests`: a client bundle from before #3234 that
 * fetches new loader data on a client navigation finds no `quests` array, drops
 * the payload and reads the catalogue itself, instead of rendering partial rows.
 */
export type CompactQuestDiscovery = Omit<QuestDiscovery, 'quests'> & { rows: Partial<ApiQuestMeta>[] };

type Row = Record<string, unknown>;

const ALL_LOCALES = ['ru', 'be', 'uk', 'pl', 'en'];
const ROW_DEFAULTS: Record<string, (row: Row) => unknown> = {
  city_name_canonical: (row) => row.city_name,
  city_name_localized: (row) => row.city_name,
  city_legacy_ids: () => [],
  pet_friendly: () => false,
  content_locale: () => 'ru',
  available_locales: () => [...ALL_LOCALES],
  rating_count: () => 0,
  completions_count: () => 0,
  rating_avg: () => null,
  personal_status_unavailable: () => true,
  user_rating: () => null,
  is_completed_by_me: () => false,
  first_completer: () => null,
};

const sameValue = (a: unknown, b: unknown) => (Array.isArray(a) && Array.isArray(b)
  ? a.length === b.length && a.every((value, index) => value === b[index])
  : a === b);

function compactQuestDiscoveryRow(row: Row): Row {
  const compact: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const fallback = ROW_DEFAULTS[key];
    if (!fallback || !sameValue(value, fallback(row))) compact[key] = value;
  }
  return compact;
}

function expandQuestDiscoveryRow(row: Row): Row {
  const full: Row = { ...row };
  for (const [key, fallback] of Object.entries(ROW_DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) full[key] = fallback(row);
  }
  return full;
}

/** Транспортная форма для inline-JSON маршрута: та же публикация без повторов. */
export function compactQuestDiscovery({ quests, ...discovery }: QuestDiscovery): CompactQuestDiscovery {
  return { ...discovery, rows: quests.map((row) => compactQuestDiscoveryRow(row as unknown as Row) as Partial<ApiQuestMeta>) };
}

/**
 * Обратно к форме `validateQuestDiscovery`; полная форма (`quests`, данные
 * сервера до #3234) проходит без изменений.
 */
export function expandQuestDiscovery(discovery: QuestDiscovery | CompactQuestDiscovery): QuestDiscovery {
  const { rows, quests, ...rest } = discovery as Partial<CompactQuestDiscovery> & Partial<QuestDiscovery>;
  const source: Row[] = (rows ?? quests ?? []) as Row[];
  return { ...(rest as Omit<QuestDiscovery, 'quests'>), quests: source.map((row) => expandQuestDiscoveryRow(row) as unknown as ApiQuestMeta) };
}

/** Данные loader'а годятся для контекста: опубликованный каталог в любой из двух форм. */
export function readQuestDiscoveryLoaderData(loaded: unknown): QuestDiscovery | null {
  if (!loaded || typeof loaded !== 'object') return null;
  const data = loaded as Partial<CompactQuestDiscovery> & Partial<QuestDiscovery>;
  const rows = data.rows ?? data.quests;
  return data.schema_version === 2 && data.state === 'available' && Array.isArray(rows)
    && ['home', 'catalog', 'scenario'].includes(String(data.view))
    ? expandQuestDiscovery(data as CompactQuestDiscovery)
    : null;
}
