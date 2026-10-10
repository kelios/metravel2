// Production never serves development fixtures. Named getters let API modules
// load normally, but fail loudly if a future fallback reaches a fixture.
Object.defineProperty(exports, '__esModule', { value: true })
for (const name of [
  'MOCK_PUBLIC_TRIPS', 'MOCK_MY_APPLICATIONS', 'MOCK_TRIP_APPLICATIONS',
  'MOCK_TRIP_NOTIFICATIONS', 'MOCK_PLANNED_TRIPS', 'MOCK_ROUTE_TEMPLATES',
  'MOCK_TRIP_SUGGESTIONS', 'cloneTrip', 'MOCK_BADGES', 'MOCK_RANK',
  'MOCK_ACTIVITY_TYPES', 'MOCK_MY_ACHIEVEMENTS', 'MOCK_PEER_CATALOG',
  'MOCK_PEER_RECEIVED', 'MOCK_TRAVEL_PEER_RECEIVED', 'MOCK_PUBLIC_ACHIEVEMENTS',
  'MOCK_RARE_AWARDS', 'MOCK_RARE_AWARD_CATALOG', 'MOCK_PLACE_FIRST_BADGES',
  'MOCK_GAMIFICATION_PROGRESS', 'MOCK_CHARACTER_STATE',
]) {
  Object.defineProperty(exports, name, {
    enumerable: true,
    get() { throw new Error(`[config] Development fixture ${name} is forbidden in production`) },
  })
}
