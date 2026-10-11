// SSG-only catalog (#2399): read by the SSG generator through
// `loadSsgCatalogs`; never imported by runtime resources, so it stays out of
// the client locale chunks. Client code must not reference `*Ssg:` keys.
export const seoSsgResources = {
  "questDetail.kicker": "Городской квест Metravel",
  "questDetail.sectionLabel": "Описание городского квеста",
  "questDetail.leadWithCity": "{{value1}} — пеший квест по городу {{value2}}.",
  "questDetail.lead": "{{value1}} — пеший городской квест.",
  "questDetail.factCity": "Город: {{value1}}",
  "questDetail.factRoute_one": "Маршрут: {{count}} точка",
  "questDetail.factRoute_few": "Маршрут: {{count}} точки",
  "questDetail.factRoute_many": "Маршрут: {{count}} точек",
  "questDetail.factRoute_other": "Маршрут: {{count}} точек",
  "questDetail.factDuration": "Время: примерно {{value1}}",
  "questDetail.factStart": "Старт: {{value1}}",
  "questDetail.routeHeading": "Что на маршруте",
  "questDetail.routeLead": "Точки маршрута по порядку — что это за места и чем они интересны. Задания и ответы остаются в самом квесте.",
  "questDetail.linksHeading": "Куда дальше",
  "questDetail.linksLead": "Этот маршрут — часть городских квестов Metravel. Ниже — остальные квесты этого города и города с квестами рядом.",
  "questDetail.cityQuests": "Все квесты города: {{value1}}",
  "questDetail.nearbyCity_one": "— {{count}} квест, {{value1}} км",
  "questDetail.nearbyCity_few": "— {{count}} квеста, {{value1}} км",
  "questDetail.nearbyCity_many": "— {{count}} квестов, {{value1}} км",
  "questDetail.nearbyCity_other": "— {{count}} квестов, {{value1}} км",
  "questDetail.travelsHeading": "Путешествия: {{value1}}",
  "questDetail.travelsLead": "Статьи путешественников по этому городу помогут дополнить прогулку.",
  "questDetail.touristType": "Городской квест, пеший маршрут",
} as const
