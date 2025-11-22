import http from 'k6/http';
import { check, sleep } from 'k6';

// Базовый URL прод-сайта
const BASE_URL = 'https://metravel.by';

// Пример простых валидных параметров
const TRAVELS_PATH = '/api/travels/';
const TRAVELS_FOR_MAP_PATH = '/api/travels/search_travels_for_map';
const TRAVELS_NEAR_ROUTE_PATH = '/api/travels/near-route/';

export const options = {
  discardResponseBodies: true,
  thresholds: {
    http_req_failed: ['rate<0.05'], // <5% ошибок
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
  },
  scenarios: {
    mixed_load: {
      executor: 'constant-arrival-rate',
      rate: 100,        // целевые ~100 запросов в секунду
      timeUnit: '1s',
      duration: '10m', // 10 минут
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hitTravelsList() {
  const page = randomInt(1, 5);
  const perPage = 12;
  const where = JSON.stringify({ moderation: 1, publish: 1 });

  const url = `${BASE_URL}${TRAVELS_PATH}?page=${page}&perPage=${perPage}&query=&where=${encodeURIComponent(
    where,
  )}`;

  const res = http.get(url, { timeout: '10s' });

  check(res, {
    'travels: status 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });
}

function hitTravelsForMap() {
  const lat = 53.9 + Math.random() * 0.2 - 0.1; // вокруг Минска
  const lng = 27.56 + Math.random() * 0.2 - 0.1;
  const radius = [60, 100, 200][randomInt(0, 2)];

  const payload = {
    page: 1,
    perPage: 100,
    lat: lat.toFixed(5),
    lng: lng.toFixed(5),
    radius: String(radius),
    where: {},
  };

  const res = http.post(`${BASE_URL}${TRAVELS_FOR_MAP_PATH}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '15s',
  });

  check(res, {
    'travelsForMap: status 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });
}

function hitTravelsNearRoute() {
  // Простейший маршрут из двух точек около Минска
  const route = [
    [53.9, 27.56],
    [53.93, 27.6],
  ];

  const payload = {
    points: route,
    max_distance_km: 2,
  };

  const res = http.post(`${BASE_URL}${TRAVELS_NEAR_ROUTE_PATH}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '15s',
  });

  check(res, {
    'travelsNearRoute: status 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });
}

export default function () {
  const r = Math.random();

  if (r < 0.6) {
    hitTravelsList();
  } else if (r < 0.9) {
    hitTravelsForMap();
  } else {
    hitTravelsNearRoute();
  }

  // Небольшая пауза, чтобы вести себя более "по-человечески"
  sleep(0.1);
}
