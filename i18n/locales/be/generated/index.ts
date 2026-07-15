import { achievementsGenerated1 } from './achievements_01'
import { authGenerated1 } from './auth_01'
import { calendarGenerated1 } from './calendar_01'
import { errorsGenerated1 } from './errors_01'
import { exportGenerated1 } from './export_01'
import { homeGenerated1 } from './home_01'
import { legalGenerated1 } from './legal_01'
import { mapGenerated1 } from './map_01'
import { mapGenerated2 } from './map_02'
import { mapGenerated3 } from './map_03'
import { messagesGenerated1 } from './messages_01'
import { navigationGenerated1 } from './navigation_01'
import { profileGenerated1 } from './profile_01'
import { profileGenerated2 } from './profile_02'
import { questsGenerated1 } from './quests_01'
import { questsGenerated2 } from './quests_02'
import { seoGenerated1 } from './seo_01'
import { sharedGenerated1 } from './shared_01'
import { sharedGenerated2 } from './shared_02'
import { travelGenerated1 } from './travel_01'
import { travelGenerated2 } from './travel_02'
import { travelGenerated3 } from './travel_03'
import { travelGenerated4 } from './travel_04'
import { tripsGenerated1 } from './trips_01'
import { tripsGenerated2 } from './trips_02'

export const generatedResources = {
  "achievements": { ...achievementsGenerated1 },
  "auth": { ...authGenerated1 },
  "calendar": { ...calendarGenerated1 },
  "errors": { ...errorsGenerated1 },
  "export": { ...exportGenerated1 },
  "home": { ...homeGenerated1 },
  "legal": { ...legalGenerated1 },
  "map": { ...mapGenerated1, ...mapGenerated2, ...mapGenerated3 },
  "messages": { ...messagesGenerated1 },
  "navigation": { ...navigationGenerated1 },
  "profile": { ...profileGenerated1, ...profileGenerated2 },
  "quests": { ...questsGenerated1, ...questsGenerated2 },
  "seo": { ...seoGenerated1 },
  "shared": { ...sharedGenerated1, ...sharedGenerated2 },
  "travel": { ...travelGenerated1, ...travelGenerated2, ...travelGenerated3, ...travelGenerated4 },
  "trips": { ...tripsGenerated1, ...tripsGenerated2 },
} as const
