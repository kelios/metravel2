import { authStaticResources } from './auth_static'
import { calendarStaticResources } from './calendar_static'
import { errorsStaticResources } from './errors_static'
import { homeStaticResources } from './home_static'
import { legalStaticResources } from './legal_static'
import { navigationStaticResources } from './navigation_static'
import { seoStaticResources } from './seo_static'
import { sharedStaticResources } from './shared_static'
import { tripsStaticResources } from './trips_static'

export const staticResources = {
  authStatic: authStaticResources,
  calendarStatic: calendarStaticResources,
  errorsStatic: errorsStaticResources,
  homeStatic: homeStaticResources,
  legalStatic: legalStaticResources,
  navigationStatic: navigationStaticResources,
  seoStatic: seoStaticResources,
  sharedStatic: sharedStaticResources,
  tripsStatic: tripsStaticResources,
} as const
