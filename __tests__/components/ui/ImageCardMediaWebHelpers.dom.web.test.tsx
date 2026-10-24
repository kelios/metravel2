/** @jest-environment jsdom */
import { act, createElement, Fragment, useLayoutEffect } from 'react';
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

function mount(initial: Source, gated = false, options: { loading?: 'lazy' | 'eager'; onLayout?: () => void } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  const onLoad = jest.fn();
  const onNaturalSize = jest.fn();
  const onDecoded = jest.fn();
  const layoutOpacities: string[] = [];
  function LayoutCheckpoint({ source }: { source: Source }) {
    useLayoutEffect(() => {
      options.onLayout?.();
      layoutOpacities.push(host.querySelector('img')?.style.opacity ?? '');
    }, [source]);
    return null;
  }
  const render = (source: Source) => act(() => root.render(createElement(Fragment, null,
    createElement(WebMainImage, {
      ...source, alt: 'Point photo', width: 48, height: 48, fit: 'contain',
      borderRadius: 10, loading: options.loading ?? 'lazy', priority: 'low', loaded: false,
      showImmediately: !gated, onLoad, onNaturalSize, onDecoded,
    }),
    createElement(LayoutCheckpoint, { source }),
  )));
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
    image, writes, state, onLoad, onNaturalSize, onDecoded, layoutOpacities,
    pixels(src: string) {
      Object.defineProperties(image, {
        complete: { configurable: true, value: true },
        naturalWidth: { configurable: true, value: 48 },
        naturalHeight: { configurable: true, value: 32 },
        currentSrc: { configurable: true, value: src },
      });
    },
    update(source: Source) { render(source); expect(host.querySelector('img')).toBe(image); },
    close() { setSpy.mockRestore(); removeSpy.mockRestore(); act(() => root.unmount()); host.remove(); },
  };
}

