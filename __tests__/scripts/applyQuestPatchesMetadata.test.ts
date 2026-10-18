const { validateStep, apiPatch, applyPatch, formatPatchError } = require('../../scripts/apply-quest-patches')
const { TokenError } = require('../../scripts/lib/metravel-tool-session')

describe('existing quest point metadata patches', () => {
  const patch = (changes: Record<string, unknown>, stepId = '4-rest') => ({
    quest_id: 'demo-quest', step_db_id: 42, step_id: stepId, changes,
  })

  it.each(['required', 'optional'])('accepts a numbered point becoming %s', (role) => {
    expect(validateStep(patch({ point_role: role }), 'draft.json')).toEqual({ point_role: role })
  })

  it.each(['start', 'final', 'required ', '', null, 1])('rejects unsafe or invalid role %p', (role) => {
    expect(() => validateStep(patch({ point_role: role }), 'draft.json')).toThrow('required/optional')
  })

  it('does not turn the intro into a numbered optional point', () => {
    expect(() => validateStep(patch({ point_role: 'optional' }, 'intro'), 'draft.json')).toThrow('required/optional')
  })

  it('preserves an explicit POI clear and changed obligation in the request', async () => {
    const payload = validateStep(patch({ point_role: 'required', poi_info: null }), 'draft.json')
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 42 }) })
    await apiPatch('/api/quest-steps/42/', payload, { dryRun: false, api: 'https://example.com', session: { request } })
    expect(request).toHaveBeenCalledWith('/api/quest-steps/42/', expect.objectContaining({
      method: 'PATCH', json: { point_role: 'required', poi_info: null },
    }))
  })

  it.each([{}, [], 'null', '', false])('rejects unreviewed POI content %p', (poiInfo) => {
    expect(() => validateStep(patch({ poi_info: poiInfo }), 'draft.json')).toThrow('только null')
  })

  it('keeps publication and identity fields outside the content editor', () => {
    for (const field of ['quest', 'status', 'is_intro', 'step_id']) {
      expect(() => validateStep(patch({ [field]: 1 }), 'draft.json')).toThrow('запрещённое поле')
    }
  })

  const bundleFor = (target: Record<string, unknown>) => [{
    quest_id: 'demo-quest', steps: [{ id: 42, step_id: '4-rest', point_role: 'optional', ...target }],
  }]
  const transportFor = () => ({
    dryRun: false, api: 'https://example.com',
    session: { request: jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 42 }) }) },
  })

  it.each(['start', 'final', undefined])('rejects changing an existing %p role before writing', async (role) => {
    const transport = transportFor()
    await expect(applyPatch(patch({ point_role: 'optional' }), 'draft.json', transport, {
      fetchBundle: jest.fn().mockResolvedValue(bundleFor({ point_role: role })),
    })).rejects.toThrow('нельзя менять роль')
    expect(transport.session.request).not.toHaveBeenCalled()
  })

  it('rejects an intro even when the patch falsely labels it as an ordinary point', async () => {
    const transport = transportFor()
    await expect(applyPatch(patch({ point_role: 'required' }), 'draft.json', transport, {
      fetchBundle: jest.fn().mockResolvedValue([{ quest_id: 'demo-quest', steps: [],
        intro: JSON.stringify({ id: 42, step_id: '4-rest', point_role: 'required' }) }]),
    })).rejects.toThrow('нельзя менять роль')
    expect(transport.session.request).not.toHaveBeenCalled()
  })

  it.each([{ id: 99 }, { step_id: 'different-point' }])('rejects a mismatched target %p before writing', async (target) => {
    const transport = transportFor()
    await expect(applyPatch(patch({ point_role: 'required' }), 'draft.json', transport, {
      fetchBundle: jest.fn().mockResolvedValue(bundleFor(target)),
    })).rejects.toThrow('не совпали')
    expect(transport.session.request).not.toHaveBeenCalled()
  })

  it('updates a confirmed ordinary point and preserves the explicit POI clear', async () => {
    const transport = transportFor()
    const fetchBundle = jest.fn().mockResolvedValue(bundleFor({}))
    await applyPatch(patch({ point_role: 'required', poi_info: null }), 'draft.json', transport, { fetchBundle })
    expect(fetchBundle).toHaveBeenCalledWith('https://example.com', 'demo-quest')
    expect(transport.session.request).toHaveBeenCalledWith('/api/quest-steps/42/', {
      method: 'PATCH', json: { point_role: 'required', poi_info: null },
    })
  })

  it('checks target identity for a standalone POI clear', async () => {
    const transport = transportFor()
    await expect(applyPatch(patch({ poi_info: null }), 'draft.json', transport, {
      fetchBundle: jest.fn().mockResolvedValue(bundleFor({ step_id: 'different-point' })),
    })).rejects.toThrow('не совпали')
    expect(transport.session.request).not.toHaveBeenCalled()
  })

  it('rejects metadata for the wrong quest before writing', async () => {
    const transport = transportFor()
    await expect(applyPatch(patch({ poi_info: null }), 'draft.json', transport, {
      fetchBundle: jest.fn().mockResolvedValue([{ quest_id: 'other-quest', steps: bundleFor({})[0].steps }]),
    })).rejects.toThrow('квест не совпал')
    expect(transport.session.request).not.toHaveBeenCalled()
  })

  it('requires explicit identity before fetching a metadata target', async () => {
    const transport = transportFor()
    const fetchBundle = jest.fn()
    await expect(applyPatch({ ...patch({ poi_info: null }), quest_id: '' }, 'draft.json', transport, {
      fetchBundle,
    })).rejects.toThrow('нужны quest_id и step_id')
    expect(fetchBundle).not.toHaveBeenCalled()
    expect(transport.session.request).not.toHaveBeenCalled()
  })

  it('keeps ordinary content patches free of a new bundle request', async () => {
    const fetchBundle = jest.fn()
    await applyPatch(patch({ task: 'Observe the entrance.' }), 'draft.json', transportFor(), { fetchBundle })
    expect(fetchBundle).not.toHaveBeenCalled()
  })

  it('prints concrete local validation failures while keeping transport errors sanitized', () => {
    for (const [changes, reason] of [
      [{ poi_info: {} }, 'poi_info допускает только null'],
      [{ answer_pattern: '{not-json' }, 'answer_pattern — некорректный JSON'],
      [{ answer_pattern: '{"type":"range","value":"not-json"}' }, 'answer_pattern.value — некорректный JSON'],
    ]) {
      try {
        validateStep(patch(changes as Record<string, unknown>), 'draft.json')
        throw new Error('Expected validation to fail')
      } catch (error) {
        expect(formatPatchError(error)).toContain(reason)
      }
    }
    expect(formatPatchError(new Error('Authorization: Token private-value'))).toBe('metravel-auth: request/response')
    expect(formatPatchError(new TokenError('response', { status: 403 }))).toBe('metravel-auth: request/response (HTTP 403)')
  })

  it('dry-run still rejects wrong identities, unknown points and changes to a final role without writing', async () => {
    const transport = { ...transportFor(), dryRun: true }
    const fetchBundle = jest.fn().mockResolvedValue([{ ...bundleFor({ point_role: 'final' })[0], id: 7 }])
    await expect(applyPatch(patch({ poi_info: null }, 'wrong-point'), 'draft.json', transport, { fetchBundle })).rejects.toThrow('не совпали')
    await expect(applyPatch({ ...patch({ task: 'Look.' }), step_db_id: 99 }, 'draft.json', transport, { fetchBundle })).rejects.toThrow('не совпали')
    await expect(applyPatch(patch({ point_role: 'optional' }), 'draft.json', transport, { fetchBundle })).rejects.toThrow('нельзя менять роль')
    await expect(applyPatch({ quest_id: 'demo-quest', quest_db_id: 8, changes: { title: 'Title' } }, 'draft.json', transport, { fetchBundle })).rejects.toThrow('quest_db_id')
    expect(transport.session.request).not.toHaveBeenCalled()
  })
})
