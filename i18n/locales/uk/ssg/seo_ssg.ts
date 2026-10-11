// SSG-only catalog (#2399): read by the SSG generator through
// `loadSsgCatalogs`; never imported by runtime resources, so it stays out of
// the client locale chunks. Client code must not reference `*Ssg:` keys.
export const seoSsgResources = {
  "questDetail.kicker": "Міський квест Metravel",
  "questDetail.sectionLabel": "Опис міського квесту",
  "questDetail.leadWithCity": "{{value1}} — пішохідний квест містом {{value2}}.",
  "questDetail.lead": "{{value1}} — пішохідний міський квест.",
  "questDetail.factCity": "Місто: {{value1}}",
  "questDetail.factRoute_one": "Маршрут: {{count}} точка",
  "questDetail.factRoute_few": "Маршрут: {{count}} точки",
  "questDetail.factRoute_many": "Маршрут: {{count}} точок",
  "questDetail.factRoute_other": "Маршрут: {{count}} точок",
  "questDetail.factDuration": "Час: приблизно {{value1}}",
  "questDetail.factStart": "Старт: {{value1}}",
  "questDetail.routeHeading": "Що на маршруті",
  "questDetail.routeLead": "Точки маршруту по черзі — що це за місця і чим вони цікаві. Завдання та відповіді залишаються в самому квесті.",
  "questDetail.linksHeading": "Куди далі",
  "questDetail.linksLead": "Цей маршрут — частина міських квестів Metravel. Нижче — інші квести цього міста та міста з квестами поруч.",
  "questDetail.cityQuests": "Усі квести міста: {{value1}}",
  "questDetail.nearbyCity_one": "— {{count}} квест, {{value1}} км",
  "questDetail.nearbyCity_few": "— {{count}} квести, {{value1}} км",
  "questDetail.nearbyCity_many": "— {{count}} квестів, {{value1}} км",
  "questDetail.nearbyCity_other": "— {{count}} квестів, {{value1}} км",
  "questDetail.travelsHeading": "Подорожі: {{value1}}",
  "questDetail.travelsLead": "Статті мандрівників про це місто допоможуть доповнити прогулянку.",
  "questDetail.touristType": "Міський квест, пішохідний маршрут",
} as const
