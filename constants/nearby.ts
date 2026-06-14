/**
 * Shared "nearby" semantics for travel detail sections.
 *
 * The backend "near" search radius is not a fixed value the frontend can rely on
 * (cards can come back from 200–250 km), so the user-facing label intentionally
 * avoids a hard number. The quest eyebrow uses the same threshold so the meaning
 * of "рядом" stays consistent across sections.
 */

// Distance (km) under which a quest is still labelled as being "рядом".
export const NEARBY_QUEST_THRESHOLD_KM = 50

// Distance (km) under which a quest is treated as being in the same city.
export const SAME_CITY_THRESHOLD_KM = 1.5

// Non-misleading subtitle for the "near" travels list.
export const NEARBY_TRAVELS_SUBTITLE = 'Маршруты поблизости'