describe('WebMainImage real DOM responsive source updates', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reveals warm A → B → A pixels before the layout checkpoint without another load event', () => {
    const fixture = mount(responsive(imageA), true);
    try {
      fixture.pixels(`${imageA}?w=320`);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      fixture.pixels(`${imageB}?w=320`);
      fixture.update(responsive(imageB));
      expect(fixture.layoutOpacities.at(-1)).toBe('1');
      fixture.pixels(`${imageA}?w=320`);
      fixture.update(responsive(imageA));
      expect(fixture.layoutOpacities.at(-1)).toBe('1');
      expect(fixture.onLoad.mock.calls.map(([src]) => src)).toEqual([
        `${imageA}?w=320`, `${imageB}?w=320`, `${imageA}?w=320`,
      ]);
    } finally { fixture.close(); }
  });

  it.each([imageB, `${imageA}?v=2`, `${imageA}?signature=next`])(
    'keeps previous complete pixels hidden while waiting for %s',
    (nextSrc) => {
      const fixture = mount(plain(imageA), true);
      try {
        fixture.pixels(imageA);
        act(() => fixture.image.dispatchEvent(new Event('load')));
        fixture.update(plain(nextSrc));
        act(() => fixture.image.dispatchEvent(new Event('load')));
        expect(fixture.image.style.opacity).toBe('0');
        expect(fixture.onLoad).toHaveBeenCalledTimes(1);
        expect(fixture.onDecoded).toHaveBeenCalledTimes(1);
      } finally { fixture.close(); }
    },
  );

  it('rechecks a warm responsive selection in the commit microtask before waiting for load', async () => {
    const fixture = mount(responsive(imageA), true);
    try {
      fixture.pixels(`${imageA}?w=320`);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      fixture.pixels(`${imageB}?w=320`);
      fixture.update(responsive(imageB));
      fixture.update(responsive(imageA));
      expect(fixture.image.style.opacity).toBe('0');
      fixture.pixels(`${imageA}?w=320`);
      await act(async () => { await Promise.resolve(); });
      expect(fixture.image.style.opacity).toBe('1');
      expect(fixture.onLoad.mock.calls.at(-1)?.[0]).toBe(`${imageA}?w=320`);
    } finally { fixture.close(); }
  });

  it('reveals pixels synchronously when they become ready before lazy recovery starts', () => {
    const originalObserver = globalThis.IntersectionObserver;
    let intersection!: () => void;
    const disconnect = jest.fn();
    globalThis.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      intersection = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      return { observe: jest.fn(), disconnect };
    }) as unknown as typeof IntersectionObserver;
    const src = imageA.replace('.webp', '-ready-before-intersection.webp');
    const fixture = mount(responsive(src), true);
    const decode = jest.fn(() => new Promise<void>(() => undefined));
    Object.defineProperty(fixture.image, 'decode', { configurable: true, value: decode });
    try {
      expect(fixture.image.style.opacity).toBe('0');
      expect(fixture.onLoad).not.toHaveBeenCalled();
      fixture.pixels(`${src}?w=320`);
      act(() => intersection());
      expect(fixture.image.style.opacity).toBe('1');
      expect(fixture.onLoad).toHaveBeenCalledWith(`${src}?w=320`, { width: 48, height: 32 });
      expect(decode).not.toHaveBeenCalled();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      fixture.close();
      globalThis.IntersectionObserver = originalObserver;
    }
  });

  it('decodes a visible warm source set without eagerly decoding cold or changed source sets', () => {
    const warm = `${imageA}?v=warm-visible`;
    const other = `${imageB}?v=warm-visible`;
    const fixture = mount(plain(warm), true);
    const decode = jest.fn(() => new Promise<void>(() => undefined));
    Object.defineProperty(fixture.image, 'decode', { configurable: true, value: decode });
    jest.spyOn(fixture.image, 'getBoundingClientRect').mockReturnValue({
      top: 10, bottom: 58, left: 10, right: 58,
    } as DOMRect);
    try {
      fixture.pixels(warm);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      fixture.pixels(other);
      fixture.update(plain(other));
      fixture.update(plain(warm));
      expect(decode).toHaveBeenCalledTimes(1);

      fixture.update(plain(`${imageA}?v=never-loaded`));
      fixture.update({ src: warm, sizes: '96px' });
      expect(decode).toHaveBeenCalledTimes(1);
      expect(fixture.image.style.opacity).toBe('0');
    } finally { fixture.close(); }
  });

  it('leaves a warm source outside the viewport to the lazy recovery observer', () => {
    const warm = `${imageA}?v=warm-offscreen`;
    const other = `${imageB}?v=warm-offscreen`;
    const fixture = mount(plain(warm), true);
    const decode = jest.fn(() => Promise.resolve());
    Object.defineProperty(fixture.image, 'decode', { configurable: true, value: decode });
    jest.spyOn(fixture.image, 'getBoundingClientRect').mockReturnValue({
      top: window.innerHeight + 10, bottom: window.innerHeight + 58, left: 10, right: 58,
    } as DOMRect);
    try {
      fixture.pixels(warm);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      fixture.pixels(other);
      fixture.update(plain(other));
      fixture.update(plain(warm));
      expect(decode).not.toHaveBeenCalled();
      expect(fixture.image.style.opacity).toBe('0');
    } finally { fixture.close(); }
  });

  it.each(['source swap', 'unmount'] as const)(
    'ignores a warm decode that resolves after %s',
    async (cancellation) => {
      const suffix = cancellation.replace(' ', '-');
      const warm = `${imageA}?v=late-${suffix}`;
      const other = `${imageB}?v=late-${suffix}`;
      const fixture = mount(plain(warm), true);
      let resolveDecode!: () => void;
      const decode = jest.fn(() => new Promise<void>(resolve => { resolveDecode = resolve; }));
      Object.defineProperty(fixture.image, 'decode', { configurable: true, value: decode });
      jest.spyOn(fixture.image, 'getBoundingClientRect').mockReturnValue({
        top: 10, bottom: 58, left: 10, right: 58,
      } as DOMRect);
      let closed = false;
      try {
        fixture.pixels(warm);
        act(() => fixture.image.dispatchEvent(new Event('load')));
        fixture.pixels(other);
        fixture.update(plain(other));
        fixture.update(plain(warm));
        expect(decode).toHaveBeenCalledTimes(1);
        const reportedLoads = fixture.onLoad.mock.calls.length;
        if (cancellation === 'source swap') {
          fixture.update(plain(`${imageA}?v=next-source`));
        } else {
          fixture.close();
          closed = true;
        }
        fixture.pixels(warm);
        await act(async () => { resolveDecode(); await Promise.resolve(); });
        expect(fixture.onLoad).toHaveBeenCalledTimes(reportedLoads);
        expect(fixture.image.style.opacity).toBe('0');
      } finally { if (!closed) fixture.close(); }
    },
  );

  it('rejects a previous recovery callback after the next source commit before passive cleanup', () => {
    jest.useFakeTimers();
    let runPreviousPoll = false;
    const source = `${imageA}?v=late-passive-recovery`;
    const fixture = mount(plain(source), true, {
      loading: 'eager',
      // Force the pending old callback into the interval between the new
      // layout commit and cleanup of the previous passive recovery effect.
      onLayout: () => { if (runPreviousPoll) jest.advanceTimersByTime(250); },
    });
    try {
      fixture.pixels(source);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      expect(fixture.onLoad).toHaveBeenCalledTimes(1);
      runPreviousPoll = true;
      fixture.update(plain(`${imageB}?v=late-passive-recovery`));
      expect(fixture.layoutOpacities.at(-1)).toBe('0');
      expect(fixture.onLoad).toHaveBeenCalledTimes(1);
    } finally {
      fixture.close();
      jest.useRealTimers();
    }
  });

  it('does not accept a decoded thumbnail outside the active responsive candidates', () => {
    const fixture = mount(plain(imageA), true);
    try {
      fixture.pixels(imageA);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      fixture.update(responsive(imageA));
      act(() => fixture.image.dispatchEvent(new Event('load')));
      expect(fixture.image.style.opacity).toBe('0');
      expect(fixture.onLoad).toHaveBeenCalledTimes(1);
      fixture.pixels(`${imageA}?w=320`);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      expect(fixture.image.style.opacity).toBe('1');
    } finally { fixture.close(); }
  });

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
