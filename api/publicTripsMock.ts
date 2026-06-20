// api/publicTripsMock.ts
// Мок-данные каталога публичных поездок «Поехали со мной» для локальной разработки
// и DEV-фолбэка (см. api/publicTrips.ts). Удаляются, когда BE #407/#408/#409
// задеплоен и верифицирован. Картинки — публичные обложки существующих travel.

import type {
  PublicTrip,
  TripApplication,
  TripNotification,
} from '@/api/publicTrips';

const COVER_1 =
  'https://metravel.by/media/CACHE/images/travelImage/2023/05/braslav/cover.jpg';

export const MOCK_PUBLIC_TRIPS: PublicTrip[] = [
  {
    id: 9001,
    slug: 'braslav-weekend',
    title: 'Браславские озёра — выходные с палаткой',
    coverUrl: COVER_1,
    region: 'Витебская область',
    tripType: 'Поход',
    startDate: '2026-07-18',
    endDate: '2026-07-20',
    organizer: { id: 1, name: 'Мария', avatarUrl: null },
    seatsTotal: 6,
    seatsTaken: 2,
    status: 'open',
    description:
      'Едем на Браславские озёра на два дня: байдарки, ночёвка в палатках, костёр и закат над водой. Нужен свой спальник; снаряжение для байдарок общее. Темп спокойный, подойдёт новичкам.',
    featured: true,
    myApplicationStatus: null,
    isOwner: false,
    meetingPoint: null,
    contactNote: null,
  },
  {
    id: 9002,
    slug: 'minsk-photowalk',
    title: 'Фотопрогулка по закоулкам старого Минска',
    coverUrl: null,
    region: 'Минск',
    tripType: 'Прогулка',
    startDate: '2026-06-28',
    endDate: null,
    organizer: { id: 42, name: 'Андрей', avatarUrl: null },
    seatsTotal: 4,
    seatsTaken: 4,
    status: 'full',
    description:
      'Однодневная фотопрогулка по дворикам и крышам центра. Берём камеры/телефоны, ищем нетуристические ракурсы. Маршрут 6 км пешком.',
    featured: false,
    myApplicationStatus: 'pending',
    isOwner: false,
    meetingPoint: null,
    contactNote: null,
  },
  {
    id: 9003,
    slug: 'naroch-bike',
    title: 'Велокольцо вокруг Нарочи',
    coverUrl: null,
    region: 'Минская область',
    tripType: 'Велопоход',
    startDate: '2026-08-09',
    endDate: '2026-08-10',
    organizer: { id: 7, name: 'Вы', avatarUrl: null },
    seatsTotal: 8,
    seatsTaken: 3,
    status: 'open',
    description:
      'Велосипедное кольцо вокруг озера Нарочь (~90 км за два дня) с ночёвкой на турбазе. Нужен исправный велосипед и базовый опыт длинных дистанций.',
    featured: false,
    myApplicationStatus: null,
    isOwner: true,
    meetingPoint: 'Стоянка у санатория «Нарочь», 9:00',
    contactNote: 'Чат участников в Telegram открывается после одобрения заявки.',
  },
  {
    id: 9004,
    slug: 'grodno-architecture',
    title: 'Гродно: архитектурный уикенд (завершён)',
    coverUrl: null,
    region: 'Гродненская область',
    tripType: 'Экскурсия',
    startDate: '2026-05-17',
    endDate: '2026-05-18',
    organizer: { id: 11, name: 'Ольга', avatarUrl: null },
    seatsTotal: 5,
    seatsTaken: 5,
    status: 'completed',
    description:
      'Прошедшая поездка по архитектуре Гродно: костёлы, синагога, старый и новый замки. Оставлена для примера завершённой поездки.',
    featured: false,
    myApplicationStatus: 'approved',
    isOwner: false,
    meetingPoint: 'Площадь Ленина, у фонтана',
    contactNote: 'Поездка завершена.',
  },
];

export const MOCK_MY_APPLICATIONS: TripApplication[] = [
  {
    id: 5001,
    tripId: 9002,
    tripTitle: 'Фотопрогулка по закоулкам старого Минска',
    applicant: {
      id: 0,
      name: 'Вы',
      avatarUrl: null,
      activitySummary: null,
      badges: [],
    },
    message: 'Снимаю на плёнку, давно хотел поснимать дворики. Возьмите!',
    socialLinks: ['https://instagram.com/example'],
    status: 'pending',
    createdAt: '2026-06-19T10:00:00Z',
  },
  {
    id: 5002,
    tripId: 9004,
    tripTitle: 'Гродно: архитектурный уикенд (завершён)',
    applicant: {
      id: 0,
      name: 'Вы',
      avatarUrl: null,
      activitySummary: null,
      badges: [],
    },
    message: 'Очень люблю Гродно, буду рад компании.',
    socialLinks: [],
    status: 'approved',
    createdAt: '2026-05-10T12:30:00Z',
  },
];

// Заявки на поездку 9003 (где текущий пользователь — организатор).
export const MOCK_TRIP_APPLICATIONS: TripApplication[] = [
  {
    id: 6001,
    tripId: 9003,
    tripTitle: 'Велокольцо вокруг Нарочи',
    applicant: {
      id: 101,
      name: 'Дмитрий К.',
      avatarUrl: null,
      activitySummary: '12 поездок · 3 квеста',
      badges: ['explorer', 'cyclist'],
    },
    message: 'Катаю по 100 км в выходные, велосипед шоссейный. Готов помочь с логистикой.',
    socialLinks: ['https://strava.com/athletes/example'],
    status: 'new',
    createdAt: '2026-06-18T08:15:00Z',
  },
  {
    id: 6002,
    tripId: 9003,
    tripTitle: 'Велокольцо вокруг Нарочи',
    applicant: {
      id: 102,
      name: 'Светлана М.',
      avatarUrl: null,
      activitySummary: '4 поездки',
      badges: ['newcomer'],
    },
    message: 'Опыта длинных дистанций мало, но очень хочу попробовать. Темп подскажете?',
    socialLinks: [],
    status: 'pending',
    createdAt: '2026-06-18T19:40:00Z',
  },
  {
    id: 6003,
    tripId: 9003,
    tripTitle: 'Велокольцо вокруг Нарочи',
    applicant: {
      id: 103,
      name: 'Игорь П.',
      avatarUrl: null,
      activitySummary: '27 поездок · 9 квестов',
      badges: ['explorer', 'cyclist', 'pathfinder'],
    },
    message: 'Был на Нарочи в том году, знаю дорогу. С радостью поеду.',
    socialLinks: [],
    status: 'approved',
    createdAt: '2026-06-17T14:05:00Z',
  },
];

export const MOCK_TRIP_NOTIFICATIONS: TripNotification[] = [
  {
    id: 7001,
    kind: 'new_application',
    tripId: 9003,
    tripTitle: 'Велокольцо вокруг Нарочи',
    applicationId: 6001,
    status: null,
    message: 'Дмитрий К. подал заявку на «Велокольцо вокруг Нарочи»',
    createdAt: '2026-06-18T08:15:00Z',
    read: false,
  },
  {
    id: 7002,
    kind: 'status_change',
    tripId: 9004,
    tripTitle: 'Гродно: архитектурный уикенд (завершён)',
    applicationId: 5002,
    status: 'approved',
    message: 'Ваша заявка на «Гродно: архитектурный уикенд» одобрена',
    createdAt: '2026-05-12T09:00:00Z',
    read: true,
  },
];
