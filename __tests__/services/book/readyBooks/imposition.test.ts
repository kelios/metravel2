import {buildImpositionPlan} from '../../../../services/book/readyBooks/imposition';

describe('A4 home imposition at physical size', () => {
  it.each([
    ['pocket-150x100', 'home-rings'], ['album-a5', 'home-rings'], ['album-a5', 'home-sewn'],
  ] as const)('%s %s places all 56 folios exactly once without scaling', (profileId, mode) => {
    const plan = buildImpositionPlan({profileId, mode});
    expect(plan.scale).toBe(1);
    expect(plan.sheets).toHaveLength(14);
    const placements = plan.sheets.flatMap(sheet => [...sheet.front, ...sheet.back]);
    expect(placements.map(p => p.folio).sort((a, b) => a - b)).toEqual(Array.from({length: 56}, (_, i) => i + 1));
    for (const p of placements) {
      expect(p.xMm).toBeGreaterThanOrEqual(0);
      expect(p.yMm).toBeGreaterThanOrEqual(0);
      expect(p.xMm + plan.pageMm[0]).toBeLessThanOrEqual(plan.sheetMm[0]);
      expect(p.yMm + plan.pageMm[1]).toBeLessThanOrEqual(plan.sheetMm[1]);
      expect(p.rotation).toBe(0);
    }
  });

  it.each(['pocket-150x100', 'album-a5'] as const)('keeps %s cut leaves front/back physically aligned', profileId => {
    const plan = buildImpositionPlan({profileId, mode: 'home-rings'});
    for (const sheet of plan.sheets) {
      for (const front of sheet.front) {
        const back = sheet.back.find(p => p.folio === front.folio + 1)!;
        expect(back.yMm).toBe(front.yMm);
        expect(back.xMm).toBeCloseTo(plan.sheetMm[0] - front.xMm - plan.pageMm[0]);
      }
    }
    expect(plan.duplexFlip).toBe(profileId === 'album-a5' ? 'short-edge' : 'long-edge');
  });

  it('reconstructs four independently nested signatures, including both sides of the centre fold', () => {
    const plan = buildImpositionPlan({profileId: 'album-a5', mode: 'home-sewn'});
    expect(plan.signatures).toEqual([16, 16, 16, 8]);
    let offset = 0;
    let first = 1;
    for (const size of plan.signatures!) {
      const leaves: number[][] = [];
      const sheets = plan.sheets.slice(offset, offset + size / 4);
      // Turn each sheet over about the short edge, fold left behind right,
      // nest outer-to-inner: right leaf before, left leaf after the fold.
      for (const sheet of sheets) leaves.push([sheet.front[1].folio, sheet.back[0].folio]);
      for (const sheet of [...sheets].reverse()) leaves.push([sheet.back[1].folio, sheet.front[0].folio]);
      expect(leaves.flat()).toEqual(Array.from({length: size}, (_, i) => first + i));
      offset += size / 4;
      first += size;
    }
  });

  it.each(['pocket-150x100', 'album-a5'] as const)('numbers %s cover separately and supplies measurable control', profileId => {
    const plan = buildImpositionPlan({profileId, mode: 'home-rings', component: 'cover'});
    expect(plan.sheets).toHaveLength(1);
    expect(plan.sheets.flatMap(s => [...s.front, ...s.back]).map(p => p.folio).sort()).toEqual([1, 2, 3, 4]);
    expect(plan.control).toEqual({rulerMm: 50, toleranceMm: 1});
  });

  it('rejects the 300 mm pocket sewn spread and sewn cover instead of shrinking', () => {
    expect(() => buildImpositionPlan({profileId: 'pocket-150x100', mode: 'home-sewn'})).toThrow('300 mm');
    expect(() => buildImpositionPlan({profileId: 'album-a5', mode: 'home-sewn', component: 'cover'})).toThrow('A5 body');
  });
});
