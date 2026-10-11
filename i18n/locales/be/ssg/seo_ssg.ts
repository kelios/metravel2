// SSG-only catalog (#2399): read by the SSG generator through
// `loadSsgCatalogs`; never imported by runtime resources, so it stays out of
// the client locale chunks. Client code must not reference `*Ssg:` keys.
export const seoSsgResources = {
  "questDetail.kicker": "Гарадскі квэст Metravel",
  "questDetail.sectionLabel": "Апісанне гарадскога квэста",
  "questDetail.leadWithCity": "{{value1}} — пешы квэст па горадзе {{value2}}.",
  "questDetail.lead": "{{value1}} — пешы гарадскі квэст.",
  "questDetail.factCity": "Горад: {{value1}}",
  "questDetail.factRoute_one": "Маршрут: {{count}} кропка",
  "questDetail.factRoute_few": "Маршрут: {{count}} кропкі",
  "questDetail.factRoute_many": "Маршрут: {{count}} кропак",
  "questDetail.factRoute_other": "Маршрут: {{count}} кропак",
  "questDetail.factDuration": "Час: прыкладна {{value1}}",
  "questDetail.factStart": "Старт: {{value1}}",
  "questDetail.routeHeading": "Што на маршруце",
  "questDetail.routeLead": "Кропкі маршруту па парадку — што гэта за мясціны і чым яны цікавыя. Заданні і адказы застаюцца ў самім квэсце.",
  "questDetail.linksHeading": "Куды далей",
  "questDetail.linksLead": "Гэты маршрут — частка гарадскіх квэстаў Metravel. Ніжэй — астатнія квэсты гэтага горада і гарады з квэстамі побач.",
  "questDetail.cityQuests": "Усе квэсты горада: {{value1}}",
  "questDetail.nearbyCity_one": "— {{count}} квэст, {{value1}} км",
  "questDetail.nearbyCity_few": "— {{count}} квэсты, {{value1}} км",
  "questDetail.nearbyCity_many": "— {{count}} квэстаў, {{value1}} км",
  "questDetail.nearbyCity_other": "— {{count}} квэстаў, {{value1}} км",
  "questDetail.travelsHeading": "Падарожжы: {{value1}}",
  "questDetail.travelsLead": "Артыкулы падарожнікаў пра гэты горад дапамогуць дапоўніць прагулку.",
  "questDetail.touristType": "Гарадскі квэст, пешы маршрут",
} as const
