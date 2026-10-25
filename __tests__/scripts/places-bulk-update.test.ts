import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir } from './cli-test-utils'

const { CLI_SPEC, ENDPOINT, buildRequestBody, loadPlan, sendPlan, summarize, validateReport } = require('../../scripts/places-bulk-update')
const { ExpectedFailureError, UsageError, parseCliTokens } = require('../../scripts/lib/cli-contract')

const planDir = makeTempDir('places-bulk-update-')
let planCount = 0
afterAll(() => removeDir(planDir))

const writePlan = (payload: unknown): string => {
  const file = path.join(planDir, `plan-${planCount++}.json`)
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8')
  return file
}

describe('places-bulk-update plan validation', () => {
  it('normalizes a rename + category item and drops review-only fields', () => {
    const file = writePlan({
      version: 1,
      items: [{
        id: 2985,
        expected_address: 'Старый дворец',
        address: '  Дворец Монюшко-Ваньковичей   в Смиловичах ',
        add_category_ids: [118, 33, 33],
        remove_category_ids: [],
        reason: 'ревью',
        source: 'OSM',
      }],
    })
    expect(loadPlan(file)).toEqual([{
      id: 2985,
      expected_address: 'Старый дворец',
      address: 'Дворец Монюшко-Ваньковичей в Смиловичах',
      add_category_ids: [33, 118],
    }])
  })

  it('accepts an address equal to expected_address (canonical Place.address resync)', () => {
    const file = writePlan([{ id: 2986, expected_address: 'Дворец', address: 'Дворец' }])
    expect(loadPlan(file)).toEqual([{ id: 2986, expected_address: 'Дворец', address: 'Дворец' }])
  })

  it('accepts a bare array of items and category-only changes', () => {
    const file = writePlan([{ id: 421, add_category_ids: [43] }])
    expect(loadPlan(file)).toEqual([{ id: 421, add_category_ids: [43] }])
  })

  it.each([
    [{ items: [] }, 'no items'],
    [{ items: [{ id: 0, address: 'x' }] }, 'positive integer'],
    [{ items: [{ id: 1, address: 'a' }, { id: 1, address: 'b' }] }, 'listed twice'],
    [{ items: [{ id: 1, address: '   ' }] }, 'is empty'],
    [{ items: [{ id: 1, address: 'x'.repeat(256) }] }, 'longer than 255'],
    [{ items: [{ id: 1 }] }, 'changes nothing'],
    [{ items: [{ id: 1, add_category_ids: [5], remove_category_ids: [5] }] }, 'adds and removes the same category'],
    [{ items: [{ id: 1, add_category_ids: ['5'] }] }, 'non-integer id'],
  ])('rejects an invalid plan %j', (payload, message) => {
    expect(() => loadPlan(writePlan(payload))).toThrow(UsageError)
    expect(() => loadPlan(writePlan(payload))).toThrow(message)
  })

  it('refuses a plan above the single-request limit', () => {
    const items = Array.from({ length: 3001 }, (_, index) => ({ id: index + 1, address: `Точка ${index + 1}` }))
    expect(() => loadPlan(writePlan({ items }))).toThrow('limit is 3000')
  })
})

