import type { QuestPointRole } from '@/utils/questCountModel';

export type QuestPoiInfo = {
  isMuseum: boolean;
  openingHours?: string;
  ticketPrice?: string;
  website?: string;
};

/**
 * Проверка ответа шага. `contentLocale` — язык, на котором игрок читал задание
 * (#2196): правило нормализации выбирается по нему, ответ сверяется ещё и под
 * правилом источника `ru`. Без локали — `ru`, поведение до переводов.
 */
export type QuestAnswerChecker = ((input: string, contentLocale?: string) => boolean) & {
  /** Шаг без проверяемого ответа: карточка может пройти его автоматически. */
  _isAny?: boolean;
  /** Минимальная длина свободного ответа для понятной подсказки в UI. */
  _freeTextMinLength?: number;
  /**
   * Тип `answer_pattern`, из которого собран чекер. Нужен телеметрии попыток:
   * по нему решается, можно ли вообще отправлять сырой ввод (свободная
   * рефлексия не покидает устройство). Сам чекер им не пользуется.
   */
  _answerType?: string;
};

export type QuestStep = {
  /** Строковый `step_id` квеста ("minsk-cmok-3") — им шаг адресуется в UI. */
  id: string;
  /**
   * Числовой PK шага на бэкенде. Нужен там, где эндпоинт адресуется по `pk`, а
   * не по строковому идентификатору: структурная отметка «точка изменилась»
   * (`api/questStepInaccuracy.ts`) и привязка фото отзыва к точке. Может
   * отсутствовать у синтетических шагов (интро) и у офлайн-бандла, поэтому
   * потребитель обязан переживать `undefined`, а не считать его ошибкой.
   */
  numericId?: number;
  title: string;
  location: string;
  story: string;
  task: string;
  hint?: string;
  answer: QuestAnswerChecker;
  /**
   * Язык контента шага (`content_locale` бандла, #2197). Отсутствие — `ru`:
   * квест без перевода и ответ старого бэкенда.
   */
  contentLocale?: string;
  /** Человекочитаемый ожидаемый ответ — для «страницы ведущего» в печатной версии. */
  answerDisplay?: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  image?: any;
  inputType?: 'number' | 'text';
  poiInfo?: QuestPoiInfo | null;
  /** Backend-owned route role. Missing means the point-count contract is incomplete. */
  pointRole?: QuestPointRole;
};

export type QuestCity = {
  /** Числовой id города — канонический сегмент квестового URL (#1938). */
  id?: number;
  name?: string;
  /** Русское имя города при локализованном `name` (#2197). */
  nameCanonical?: string;
  lat: number;
  lng: number;
  countryCode?: string;
};

export type QuestFinale = {
  text: string;
  video?: any;
  poster?: any;
};
