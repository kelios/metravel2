import { applyBackwardFloatWrap, applySmartImageLayout } from '@/utils/richTextImageLayout';

// #1623: `applyBackwardFloatWrap` is a RENDER-ONLY post-pass over the output
// of `applySmartImageLayout`. It must never be imported by
// `hooks/useTravelFormPersistence.ts` or `services/pdf-export/**` — its job
// is to fix the on-screen wrap for a float that has nothing wrappable after
// it, without ever touching what gets persisted or printed.
const portrait = (src: string) =>
  `<p><img src="${src}" width="600" height="900"></p>`;

const explicitRight = (src: string) =>
  `<p class="img-float-right figure-portrait"><img src="${src}" width="600" height="900"></p>`;

const explicitLeft = (src: string) =>
  `<p class="img-float-left figure-portrait"><img src="${src}" width="600" height="900"></p>`;

const longParagraph = (marker: string) =>
  `<p>${marker} длинный абзац текста, продолжающий заполнять колонку и создающий достаточно строк, чтобы фотография портретного формата имела рядом реальный текст для обтекания.</p>`;

const shortParagraph = '<p>Короткая подпись.</p>';
const heading = '<h2>Заголовок раздела</h2>';

describe('applyBackwardFloatWrap (#1623, render-only)', () => {
  it('swaps the float before a long preceding paragraph when a heading follows', () => {
    const html = applySmartImageLayout(`${longParagraph('A')}${portrait('gate.jpg')}${heading}`);
    const result = applyBackwardFloatWrap(html);

    const floatIndex = result.indexOf('img-float-right');
    const paragraphIndex = result.indexOf('A длинный абзац');
    const headingIndex = result.indexOf('Заголовок раздела');

    expect(floatIndex).toBeGreaterThan(-1);
    expect(floatIndex).toBeLessThan(paragraphIndex);
    expect(paragraphIndex).toBeLessThan(headingIndex);
  });

  it('swaps the float before a long preceding paragraph at end of content', () => {
    const html = applySmartImageLayout(`${longParagraph('A')}${portrait('gate.jpg')}`);
    const result = applyBackwardFloatWrap(html);

    const floatIndex = result.indexOf('img-float-right');
    const paragraphIndex = result.indexOf('A длинный абзац');
    expect(floatIndex).toBeGreaterThan(-1);
    expect(floatIndex).toBeLessThan(paragraphIndex);
  });

  it('does NOT swap a short preceding paragraph (negative control)', () => {
    const html = applySmartImageLayout(`${shortParagraph}${portrait('gate.jpg')}${heading}`);
    const result = applyBackwardFloatWrap(html);

    const floatIndex = result.indexOf('img-float-right');
    const paragraphIndex = result.indexOf('Короткая подпись');
    expect(floatIndex).toBeGreaterThan(-1);
    expect(paragraphIndex).toBeLessThan(floatIndex);
  });

  it('does NOT touch a float that already has a following paragraph (#1602 working case)', () => {
    const html = applySmartImageLayout(
      `${longParagraph('A')}${portrait('gate.jpg')}${longParagraph('B')}${heading}`,
    );
    const before = html;
    const after = applyBackwardFloatWrap(html);
    expect(after).toBe(before);
  });

  it('treats an editor-inserted empty <p>&nbsp;</p> as NOT a real following paragraph (P3)', () => {
    const html = applySmartImageLayout(`${longParagraph('A')}${portrait('gate.jpg')}`) + '<p>&nbsp;</p>' + heading;
    const result = applyBackwardFloatWrap(html);

    const floatIndex = result.indexOf('img-float-right');
    const paragraphIndex = result.indexOf('A длинный абзац');
    expect(floatIndex).toBeGreaterThan(-1);
    expect(floatIndex).toBeLessThan(paragraphIndex);
  });

  // ---------------------------------------------------------------------
  // #1623 code-review-gate finding (P1, blocking): interleaved fixture
  // [A][photo1][M][photo2][heading]. A naive backward swap hands the
  // ALREADY-CLAIMED middle paragraph M (photo1's forward wrap target) to
  // photo2 as well, leaving photo1 and photo2 adjacent. If that ever fed
  // back into `applySmartImageLayout` (it must not, but this proves the
  // output itself is never in that broken shape), the next pass would
  // buffer the two adjacent single images as a GROUP
  // (`img-pair-portraits`/`img-row-2`), destroying the author-assigned
  // sides. This is the mutation-proof fixture: MUST fail on the naive
  // approach and pass with `isClaimed` guarding the swap.
  // ---------------------------------------------------------------------
  describe('перемежающаяся фикстура [A][фото1][M][фото2][heading] (мутационная проба)', () => {
    const interleavedHtml = () =>
      applySmartImageLayout(
        `${longParagraph('A')}${explicitRight('one.jpg')}${longParagraph('M')}${explicitLeft('two.jpg')}${heading}`,
      );

    it('leaves photo1 wrapping M and does NOT relocate photo2 onto the already-claimed M', () => {
      const html = interleavedHtml();
      const result = applyBackwardFloatWrap(html);

      // Both explicit sides must survive untouched.
      expect(result).toContain('img-float-right');
      expect(result).toContain('img-float-left');

      // photo1 and photo2 must NOT be adjacent siblings — if they were, a
      // subsequent `applySmartImageLayout` pass would re-group them.
      const rightIndex = result.indexOf('one.jpg');
      const leftIndex = result.indexOf('two.jpg');
      const mIndex = result.indexOf('M длинный абзац');
      expect(mIndex).toBeGreaterThan(-1);
      // M must sit strictly between the two floats (photo1 -> M -> photo2),
      // exactly as `applySmartImageLayout` already produced it — unchanged.
      expect(rightIndex).toBeLessThan(mIndex);
      expect(mIndex).toBeLessThan(leftIndex);
    });

    it('is a no-op on the interleaved fixture: output equals applySmartImageLayout alone', () => {
      const html = interleavedHtml();
      const result = applyBackwardFloatWrap(html);
      // Nothing eligible to reclaim here (M is already claimed by photo1),
      // so the render-only pass must not touch this shape at all.
      expect(result).toBe(html);
    });

    it('re-running applySmartImageLayout on the render-only output stays a pair, never a lone unwrapped float or a merged group', () => {
      const html = interleavedHtml();
      const rendered = applyBackwardFloatWrap(html);
      // Defensive: even if this output were ever accidentally fed back in
      // (it must not be — see module docstring), it must not corrupt into a
      // merged group or drop a side.
      const reprocessed = applySmartImageLayout(rendered);
      expect(reprocessed).not.toContain('img-pair-portraits');
      expect(reprocessed).toContain('img-float-right');
      expect(reprocessed).toContain('img-float-left');
    });
  });

  it('is idempotent on its own output for the primary swap case', () => {
    const html = applySmartImageLayout(`${longParagraph('A')}${portrait('gate.jpg')}${heading}`);
    const once = applyBackwardFloatWrap(html);
    const twice = applyBackwardFloatWrap(once);
    expect(twice).toBe(once);
  });

  it('does not throw on null/undefined/empty input', () => {
    expect(applyBackwardFloatWrap('')).toBe('');
    expect(applyBackwardFloatWrap(null as unknown as string)).toBe('');
    expect(applyBackwardFloatWrap(undefined as unknown as string)).toBe('');
  });

  it('leaves multi-image groups untouched (not a single-float case)', () => {
    const html = applySmartImageLayout(
      `${longParagraph('A')}${portrait('one.jpg')}${portrait('two.jpg')}${heading}`,
    );
    expect(html).toContain('img-pair-portraits');
    const result = applyBackwardFloatWrap(html);
    expect(result).toBe(html);
  });
});
