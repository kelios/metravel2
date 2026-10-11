/** @jest-environment jsdom */
import { groupInlinePhotoFlow, INLINE_PHOTO_FLOW_CLASS } from '@/utils/richTextImageLayoutPhotoFlow';
import { applySmartImageLayout } from '@/utils/richTextImageLayout';

const copy = 'A linked route through the old town, along the river and into a quiet historic park. ';
const paragraph = (text = copy) => `<p>${text}</p>`;
const photo = (side = 'right', src = 'river.jpg') => `<p class="img-float-${side}"><span class="rich-image-frame"><img src="${src}" alt="River > valley" /></span></p>`;
const documentFor = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const groups = (html: string) => Array.from(documentFor(html).querySelectorAll(`.${INLINE_PHOTO_FLOW_CLASS}`));

describe('render-only narrative photo associations', () => {
  it.each(['left', 'right'])('contains a %s photo and all its own forward paragraphs', side => {
    const first = paragraph('<a href="/route">Old town</a> ' + copy);
    const second = paragraph(copy.repeat(30));
    const result = groupInlinePhotoFlow(photo(side) + first + second + '<h2>Next topic</h2>');
    const doc = documentFor(result);
    const group = doc.querySelector(`.${INLINE_PHOTO_FLOW_CLASS}`)!;
    expect(group.innerHTML).toContain(first);
    expect(group.innerHTML).toContain(second);
    expect(group.querySelector('img')?.getAttribute('alt')).toBe('River > valley');
    expect(group.querySelector('a')?.getAttribute('href')).toBe('/route');
    expect(group.querySelector('h2')).toBeNull();
    expect(group.nextElementSibling?.tagName).toBe('H2');
  });

  it('associates an orphan paragraph photo before initial paint', () => {
    const input = '<h3>River</h3>' + paragraph(copy) + photo() + '<h2>Palaces</h2>';
    const result = groupInlinePhotoFlow(input);
    expect(groups(result)).toHaveLength(1);
    expect(groups(result)[0].firstElementChild?.className).toBe('img-float-right');
    expect(groups(result)[0].textContent).toBe(copy);
    expect(input).not.toContain(INLINE_PHOTO_FLOW_CLASS);
  });

  it('associates an orphan figure backwards without losing its linked photo or caption', () => {
    const figure = '<figure class="img-float-left"><a href="/full.jpg"><img src="small.jpg" alt="Palace" /></a><figcaption>Historic palace</figcaption></figure>';
    const result = groupInlinePhotoFlow(paragraph() + '\n<!-- retained -->\n' + figure + '<h2>New topic</h2>');
    const group = groups(result)[0];
    expect(group.firstElementChild?.outerHTML).toBe(documentFor(figure).body.innerHTML);
    expect(group.querySelector('figcaption')?.textContent).toBe('Historic palace');
    expect(result).toContain('<!-- retained -->');
    expect(group.querySelector('a')?.getAttribute('href')).toBe('/full.jpg');
    expect(group.lastElementChild?.textContent).toBe(copy);
  });

  it('does not steal either of two paragraphs already owned by an earlier float', () => {
    const input = photo('left', 'one.jpg') + paragraph(copy) + paragraph(copy + 'second') + photo('right', 'two.jpg') + '<h2>Boundary</h2>';
    const result = groupInlinePhotoFlow(input);
    const doc = documentFor(result);
    expect(groups(result)).toHaveLength(1);
    expect(groups(result)[0].querySelectorAll('p')).toHaveLength(3);
    expect(doc.querySelector('img[src="two.jpg"]')?.closest(`.${INLINE_PHOTO_FLOW_CLASS}`)).toBeNull();
    expect(Array.from(doc.querySelectorAll('img')).map(img => img.getAttribute('src'))).toEqual(['one.jpg', 'two.jpg']);
    expect(doc.body.textContent).toBe(documentFor(input).body.textContent);
  });

  it('does not reclaim text owned by an unsupported floated photo shape', () => {
    const unsupported = '<p class="img-float-left"><img src="one.jpg" /><img src="two.jpg" /></p>';
    const input = unsupported + paragraph() + paragraph(copy + 'last') + photo('right', 'three.jpg') + '<h2>Boundary</h2>';
    expect(groupInlinePhotoFlow(input)).toBe(input);
  });

  it.each(['<p><svg><text>Independent artwork</text></svg></p>', '<p><button>Independent control</button></p>'])('does not group unsupported paragraph descendants: %s', boundary => {
    const input = photo() + boundary + paragraph();
    expect(groupInlinePhotoFlow(input)).toBe(input);
  });

  it('does not mistake quoted attributes or data-class for a float class or prose', () => {
    const falsePhoto = '<p data-class="img-float-right" title="class=\'img-float-left\'"><img src="one.jpg" /></p>';
    expect(groupInlinePhotoFlow(falsePhoto + paragraph())).toBe(falsePhoto + paragraph());
    const short = '<p><a title=">' + copy.repeat(2) + '">Short</a></p>';
    expect(groupInlinePhotoFlow(short + photo())).toBe(short + photo());
  });

  it('preserves empty placeholders without treating them as wrapping copy', () => {
    const empty = '<p><br /></p><p>&nbsp;</p><p>&#32;&#x20;&#160;</p>';
    expect(groupInlinePhotoFlow(photo() + empty + '<h2>Next</h2>')).toBe(photo() + empty + '<h2>Next</h2>');
    const result = groupInlinePhotoFlow(photo() + empty + paragraph('Short caption-like prose'));
    expect(groups(result)).toHaveLength(1);
    expect(groups(result)[0].querySelectorAll('p')).toHaveLength(5);
  });

  it('preserves empty paragraphs around an orphan without counting them as narrative', () => {
    const empty = '<p>&nbsp;</p>';
    const result = groupInlinePhotoFlow(paragraph() + empty + photo() + empty + '<h2>Next</h2>');
    expect(groups(result)).toHaveLength(1);
    expect(documentFor(result).querySelectorAll('p')).toHaveLength(4);
    expect(groups(result)[0].querySelector('p:not([class])')?.textContent).toBe('\u00a0');
    expect(groups(result)[0].textContent).toBe('\u00a0' + copy);
  });

  it.each(['<h2>Heading</h2>', '<ul><li>List</li></ul>', '<table><tr><td>Cell</td></tr></table>', '<blockquote>Quote</blockquote>', '<details><summary>FAQ</summary></details>', '<hr />'])('stops at the independent boundary %s', boundary => {
    const input = photo() + boundary + paragraph();
    expect(groupInlinePhotoFlow(input)).toBe(input);
  });

  it('retains wide photos, groups, standalone photos and short orphan copy unchanged', () => {
    for (const input of [
      '<p class="img-single-wide"><img src="landscape.jpg" /></p>' + paragraph(),
      '<div class="img-row-2"><img src="one.jpg" /><img src="two.jpg" /></div>' + paragraph(),
      photo() + '<h2>Boundary</h2>',
      paragraph('Too short') + photo() + '<h2>Boundary</h2>',
      '<p class="img-float-right"><img src="one.jpg" /><img src="two.jpg" /></p>' + paragraph(),
    ]) expect(groupInlinePhotoFlow(input)).toBe(input);
  });

  it.each([
    '<p>Unclosed paragraph',
    '<div><p>Incorrect nesting</div></p>',
    '<p class="img-float-right"><img src="x.jpg" /></p><p><p>Nested paragraph</p></p>',
    '<p class="img-float-right"><img src="x.jpg" /></p><p><a href="one"><span>Text</span><a href="two">Nested link</a></a></p>',
    '<!-- unclosed comment',
    '<p class="img-float-right"><img src="x.jpg" /></p><p>Unclosed',
  ])('passes malformed input through exactly: %s', input => {
    expect(groupInlinePhotoFlow(input)).toBe(input);
  });

  it('is idempotent and does not recurse into unrelated wrappers', () => {
    const input = photo() + paragraph();
    const grouped = groupInlinePhotoFlow(input);
    expect(groupInlinePhotoFlow(grouped)).toBe(grouped);
    const nested = `<section>${input}</section>`;
    expect(groupInlinePhotoFlow(nested)).toBe(nested);
  });

  it('counts real photo tags rather than tags mentioned in comments or quoted attributes', () => {
    const image = '<p class="img-float-right"><!-- <img src="comment.jpg"> --><img src="real.jpg" alt="Text <img> marker" /></p>';
    const result = groupInlinePhotoFlow(image + paragraph());
    expect(groups(result)).toHaveLength(1);
    expect(groups(result)[0].querySelectorAll('img')).toHaveLength(1);
    expect(result).toContain(image);
  });

  it('preserves deep inline spans and independent links across consecutive paragraphs', () => {
    const links = Array.from({ length: 256 }, (_, index) => `<a href="/route/${index}">Route ${index}</a>`).join(' ');
    const nested = '<span>'.repeat(256) + links + '</span>'.repeat(256);
    const input = photo() + paragraph(nested) + paragraph(copy);
    const result = groupInlinePhotoFlow(input);
    const group = groups(result)[0];
    expect(groups(result)).toHaveLength(1);
    expect(group.querySelectorAll('img')).toHaveLength(1);
    expect(group.querySelectorAll('p:not([class])')).toHaveLength(2);
    expect(Array.from(group.querySelectorAll('a')).map(link => link.getAttribute('href')))
      .toEqual(Array.from({ length: 256 }, (_, index) => `/route/${index}`));
    expect(group.textContent).toBe(documentFor(input).body.textContent);
    expect(result).toContain(nested);
    expect(groupInlinePhotoFlow(result)).toBe(result);
  });

  describe('canonical layout followed by its only web association pass (#1623)', () => {
    const portrait = (src: string, side?: string) => `<p${side ? ` class="img-float-${side} figure-portrait"` : ''}><img src="${src}" width="600" height="900" /></p>`;
    it.each(['left', 'right'])('retains %s author side at a heading and at end of content', side => {
      for (const end of ['', '<h2>Next</h2>', '<p>&nbsp;</p><h2>Next</h2>']) {
        const source = applySmartImageLayout(paragraph() + portrait('one.jpg', side)) + end;
        const result = groupInlinePhotoFlow(source);
        expect(groups(result)).toHaveLength(1);
        expect(groups(result)[0].firstElementChild?.className).toContain(`img-float-${side}`);
        expect(groups(result)[0].textContent).toBe(copy);
        expect(groupInlinePhotoFlow(result)).toBe(result);
        expect(source).not.toContain(INLINE_PHOTO_FLOW_CLASS);
      }
    });

    it('preserves canonical image/text occurrence order for multiple claimed paragraphs', () => {
      const source = applySmartImageLayout(paragraph('Before ' + copy) + portrait('one.jpg', 'right') + paragraph('Middle ' + copy) + paragraph('Last ' + copy) + portrait('two.jpg', 'left') + '<h2>Next</h2>');
      const result = documentFor(groupInlinePhotoFlow(source));
      expect(Array.from(result.querySelectorAll('img')).map(img => img.getAttribute('src'))).toEqual(['one.jpg', 'two.jpg']);
      expect(result.querySelector('img[src="two.jpg"]')?.closest(`.${INLINE_PHOTO_FLOW_CLASS}`)).toBeNull();
      expect(groups(result.body.innerHTML)[0].textContent).toBe('Middle ' + copy + 'Last ' + copy);
      expect(result.body.textContent).toBe(documentFor(source).body.textContent);
      expect(source).not.toContain(INLINE_PHOTO_FLOW_CLASS);
    });

    it('retains auto-classification, forward wrap, negative short prose and consecutive galleries', () => {
      expect(groups(groupInlinePhotoFlow(applySmartImageLayout(paragraph() + portrait('one.jpg'))))).toHaveLength(1);
      expect(groups(groupInlinePhotoFlow(applySmartImageLayout(portrait('one.jpg') + paragraph('Short'))))).toHaveLength(1);
      for (const source of [applySmartImageLayout(paragraph('Short') + portrait('one.jpg')), applySmartImageLayout(paragraph() + portrait('one.jpg') + portrait('two.jpg'))]) {
        expect(groupInlinePhotoFlow(source)).toBe(source);
      }
      expect(groupInlinePhotoFlow('')).toBe('');
    });
  });
});
