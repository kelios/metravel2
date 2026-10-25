// Смысловой подбор (#2459): блоки «Похожие статьи» на статье и квесте и строка
// «Подобрать по описанию» на /search под флагом EXPO_PUBLIC_AI_PICKS. Ключи одинаковы
// во всех локалях (RU/BE/UK/PL/EN).
export const aiPicksStaticResources = {
  "similar.travelTitle": "Similar stories",
  "similar.travelSubtitle": "Picked by the meaning of the text, not only by the place on the map",
  "similar.questTitle": "Stories about the quest's places",
  "similar.questSubtitle": "Authors' stories and routes about the same places",
  "search.title": "Describe what you are looking for",
  "search.hint": "Describe it in your own words — we will find stories and quests by meaning, not only by title",
  "search.placeholder": "For example: a weekend near Kraków with kids",
  "search.inputLabel": "Description of what you are looking for",
  "search.loading": "Picking materials…",
  "search.resultsTitle": "Picked by meaning",
  "search.empty": "Nothing about this on the site yet — try another wording or browse the catalog below",
  "search.clear": "Clear",
  "search.degraded": "Some results may be missing: the service answered only partially",
  "search.unavailable": "Picks are unavailable right now — the regular search below still works",
  "type.quest": "Quest",
} as const
