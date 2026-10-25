// Смысловой подбор (#2459): блоки «Похожие статьи» на статье и квесте и строка
// «Подобрать по описанию» на /search под флагом EXPO_PUBLIC_AI_PICKS. Ключи одинаковы
// во всех локалях (RU/BE/UK/PL/EN).
export const aiPicksStaticResources = {
  "similar.travelTitle": "Podobne artykuły",
  "similar.travelSubtitle": "Dobrane według treści tekstu, a nie tylko miejsca na mapie",
  "similar.questTitle": "Artykuły o miejscach questu",
  "similar.questSubtitle": "Relacje i trasy autorów o tych samych miejscach",
  "search.title": "Dobierz według opisu",
  "search.hint": "Opisz słowami, czego szukasz — znajdziemy artykuły i questy według znaczenia, nie tylko po tytule",
  "search.placeholder": "Na przykład: z dziećmi na weekend pod Krakowem",
  "search.inputLabel": "Opis tego, czego szukasz",
  "search.loading": "Dobieramy materiały…",
  "search.resultsTitle": "Dobrane według znaczenia",
  "search.empty": "Na stronie jeszcze o tym nie ma — opisz inaczej albo przejrzyj katalog poniżej",
  "search.clear": "Wyczyść",
  "search.degraded": "Część wyników mogła nie trafić do doboru: usługa odpowiedziała niepełnie",
  "search.unavailable": "Dobór jest teraz niedostępny — zwykłe wyszukiwanie poniżej działa",
  "type.quest": "Quest",
} as const
