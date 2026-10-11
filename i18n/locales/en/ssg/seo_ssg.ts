// SSG-only catalog (#2399): read by the SSG generator through
// `loadSsgCatalogs`; never imported by runtime resources, so it stays out of
// the client locale chunks. Client code must not reference `*Ssg:` keys.
export const seoSsgResources = {
  "questDetail.kicker": "Metravel city quest",
  "questDetail.sectionLabel": "City quest description",
  "questDetail.leadWithCity": "{{value1}} is a walking quest around {{value2}}.",
  "questDetail.lead": "{{value1}} is a walking city quest.",
  "questDetail.factCity": "City: {{value1}}",
  "questDetail.factRoute_one": "Route: {{count}} point",
  "questDetail.factRoute_few": "Route: {{count}} points",
  "questDetail.factRoute_many": "Route: {{count}} points",
  "questDetail.factRoute_other": "Route: {{count}} points",
  "questDetail.factDuration": "Time: about {{value1}}",
  "questDetail.factStart": "Start: {{value1}}",
  "questDetail.routeHeading": "What is on the route",
  "questDetail.routeLead": "The route points in order — what these places are and why they are interesting. Tasks and answers stay inside the quest.",
  "questDetail.linksHeading": "Where to go next",
  "questDetail.linksLead": "This route is part of Metravel city quests. Below are the other quests in this city and cities with quests nearby.",
  "questDetail.cityQuests": "All quests in {{value1}}",
  "questDetail.nearbyCity_one": "— {{count}} quest, {{value1}} km",
  "questDetail.nearbyCity_few": "— {{count}} quests, {{value1}} km",
  "questDetail.nearbyCity_many": "— {{count}} quests, {{value1}} km",
  "questDetail.nearbyCity_other": "— {{count}} quests, {{value1}} km",
  "questDetail.travelsHeading": "Travels: {{value1}}",
  "questDetail.travelsLead": "Traveller articles about this city will help round out the walk.",
  "questDetail.touristType": "City quest, walking route",
} as const
