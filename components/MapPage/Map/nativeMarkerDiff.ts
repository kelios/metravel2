/**
 * #2453 — diff по стабильному ключу для каналов маркеров и кластеров native-карты.
 *
 * RN помнит, что уже отправлено в текущую страницу WebView (ключ → подпись), и
 * шлёт только изменения: новые/изменённые элементы в `add`, исчезнувшие — в
 * `removeKeys`. Повтор того же набора даёт пустой патч и не создаёт инжекта
 * вовсе; догрузка страницы списка или новый ответ кластеров — ровно разницу.
 * Ключи совпадают с WebView-стороной (`nativeMapLayersScript.ts`).
 */
import type { NativeClusterPayloadItem, NativeMarkerPayloadItem } from './nativeMarkerPayload';

export interface NativeKeyedPatch<T> {
  add: T[];
  removeKeys: string[];
}

/** Что уже лежит в странице WebView: ключ → подпись элемента. */
export type NativeSentIndex = ReadonlyMap<string, string>;

export interface NativeKeyedDiffResult<T> {
  patch: NativeKeyedPatch<T>;
  nextSent: Map<string, string>;
}

export const isEmptyNativePatch = <T>(patch: NativeKeyedPatch<T>): boolean =>
  patch.add.length === 0 && patch.removeKeys.length === 0;

/**
 * Чистый diff: `sent` не мутируется. Элемент без ключа пропускается (WebView его
 * всё равно не нарисовал бы), дубликат ключа в `next` — побеждает последний.
 */
export const diffNativeKeyedItems = <T>(
  sent: NativeSentIndex,
  next: readonly T[],
  keyOf: (item: T) => string | null,
  signatureOf: (item: T) => string,
): NativeKeyedDiffResult<T> => {
  const nextSent = new Map<string, string>();
  const byKey = new Map<string, T>();
  for (const item of next) {
    const key = keyOf(item);
    if (!key) continue;
    byKey.set(key, item);
    nextSent.set(key, signatureOf(item));
  }
  const add: T[] = [];
  byKey.forEach((item, key) => {
    if (sent.get(key) !== nextSent.get(key)) add.push(item);
  });
  const removeKeys: string[] = [];
  sent.forEach((_signature, key) => {
    if (!nextSent.has(key)) removeKeys.push(key);
  });
  return { patch: { add, removeKeys }, nextSent };
};

/** Ключ маркера: тот же, что `__metravelMarkerKey` в WebView. */
export const nativeMarkerKey = (item: NativeMarkerPayloadItem): string | null => {
  if (!item?.coord) return null;
  return item.placeKey ? item.placeKey : `c:${item.coord}`;
};

/** Подпись маркера: всё, что влияет на его отрисовку и выбор. */
export const nativeMarkerSignature = (item: NativeMarkerPayloadItem): string =>
  `${item.coord}|${item.categoryName}|${item.sourceCount}|${item.id ?? ''}`;

/** Ключ кластера геометрический (#1347) и уже включает число точек. */
export const nativeClusterKey = (item: NativeClusterPayloadItem): string | null =>
  item?.key ? item.key : null;

export const nativeClusterSignature = (item: NativeClusterPayloadItem): string => item.key;
