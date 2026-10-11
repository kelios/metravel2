export interface SeasonalCivilDate {
  year: number
  month: number
  day: number
}

export interface SeasonalMonthDay {
  month: number
  day: number
}

export type SeasonalCalendarRule =
  | { kind: 'fixedAnnual'; from: SeasonalMonthDay; to: SeasonalMonthDay }
  | { kind: 'easterRelative'; calendar: 'western' | 'orthodox'; fromOffset: number; toOffset: number }

export interface SeasonalCalendarDefinition {
  id: string
  priority: number
  rules: readonly SeasonalCalendarRule[]
}

export interface SeasonalCalendarPeriod {
  id: string
  from: SeasonalCivilDate
  to: SeasonalCivilDate
}

export interface SeasonalCalendarResult {
  activeId: string | null
  windows: SeasonalCalendarPeriod[]
  currentPeriod: SeasonalCalendarPeriod | null
  nextPeriod: SeasonalCalendarPeriod | null
}

/**
 * One self-contained calendar for runtime and the pre-hydration ES5 payload.
 * Keep its body ES5-compatible: no imported helpers, closures, Date/timezones,
 * modern syntax or transpiler helpers. Civil dates are compared as Julian day
 * numbers; Julian Easter is converted through that number (never a fixed +13).
 * Gregorian computus: Meeus/Jones/Butcher; Julian computus: Meeus.
 * References: USNO's The Date of Easter and dateutil.easter documentation.
 */