describe('places-bulk-update request contract', () => {
  it('sends dry-run without a digest and apply with the reviewed digest', () => {
    const items = [{ id: 1, address: 'Новое' }]
    expect(buildRequestBody(items, { apply: false })).toEqual({ items, apply: false })
    expect(buildRequestBody(items, { apply: true, expectedPlanSha256: 'AB'.repeat(32) }))
      .toEqual({ items, apply: true, expected_plan_sha256: 'ab'.repeat(32) })
  })

  it('posts the whole plan in one request to the bulk endpoint', async () => {
    const request = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ mode: 'dry-run', inspected: 1, changed: 1, plan_sha256: 'f'.repeat(64), items: [{ id: 1, status: 'changed' }] }),
    })
    const body = buildRequestBody([{ id: 1, address: 'Новое' }], { apply: false })
    const report = await sendPlan(body, { session: { request } })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/api${ENDPOINT}$`)), { method: 'POST', json: body })
    expect(report.plan_sha256).toBe('f'.repeat(64))
    expect(summarize(report)).toEqual({ changed: 1 })
  })

  it('keeps the per-item report from a 422 reply so rejected ids are shown', async () => {
    const reply = { mode: 'dry-run', inspected: 1, changed: 0, plan_sha256: 'e'.repeat(64), items: [{ id: 1, status: 'conflict', error: 'address changed' }] }
    const request = jest.fn().mockResolvedValue({ status: 422, text: async () => JSON.stringify(reply) })
    const report = await sendPlan({ items: [{ id: 1, address: 'x' }], apply: false }, { session: { request } })
    expect(report).toMatchObject({ http_status: 422, items: [{ id: 1, status: 'conflict' }] })
    expect(summarize(report)).toEqual({ conflict: 1 })
  })

  it.each([
    [403, 'staff'],
    [404, 'не выкачен'],
    [500, 'HTTP 500'],
  ])('turns HTTP %s into a reported failure', async (status, message) => {
    const request = jest.fn().mockResolvedValue({ status, text: async () => 'boom' })
    await expect(sendPlan({ items: [], apply: false }, { session: { request } })).rejects.toThrow(ExpectedFailureError)
    await expect(sendPlan({ items: [], apply: false }, { session: { request } })).rejects.toThrow(message)
  })
})

describe('places-bulk-update response envelope', () => {
  const sent = [{ id: 1, address: 'Новое' }, { id: 2, add_category_ids: [5] }]
  const digest = 'c'.repeat(64)
  const ok = { mode: 'dry-run', plan_sha256: digest, items: [{ id: 1, status: 'changed' }, { id: 2, status: 'unchanged' }] }

  it('accepts a report that covers every sent item in the requested mode', () => {
    expect(() => validateReport(ok, sent, { apply: false })).not.toThrow()
    expect(() => validateReport({ ...ok, mode: 'apply' }, sent, { apply: true, expectedPlanSha256: digest.toUpperCase() })).not.toThrow()
  })

  it('refuses an apply that the backend answered as a dry-run', () => {
    expect(() => validateReport(ok, sent, { apply: true, expectedPlanSha256: digest })).toThrow('mode=dry-run to a apply request')
  })

  it.each([
    [{ detail: 'ok' }, 'no items[]'],
    [{ plan_sha256: digest, items: [null] }, 'no items[]'],
    [{ items: ok.items }, 'no valid plan_sha256'],
    [{ ...ok, items: [ok.items[0]] }, 'omits 1 of 2 items (ids 2)'],
  ])('refuses a green exit over a broken envelope %j', (report, message) => {
    expect(() => validateReport(report, sent, { apply: false })).toThrow(ExpectedFailureError)
    expect(() => validateReport(report, sent, { apply: false })).toThrow(message)
  })

  it('refuses an apply whose digest differs from the reviewed one', () => {
    expect(() => validateReport({ ...ok, mode: 'apply' }, sent, { apply: true, expectedPlanSha256: 'd'.repeat(64) })).toThrow('differs from the reviewed')
  })
})

describe('places-bulk-update CLI flags', () => {
  it('parses plan, apply and digest flags', () => {
    const parsed = parseCliTokens(['--plan', 'p.json', '--apply', '--expected-plan-sha256', 'a'.repeat(64)], CLI_SPEC)
    expect(parsed).toMatchObject({ plan: 'p.json', apply: true, expectedPlanSha256: 'a'.repeat(64) })
  })

  it('rejects an unknown flag instead of ignoring it', () => {
    expect(() => parseCliTokens(['--plan', 'p.json', '--dry-runn'], CLI_SPEC)).toThrow(UsageError)
  })
})
