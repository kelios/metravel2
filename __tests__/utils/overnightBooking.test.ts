// #1843: контракт полей брони ночёвки. Держит ровно то, из-за чего задача
// заведена: бронь принадлежит единственному типу точки, приезжает и уезжает
// нормализованной, и ни один её ключ не попадает в PUT точки другого типа —
// PUT маршрута атомарный, и лишнее поле уронило бы сохранение всего маршрута.
import type { RoutePoint } from '@/api/plannedTrips'
import {
  hasOvernightBooking,
  isOvernightPoint,
  normalizeBookingUrl,
  normalizeCheckinTime,
  overnightBookingFromBe,
  overnightBookingPayload,
  parseOvernightPrice,
  pointOvernightBooking,
} from '@/utils/overnightBooking'

const point = (over: Partial<RoutePoint> = {}): RoutePoint => ({
  id: 'p1',
  type: 'overnight',
  name: 'Ночёвка',
  description: null,
  coordinates: [6.1, 49.8],
  placeId: null,
  booking: {
    address: 'Rue de la Gare 1, Echternach',
    url: 'https://www.booking.com/hotel/lu/x.html',
    price: 84.5,
    checkinTime: '15:00',
  },
  ...over,
})

describe('#1843 время заезда', () => {
  it('приводит форму бэкенда и ручной ввод к ЧЧ:ММ', () => {
    // TimeField бэкенда отдаёт секунды, а на цифровой клавиатуре набирают точку.
    expect(normalizeCheckinTime('14:00:00')).toBe('14:00')
    expect(normalizeCheckinTime('9:05')).toBe('09:05')
    expect(normalizeCheckinTime('14.30')).toBe('14:30')
    expect(normalizeCheckinTime(' 14,30 ')).toBe('14:30')
  })

  it('отклоняет то, что временем не является', () => {
    expect(normalizeCheckinTime('24:00')).toBeNull()
    expect(normalizeCheckinTime('14:60')).toBeNull()
    expect(normalizeCheckinTime('14-00')).toBeNull()
    expect(normalizeCheckinTime('после обеда')).toBeNull()
    expect(normalizeCheckinTime('')).toBeNull()
    expect(normalizeCheckinTime(null)).toBeNull()
  })
})

describe('#1843 цена за ночь', () => {
  it('принимает запятую как десятичный разделитель и строку от DecimalField', () => {
    expect(parseOvernightPrice('42,50')).toBe(42.5)
    expect(parseOvernightPrice('42.50')).toBe(42.5)
    expect(parseOvernightPrice('84.00')).toBe(84)
    expect(parseOvernightPrice(84.5)).toBe(84.5)
    expect(parseOvernightPrice(0)).toBe(0)
  })

  it('отклоняет отрицательные, нечисловые и пустые значения', () => {
    expect(parseOvernightPrice('-5')).toBeNull()
    expect(parseOvernightPrice(-5)).toBeNull()
    expect(parseOvernightPrice('42 евро')).toBeNull()
    expect(parseOvernightPrice('')).toBeNull()
    expect(parseOvernightPrice(null)).toBeNull()
  })
})

describe('#1843 ссылка на бронь', () => {
  it('дописывает схему голому домену и сохраняет полный адрес', () => {
    expect(normalizeBookingUrl('booking.com/hotel/lu/x.html')).toBe(
      'https://booking.com/hotel/lu/x.html',
    )
    expect(normalizeBookingUrl('https://www.booking.com/hotel/lu/x.html?a=1')).toBe(
      'https://www.booking.com/hotel/lu/x.html?a=1',
    )
  })

  it('не пропускает небезопасные схемы и мусор', () => {
    // Тот же контракт внешних ссылок, что у ссылок в описании точки (#1494).
    expect(normalizeBookingUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeBookingUrl('ftp://a.b/c')).toBeNull()
    expect(normalizeBookingUrl('не ссылка')).toBeNull()
    expect(normalizeBookingUrl(null)).toBeNull()
  })
})

describe('#1843 бронь из ответа бэкенда', () => {
  it('собирает бронь из полей точки', () => {
    expect(
      overnightBookingFromBe({
        address: ' Rue de la Gare 1 ',
        booking_url: 'booking.com/hotel/lu/x.html',
        price: '84.00',
        checkin_time: '15:00:00',
      }),
    ).toEqual({
      address: 'Rue de la Gare 1',
      url: 'https://booking.com/hotel/lu/x.html',
      price: 84,
      checkinTime: '15:00',
    })
  })

  it('отдаёт null, когда бэкенд полей ещё не знает', () => {
    // До миграции #1843 развёрнутый бэкенд этих ключей не отдаёт вовсе, и точка
    // обязана нормализоваться без них, а не получить пустой блок брони.
    expect(overnightBookingFromBe({})).toBeNull()
    expect(overnightBookingFromBe({ address: '   ', booking_url: '', price: null })).toBeNull()
  })

  it('держит частично заполненную бронь', () => {
    expect(overnightBookingFromBe({ checkin_time: '15:00:00' })).toEqual({
      address: null,
      url: null,
      price: null,
      checkinTime: '15:00',
    })
  })
})

describe('#1843 бронь принадлежит только ночёвке', () => {
  it.each(['place', 'custom', 'rest'] as const)('не отдаёт бронь точке типа %s', (type) => {
    expect(isOvernightPoint(type)).toBe(false)
    // Бронь в объекте есть — но тип решает: смена типа обязана её скрыть.
    expect(pointOvernightBooking(point({ type }))).toBeNull()
  })

  it('отдаёт бронь ночёвке', () => {
    expect(pointOvernightBooking(point())).toMatchObject({ price: 84.5, checkinTime: '15:00' })
  })

  it('пустую бронь за бронь не считает', () => {
    expect(hasOvernightBooking(null)).toBe(false)
    expect(
      hasOvernightBooking({ address: null, url: null, price: null, checkinTime: null }),
    ).toBe(false)
    // Ноль — заполненная цена, а не отсутствие: `price: 0` это «бесплатно».
    expect(
      hasOvernightBooking({ address: null, url: null, price: 0, checkinTime: null }),
    ).toBe(true)
  })
})

describe('#1843 payload сохранения маршрута', () => {
  it('кладёт поля брони у ночёвки', () => {
    expect(overnightBookingPayload(point())).toEqual({
      address: 'Rue de la Gare 1, Echternach',
      booking_url: 'https://www.booking.com/hotel/lu/x.html',
      price: 84.5,
      checkin_time: '15:00',
    })
  })

  it('обнуляет поля у ночёвки без брони — иначе стереть бронь было бы нечем', () => {
    // Текстовые поля обнуляются пустой строкой: по контракту пункта 14 это
    // `blank=True, default=''` без `null=True`, и `null` отклонил бы весь PUT.
    expect(overnightBookingPayload(point({ booking: null }))).toEqual({
      address: '',
      booking_url: '',
      price: null,
      checkin_time: null,
    })
  })

  it.each(['place', 'custom', 'rest'] as const)(
    'не добавляет ни одного ключа точке типа %s',
    (type) => {
      // Regression control карточки: PUT маршрута атомарный, и поле брони у
      // точки другого типа бэкенд отклоняет вместе со всем маршрутом.
      expect(overnightBookingPayload(point({ type }))).toEqual({})
    },
  )
})