export function seasonalCalendarCore(
  registry: readonly SeasonalCalendarDefinition[],
  today: SeasonalCivilDate,
): SeasonalCalendarResult {
  var floor = Math.floor
  function integer(value: number): boolean {
    return typeof value === 'number' && isFinite(value) && floor(value) === value
  }
  function validDate(value: SeasonalCivilDate): boolean {
    if (!value || !integer(value.year) || !integer(value.month) || !integer(value.day)) return false
    if (value.year < 1 || value.month < 1 || value.month > 12 || value.day < 1) return false
    var leap = value.year % 4 === 0 && (value.year % 100 !== 0 || value.year % 400 === 0)
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return value.day <= days[value.month - 1]
  }
  function dayNumber(year: number, month: number, day: number, julian: boolean): number {
    var a = floor((14 - month) / 12)
    var y = year + 4800 - a
    var m = month + 12 * a - 3
    var n = day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4)
    return julian ? n - 32083 : n - floor(y / 100) + floor(y / 400) - 32045
  }
  function civil(number: number): SeasonalCivilDate {
    var a = number + 32044
    var b = floor((4 * a + 3) / 146097)
    var c = a - floor(146097 * b / 4)
    var d = floor((4 * c + 3) / 1461)
    var e = c - floor(1461 * d / 4)
    var m = floor((5 * e + 2) / 153)
    return {
      year: 100 * b + d - 4800 + floor(m / 10),
      month: m + 3 - 12 * floor(m / 10),
      day: e - floor((153 * m + 2) / 5) + 1,
    }
  }
  function easter(year: number, orthodox: boolean): number {
    var month: number
    var day: number
    if (orthodox) {
      var ja = year % 4
      var jb = year % 7
      var jc = year % 19
      var jd = (19 * jc + 15) % 30
      var je = (2 * ja + 4 * jb - jd + 34) % 7
      month = floor((jd + je + 114) / 31)
      day = (jd + je + 114) % 31 + 1
      return dayNumber(year, month, day, true)
    }
    var a = year % 19
    var b = floor(year / 100)
    var c = year % 100
    var d = floor(b / 4)
    var e = b % 4
    var f = floor((b + 8) / 25)
    var g = floor((b - f + 1) / 3)
    var h = (19 * a + b - d - g + 15) % 30
    var i = floor(c / 4)
    var k = c % 4
    var l = (32 + 2 * e + 2 * i - h - k) % 7
    var m = floor((a + 11 * h + 22 * l) / 451)
    month = floor((h + l - 7 * m + 114) / 31)
    day = (h + l - 7 * m + 114) % 31 + 1
    return dayNumber(year, month, day, false)
  }
  if (!validDate(today)) throw new Error('Invalid seasonal civil date')
  var raw: Array<{ id: string; priority: number; from: number; to: number }> = []
  var ids: string[] = []
  var boundaries: number[] = []
  var r: number
  var q: number
  var y: number
  for (r = 0; r < registry.length; r++) {
    var definition = registry[r]
    if (!definition || typeof definition.id !== 'string' || !definition.id || ids.indexOf(definition.id) !== -1) {
      throw new Error('Invalid or duplicate seasonal id')
    }
    ids.push(definition.id)
    if (!integer(definition.priority) || !definition.rules || !definition.rules.length) {
      throw new Error('Invalid seasonal priority or rules')
    }
    for (q = 0; q < definition.rules.length; q++) {
      var rule = definition.rules[q]
      if (!rule) throw new Error('Invalid seasonal rule')
      if (rule.kind === 'fixedAnnual') {
        if (!rule.from || !rule.to ||
          !validDate({ year: 2000, month: rule.from.month, day: rule.from.day }) ||
          !validDate({ year: 2000, month: rule.to.month, day: rule.to.day })) {
          throw new Error('Invalid fixed annual seasonal rule')
        }
      } else if (rule.kind === 'easterRelative') {
        if ((rule.calendar !== 'western' && rule.calendar !== 'orthodox') ||
          !integer(rule.fromOffset) || !integer(rule.toOffset) ||
          rule.fromOffset > rule.toOffset || Math.abs(rule.fromOffset) > 366 || Math.abs(rule.toOffset) > 366) {
          throw new Error('Invalid Easter seasonal rule')
        }
      } else {
        throw new Error('Unknown seasonal rule')
      }
      for (y = today.year - 1; y <= today.year + 1; y++) {
        var from: number
        var to: number
        if (rule.kind === 'fixedAnnual') {
          var endYear = y + (rule.from.month * 100 + rule.from.day > rule.to.month * 100 + rule.to.day ? 1 : 0)
          if (!validDate({ year: y, month: rule.from.month, day: rule.from.day }) ||
            !validDate({ year: endYear, month: rule.to.month, day: rule.to.day })) continue
          from = dayNumber(y, rule.from.month, rule.from.day, false)
          to = dayNumber(endYear, rule.to.month, rule.to.day, false)
        } else {
          var sunday = easter(y, rule.calendar === 'orthodox')
          from = sunday + rule.fromOffset
          to = sunday + rule.toOffset
        }
        raw.push({ id: definition.id, priority: definition.priority, from: from, to: to })
        boundaries.push(from, to + 1)
      }
    }
  }
  // Reject ambiguity rather than allowing array order to choose a winner.
  for (r = 0; r < raw.length; r++) {
    for (q = r + 1; q < raw.length; q++) {
      if (raw[r].id !== raw[q].id && raw[r].priority === raw[q].priority &&
        raw[r].from <= raw[q].to && raw[q].from <= raw[r].to) {
        throw new Error('Ambiguous equal-priority seasonal overlap')
      }
    }
  }
  boundaries.sort(function (a, b) { return a - b })
  var periods: Array<{ id: string; from: number; to: number }> = []
  for (r = 0; r < boundaries.length - 1; r++) {
    var start = boundaries[r]
    var end = boundaries[r + 1] - 1
    if (end < start) continue
    var winner: { id: string; priority: number; from: number; to: number } | null = null
    for (q = 0; q < raw.length; q++) {
      if (raw[q].from <= start && raw[q].to >= start && (!winner || raw[q].priority > winner.priority)) winner = raw[q]
    }
    if (!winner) continue
    var previous = periods.length ? periods[periods.length - 1] : null
    if (previous && previous.id === winner.id && previous.to + 1 === start) previous.to = end
    else periods.push({ id: winner.id, from: start, to: end })
  }
  var point = dayNumber(today.year, today.month, today.day, false)
  var windows: SeasonalCalendarPeriod[] = []
  var current: SeasonalCalendarPeriod | null = null
  var next: SeasonalCalendarPeriod | null = null
  for (r = 0; r < periods.length; r++) {
    var period = { id: periods[r].id, from: civil(periods[r].from), to: civil(periods[r].to) }
    windows.push(period)
    if (periods[r].from <= point && periods[r].to >= point) current = period
    else if (!next && periods[r].from > point) next = period
  }
  return { activeId: current ? current.id : null, windows: windows, currentPeriod: current, nextPeriod: next }
}
