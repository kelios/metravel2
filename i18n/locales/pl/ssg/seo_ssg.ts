// SSG-only catalog (#2399): read by the SSG generator through
// `loadSsgCatalogs`; never imported by runtime resources, so it stays out of
// the client locale chunks. Client code must not reference `*Ssg:` keys.
export const seoSsgResources = {
  "questDetail.kicker": "Miejski quest Metravel",
  "questDetail.sectionLabel": "Opis miejskiego questu",
  "questDetail.leadWithCity": "{{value1}} — pieszy quest po mieście {{value2}}.",
  "questDetail.lead": "{{value1}} — pieszy quest miejski.",
  "questDetail.factCity": "Miasto: {{value1}}",
  "questDetail.factRoute_one": "Trasa: {{count}} punkt",
  "questDetail.factRoute_few": "Trasa: {{count}} punkty",
  "questDetail.factRoute_many": "Trasa: {{count}} punktów",
  "questDetail.factRoute_other": "Trasa: {{count}} punktów",
  "questDetail.factDuration": "Czas: około {{value1}}",
  "questDetail.factStart": "Start: {{value1}}",
  "questDetail.routeHeading": "Co jest na trasie",
  "questDetail.routeLead": "Punkty trasy po kolei — co to za miejsca i dlaczego są ciekawe. Zadania i odpowiedzi zostają w samym queście.",
  "questDetail.linksHeading": "Dokąd dalej",
  "questDetail.linksLead": "Ta trasa jest częścią miejskich questów Metravel. Poniżej — pozostałe questy w tym mieście i miasta z questami w pobliżu.",
  "questDetail.cityQuests": "Wszystkie questy w mieście: {{value1}}",
  "questDetail.nearbyCity_one": "— {{count}} quest, {{value1}} km",
  "questDetail.nearbyCity_few": "— {{count}} questy, {{value1}} km",
  "questDetail.nearbyCity_many": "— {{count}} questów, {{value1}} km",
  "questDetail.nearbyCity_other": "— {{count}} questów, {{value1}} km",
  "questDetail.travelsHeading": "Podróże: {{value1}}",
  "questDetail.travelsLead": "Artykuły podróżników o tym mieście pomogą uzupełnić spacer.",
  "questDetail.touristType": "Miejski quest, trasa piesza",
} as const
