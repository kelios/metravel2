#!/usr/bin/env node
'use strict'

// Смоук помощника прод-приёмки (#2074) и образец пробы:
//   node e2e/prod-probe/smoke.js [--fresh] [--viewport=narrow|mobile|desktop] [--trip=<id>]
//
// Открывает план поездки e2e-аккаунта 104 на https://metravel.by, печатает одну
// JSON-строку: выкаченный sha, user id, была ли сессия из кэша, баннер согласия,
// localStorage и запросы `/api/trips/` со статусами. Секретов в выводе нет.
// Код выхода 1 — сессия не авторизована, баннер виден или запросы поездок не 2xx.

const {
  openProdProbe,
  readLocalStorage,
  captureRequests,
  buildSource,
  CONSENT_KEY,
  PROBE_ACCOUNT_ID,
  ProdProbeError,
  formatProbeError,
} = require('./prodProbe')

function parseArgs(argv) {
  const args = { fresh: false, viewport: 'desktop', trip: null }
  for (const arg of argv) {
    if (arg === '--fresh') args.fresh = true
    else if (arg.startsWith('--viewport=')) args.viewport = arg.slice('--viewport='.length)
    else if (arg.startsWith('--trip=')) args.trip = arg.slice('--trip='.length)
    else throw new ProdProbeError(`неизвестный аргумент ${arg}`)
  }
  return args
}

async function firstOwnTripId(probe) {
  const res = await probe.context.request.get(`${probe.baseUrl}/api/trips/planned/me/`)
  if (!res.ok()) throw new ProdProbeError(`/api/trips/planned/me/: HTTP ${res.status()}`)
  const json = await res.json()
  const list = Array.isArray(json) ? json : json?.results || []
  if (!list.length) throw new ProdProbeError('у e2e-аккаунта нет планов поездки — передай --trip=<id>')
  return String(list[0].id)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const build = await buildSource()
  const probe = await openProdProbe({ viewport: args.viewport, fresh: args.fresh })
  try {
    const tripId = args.trip || (await firstOwnTripId(probe))
    const trips = captureRequests(probe.page, '/api/trips/')
    await probe.goto(`/trips/plan/${tripId}`)
    trips.stop()

    const storage = await readLocalStorage(probe.page, [CONSENT_KEY, 'userId'])
    const consentBannerVisible = await probe.page
      .getByTestId('consent-banner')
      .isVisible()
      .catch(() => false)
    const requests = trips.summary()
    const report = {
      baseUrl: probe.baseUrl,
      buildSha: build.sha,
      userId: probe.userId,
      reusedSession: probe.reusedSession,
      viewport: args.viewport,
      tripId,
      pageUserId: storage.userId,
      consentBannerVisible,
      consent: storage[CONSENT_KEY] ? JSON.parse(storage[CONSENT_KEY]) : null,
      tripRequests: requests,
    }
    console.log(JSON.stringify(report, null, 2))

    const ok =
      storage.userId === PROBE_ACCOUNT_ID &&
      !consentBannerVisible &&
      requests.length > 0 &&
      requests.every((r) => typeof r.status === 'number' && r.status < 400)
    process.exitCode = ok ? 0 : 1
  } finally {
    await probe.close()
  }
}

main().catch((error) => {
  // Не `error.message`: у ошибок Playwright в нём «Call log» с cookie сессии.
  console.error(`[prod-probe] ${formatProbeError(error)}`)
  process.exitCode = 1
})
