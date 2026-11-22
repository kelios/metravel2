/**
 * Признание «на сайте такого нет» в тексте ответа — один определитель для журнала службы (#3296: ход с
 * таким признанием помечается `partial_no_material`) и контура оценки (`isNoMaterial` в
 * `scripts/ai-assistant-eval/checks.mjs`, проверка `no_admission`). На RU/BE/UK/PL/EN.
 *
 * Модуль без `@/`-импортов: его грузит служба (`node --experimental-strip-types`) и контур оценки.
 */

/** «На сайте такого нет» — честный отказ по теме. */
const NO_MATERIAL_RE =
  /(?:пока\s+)?нет\s+(?:(?:отдельн|подходящ|так)\p{L}+\s+)?(?:материал|стат|квест|ничего|информац)|не\s+нашл|не\s+найден|няма\s+(?:матэрыял|артыкул)|немає\s+(?:матеріал|стат)|nie\s+ma(?:my)?\s+(?:jeszcze\s+)?(?:materia|artyku|questów)|brak\s+materia|(?:no|don't\s+have\s+(?:any\s+)?)\s*(?:separate\s+|dedicated\s+)?(?:materials?|articles?|quests?)\s+(?:about|on|for)|no\s+(?:exact|precise|direct)\s+answer\s+in\s+the\s+(?:materials?|articles?|cards?|sources?)/iu
/**
 * Обратный порядок слов: «материала про Гданьск пока нет» — сам материал отсутствует, в пределах одной
 * фразы. Так же строятся учебные ответы на других языках (`rag_answers.py`: «Асобнага матэрыялу … няма»,
 * «Окремого матеріалу … немає», «Osobnego materiału … nie ma»); раньше шаблон знал только русский и
 * верный ответ на BE/UK/PL получал ложный `no_admission`.
 */
const NO_MATERIAL_REVERSE_RE =
  /(?<![\p{L}\p{N}])(?:материал|стат(?:ь|е)|квест|матэрыял|артыкул|квэст|матеріал|статт|materia[łl]|artyku[łl]|quest)\p{L}*\s+[^.!?;,\n]{0,120}?(?<!\p{L})(?:нет|не\s+найден\p{L}*|няма|немає|нема|nie\s+ma)(?!\p{L})/giu
const MATERIAL_AFFIRMED_RE = /(?<!\p{L})(?:есть|имеется|имеются|но|ёсць|але|є|jest|są|ale)(?!\p{L})/iu

/** В тексте есть признание «материала об этом на сайте нет». */
export const admitsNoMaterial = (text: string | null | undefined): boolean => {
  const value = String(text ?? '')
  return NO_MATERIAL_RE.test(value) || [...value.matchAll(NO_MATERIAL_REVERSE_RE)].some((match) => !MATERIAL_AFFIRMED_RE.test(match[0]))
}
