# Child Quest Design

Use this reference for child, family, fairy-tale, park, amusement, or teen quests. Treat a family quest as a designed child experience with an explicit adult role, not as an easier adult city tour.

## Set the audience first

- Choose one primary age band. If the request spans several bands, propose separate variants instead of averaging them into one `5–14` quest.
- Record reading independence, expected adult accompaniment, group size, season, paid-access tolerance, stroller or mobility needs, and sensory constraints when known.
- Keep the self-guided route adult-accompanied unless the product and local safety review explicitly support otherwise. Never imply that a child should cross streets, approach water, enter a venue, or meet a stranger alone.

Step counts, distance and time below mirror the load-bearing age grid in
`.claude/skills/metravel-quest/SKILL.md` → `### Возрастная сетка (load-bearing)`.
If they ever disagree, that grid wins and this table is the stale copy.

| Primary age | Core steps | Target time | Walking target | Reading and puzzle contract |
| --- | ---: | ---: | ---: | --- |
| 5–7 | 6–8 | 45–60 min | ≤1.5 km | Adult reads; use a visible helper character, movement, matching, colour/shape recognition, and one decision per step. Keep answers to a tap, choice, or one familiar word. One park or pedestrian street, no roadway crossings. |
| 8–10 | 7–9 | 60–90 min | ≤2.5 km | Mix independent and adult reading; collect clues, assign team roles, and use one- or two-stage observation puzzles with frequent physical activity. Pedestrian zones, minimal signalled crossings. |
| 11–14 | 8–10 | 90–120 min | ≤4 km | Use a non-baby detective, expedition, science, urban-culture, or historical mystery tone; allow ciphers, navigation, competing hypotheses, choices, and a final meta-puzzle. |

Adjust distance downward for crowds, heat, snow, hills, ticket queues, mobility needs, or dense street crossings. Do not pad a young-child quest to the general 8–12-step adult default.

## Build one playable story arc

1. Give the player a role, concrete goal, and understandable stakes in the opening screen.
2. Make every core stop change the situation: reveal a clue, unlock a tool, eliminate a suspect, restore part of a map, or force a meaningful choice.
3. Use one repeated quest grammar that the child can learn, then vary the observation or action. Avoid eight unrelated trivia questions.
4. Place a turn or complication near the midpoint and increase agency toward the end. Do not solve the central problem before the final core stop.
5. Make the last step use clues earned earlier. A finale that merely congratulates the player is not the only payoff.
6. Keep optional venues and rest/play stops outside the clue dependency chain so closure survives a closure, queue, weather stop, or skipped ticket.

Keep prose proportional to the band: short read-aloud beats for 5–7, compact paragraphs for 8–10, and richer but scannable evidence for 11–14. Prefer dialogue, sensory detail, decisions, and visible consequences over long exposition.

## Use a child's language and attention

- Start each task with one action the child can perform now: find, choose, match, follow, point, imagine, whisper, show, or decode.
- Name the visible role or behavior before the adult category. Prefer “лев, который охраняет дорожку” to “бронзовая скульптура”, “дом с башенкой” to an unexplained architectural term, and “герой держит круг” to a material-identification quiz.
- Do not ask younger children what an object is made of unless material is unmistakable, story-critical, and taught in the same step. Words such as “бронза”, “фасад”, “барельеф”, “композиция”, and style-period labels are adult guide vocabulary by default.
- Keep one new idea per sentence for ages 5–7 and one task verb per question for ages 5–10. Read every task aloud; if the child must parse the grammar before looking around, rewrite it.
- Give information because it changes the mission. Remove dates, names, and definitions that do not unlock a clue, explain a helper, raise the stakes, or prepare the finale.
- Let fantasy create agency, not confusion. The child may help a lion find a ball or return a song to a garden, while the observable answer still comes from a real stable feature.
- For ages 11–14, allow richer terms only when they act as evidence in a mystery and are explained through context. Never turn the route into a simplified adult lecture.

## Choose themes without copying franchises

- Use public-domain fairy tales, verified local folklore, nature, transport, science, animals, city mysteries, crafts, and local urban culture as theme families.
- Anchor fantasy in a real observable feature at every stop. Label folklore and legend as such; never turn invented lore into a city fact.
- Use the structure of a familiar tale—three trials, a lost object, a transformation, a helper, a return—without copying protected characters, titles, dialogue, visual identity, or a commercial franchise.
- Check rights before naming a modern book, film, game, cartoon, mascot, or branded quest-room story. When rights are unclear, create an original role and conflict.
- Avoid horror, humiliation, threats to the child or family, realistic abduction, weapons-as-play, and forced contact with strangers. For older teens, offer suspense through uncertainty and time pressure without unsafe real-world behaviour.

## Select places as a child route

- Prefer compact clusters with many stable visible details, broad public access, shade or shelter, seating, toilets, and a clear exit. Minimize uncontrolled crossings and repeated street changes.
- Treat playgrounds as rest/reward points, not mandatory climbing tasks. Do not require a specific movable toy, occupied swing, seasonal decoration, ride, animal behaviour, or queue-dependent action.
- Treat amusement rides, trains, museums, zoos, science centres, and quest rooms as ticketed/time-gated. Use them as a separate venue edition or optional booked finale unless the quest is explicitly sold as an inside-the-venue experience.
- Recheck official hours, age/height rules, booking, accessibility, photography, seasonal operation, and ticket conditions immediately before drafting and again before publication.
- Provide a weather model: all-weather public route, seasonal route with explicit dates, or indoor alternative. Do not silently mix them.
- Mark an adult action explicitly where needed: read a passage, handle payment, choose a safe crossing, manage the map, or request a venue hint. The adult supports but does not solve the child's observation.

## Audit interaction and inclusion

- Alternate looking, moving, choosing, decoding, imagining, and cooperating. Do not make every step a count or a text-entry field.
- Give each child a useful role in group play: navigator, symbol keeper, reader, detail hunter, or answer checker.
- Make colour clues redundant with shape, position, texture, or text. Avoid tasks that depend only on height, hearing, fast reading, or fine motor control.
- Never require touching monuments, feeding animals, picking plants, entering restricted areas, photographing children, sharing personal data, or buying an item to prove completion.
- Test the answer at the child's eye level and likely viewpoint. Keep hints progressive: where to look, what category to notice, then a recovery path; do not reveal the final word immediately.

## City research seeds

This reference carries no city-specific seed table. The previous Minsk table
expired on 2026-07-14 and its Gorky Park/Planetarium and Upper City/Trinity
Suburb clusters have since shipped as `scripts/minsk-kids-zvezdochka-quest-data.js`
and `scripts/minsk-kids-quest-data.js`.

Before any creative draft, reopen current official sources for the target city and
verify the exact route, public access, schedules, tickets, age limits, and
observable details. Check the live metravel quest list first so you do not rebuild
a shipped route; treat directories and map reviews as discovery only, never as
final evidence.

## Child quest handoff checklist

- State the primary age band, reading model, adult role, group size, distance, duration, venue model, season, and weather fallback.
- Show the story beats from hook through midpoint turn to final clue payoff without drafting prose before the authority gate.
- List core versus optional stops and identify every ticket, booking, road, water, crowd, accessibility, and toilet/rest dependency.
- Demonstrate variety across observation, movement, cooperation, decision, and decoding tasks.
- Confirm that the last core step resolves the story and that no required clue depends on a ride, animal behaviour, temporary decoration, commercial booking, or protected franchise.
