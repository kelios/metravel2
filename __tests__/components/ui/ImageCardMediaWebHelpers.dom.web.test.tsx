/** @jest-environment jsdom */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WebMainImage } from '@/components/ui/ImageCardMediaWebHelpers';

type Source = { src: string; srcSet?: string; sizes?: string };
type Write = {
  attribute: string;
  operation: 'set' | 'remove';
  before: Source;
  after: Source;
  connected: boolean;
};

const imageA = 'https://metravel.by/address-image/1/old.webp';
const imageB = 'https://metravel.by/address-image/1/new.webp';
const responsive = (image: string, sizes = '48px'): Source => ({
  src: `${image}?w=160`,
  srcSet: `${image}?w=160 160w, ${image}?w=320 320w`,
  sizes,
});
const plain = (image: string): Source => ({ src: image });
const identity = (value: string) => new URL(value).pathname;
const candidates = (value?: string) => value?.split(',').map(candidate => identity(candidate.trim().split(/\s+/)[0])) ?? [];

function mount(initial: Source) {
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  const onLoad = jest.fn();
  const onNaturalSize = jest.fn();
  const onDecoded = jest.fn();
  const render = (source: Source) => act(() => root.render(createElement(WebMainImage, {
    ...source, alt: 'Point photo', width: 48, height: 48, fit: 'contain',
    borderRadius: 10, loading: 'lazy', priority: 'low', loaded: false,
    showImmediately: true, onLoad, onNaturalSize, onDecoded,
  })));
  render(initial);
  const image = host.querySelector('img')!;
  const writes: Write[] = [];
  const state = (): Source => ({
    src: image.getAttribute('src') ?? '',
    srcSet: image.getAttribute('srcset') ?? undefined,
    sizes: image.getAttribute('sizes') ?? undefined,
  });
  const nativeSet = Element.prototype.setAttribute;
  const nativeRemove = Element.prototype.removeAttribute;
  const setSpy = jest.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (this: Element, name: string, value: string) {
    if (this !== image || !['src', 'srcset', 'sizes'].includes(name.toLowerCase())) return nativeSet.call(this, name, value);
    const before = state();
    nativeSet.call(this, name, value);
    writes.push({ attribute: name.toLowerCase(), operation: 'set', before, after: state(), connected: image.isConnected });
  });
  const removeSpy = jest.spyOn(Element.prototype, 'removeAttribute').mockImplementation(function (this: Element, name: string) {
    if (this !== image || !['src', 'srcset', 'sizes'].includes(name.toLowerCase())) return nativeRemove.call(this, name);
    const before = state();
    nativeRemove.call(this, name);
    writes.push({ attribute: name.toLowerCase(), operation: 'remove', before, after: state(), connected: image.isConnected });
  });
  return {
    image, writes, state, onLoad, onNaturalSize, onDecoded,
    update(source: Source) { render(source); expect(host.querySelector('img')).toBe(image); },
    close() { setSpy.mockRestore(); removeSpy.mockRestore(); act(() => root.unmount()); host.remove(); },
  };
}

describe('WebMainImage real DOM responsive source updates', () => {
  afterEach(() => jest.restoreAllMocks());

  it('replaces the candidate set before a new src on the same connected image', () => {
    const fixture = mount(responsive(imageA));
    try {
      fixture.update(responsive(imageB));
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(sourceWrite).toBeDefined();
      expect(sourceWrite.connected).toBe(true);
      expect(candidates(sourceWrite.before.srcSet)).toEqual([identity(imageB), identity(imageB)]);
      expect(fixture.state()).toEqual(responsive(imageB));
    } finally { fixture.close(); }
  });

  it('removes old responsive candidates before switching to a plain source', () => {
    const fixture = mount(responsive(imageA));
    try {
      fixture.update(plain(imageB));
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(sourceWrite.before.srcSet).toBeUndefined();
      expect(sourceWrite.before.sizes).toBeUndefined();
      expect(fixture.state()).toEqual(plain(imageB));
    } finally { fixture.close(); }
  });

  it('installs responsive candidates before replacing a plain fallback source', () => {
    const fixture = mount(plain(imageA));
    try {
      fixture.update(responsive(imageB));
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(sourceWrite.before.srcSet).toBe(responsive(imageB).srcSet);
      expect(sourceWrite.before.sizes).toBe('48px');
    } finally { fixture.close(); }
  });

  it('sets the new slot size before selecting new responsive candidates', () => {
    const fixture = mount(responsive(imageA));
    try {
      fixture.update(responsive(imageB, '96px'));
      const candidateWrite = fixture.writes.find(write => write.attribute === 'srcset')!;
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(candidateWrite).toBeDefined();
      expect(sourceWrite).toBeDefined();
      expect(candidateWrite.before.sizes).toBe('96px');
      expect(sourceWrite.before.sizes).toBe('96px');
      expect(candidates(sourceWrite.before.srcSet)).not.toContain(identity(imageA));
    } finally { fixture.close(); }
  });

  it('changes only sizes without rewriting unchanged sources or remounting', () => {
    const fixture = mount(responsive(imageA));
    try {
      fixture.update(responsive(imageA, '96px'));
      expect(fixture.writes.map(write => write.attribute)).toEqual(['sizes']);
      expect(fixture.state()).toEqual(responsive(imageA, '96px'));
    } finally { fixture.close(); }
  });

  it('updates only fallback src without disturbing a stable responsive set', () => {
    const fixture = mount(responsive(imageA));
    try {
      fixture.update({ ...responsive(imageA), src: `${imageA}?w=320` });
      expect(fixture.writes.map(write => write.attribute)).toEqual(['src']);
      expect(fixture.writes[0].before.srcSet).toBe(responsive(imageA).srcSet);
      expect(fixture.writes[0].after.srcSet).toBe(responsive(imageA).srcSet);
    } finally { fixture.close(); }
  });

  it('preserves nonresponsive source-only updates and reports new loaded pixels', () => {
    const fixture = mount(plain(imageA));
    try {
      fixture.update(plain(imageB));
      expect(fixture.writes.map(write => write.attribute)).toEqual(['src']);
      Object.defineProperties(fixture.image, {
        complete: { configurable: true, value: true },
        naturalWidth: { configurable: true, value: 48 },
        naturalHeight: { configurable: true, value: 32 },
        currentSrc: { configurable: true, value: imageB },
      });
      act(() => fixture.image.dispatchEvent(new Event('load')));
      expect(fixture.onLoad).toHaveBeenCalledWith(imageB, { width: 48, height: 32 });
      expect(fixture.onNaturalSize).toHaveBeenCalledWith({ width: 48, height: 32 });
      expect(fixture.onDecoded).toHaveBeenCalledWith(fixture.image);
      expect(fixture.image.style.opacity).toBe('1');
    } finally { fixture.close(); }
  });
});
