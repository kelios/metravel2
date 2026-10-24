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
const setPixels = (image: HTMLImageElement, src: string) => Object.defineProperties(image, {
  complete: { configurable: true, value: true },
  naturalWidth: { configurable: true, value: 48 },
  naturalHeight: { configurable: true, value: 32 },
  currentSrc: { configurable: true, value: src },
});

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
  let image = host.querySelector('img')!;
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
    get image() { return image; },
    writes, state, onLoad, onNaturalSize, onDecoded, layoutOpacities,
    pixels(src: string) { setPixels(image, src); },
    update(source: Source) { render(source); image = host.querySelector('img')!; },
    close() { setSpy.mockRestore(); removeSpy.mockRestore(); act(() => root.unmount()); host.remove(); },
  };
}

describe('WebMainImage real DOM responsive source updates', () => {
  afterEach(() => jest.restoreAllMocks());

  it('owns warm A → B → A pixels in new native images without waiting for load or decode', () => {
    const fixture = mount(responsive(imageA));
    try {
      const original = fixture.image;
      fixture.pixels(`${imageA}?w=320`);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      fixture.update(responsive(imageB));
      const second = fixture.image;
      expect(second).not.toBe(original);
      expect(original.isConnected).toBe(false);
      fixture.pixels(`${imageB}?w=320`);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      expect(fixture.layoutOpacities.at(-1)).toBe('1');
      fixture.update(responsive(imageA));
      expect(fixture.image).not.toBe(original);
      expect(fixture.image).not.toBe(second);
      expect(second.isConnected).toBe(false);
      fixture.pixels(`${imageA}?w=320`);
      expect(fixture.layoutOpacities.at(-1)).toBe('1');
      expect(fixture.image.style.opacity).toBe('1');
      expect(fixture.image.parentElement!.querySelectorAll('img')).toHaveLength(1);
      expect(fixture.onLoad.mock.calls.map(([src]) => src)).toEqual([
        `${imageA}?w=320`, `${imageB}?w=320`,
      ]);
    } finally { fixture.close(); }
  });

  it.each([imageB, `${imageA}?v=2`, `${imageA}?signature=next`])(
    'replaces old pixels for %s while preserving an explicit load gate',
    (nextSrc) => {
      const fixture = mount(plain(imageA), true);
      try {
        fixture.pixels(imageA);
        act(() => fixture.image.dispatchEvent(new Event('load')));
        const previous = fixture.image;
        fixture.update(plain(nextSrc));
        expect(fixture.image).not.toBe(previous);
        expect(previous.isConnected).toBe(false);
        expect(fixture.image.currentSrc).toBe('');
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

  it.each(['source swap', 'unmount'] as const)(
    'ignores recovery for a detached image after %s',
    async (cancellation) => {
      const suffix = cancellation.replace(' ', '-');
      const src = `${imageA}?v=late-${suffix}`;
      const originalDecode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode');
      const resolveDecodes: (() => void)[] = [];
      const decode = jest.fn(() => new Promise<void>(resolve => { resolveDecodes.push(resolve); }));
      Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: decode });
      const fixture = mount(plain(src), true, { loading: 'eager' });
      const previous = fixture.image;
      let closed = false;
      try {
        expect(decode).toHaveBeenCalledTimes(1);
        if (cancellation === 'source swap') {
          fixture.update(plain(`${imageA}?v=next-source`));
        } else {
          fixture.close();
          closed = true;
        }
        setPixels(previous, src);
        await act(async () => { resolveDecodes[0](); await Promise.resolve(); });
        expect(fixture.onLoad).not.toHaveBeenCalled();
        expect(fixture.image.style.opacity).toBe('0');
      } finally {
        if (!closed) fixture.close();
        if (originalDecode) Object.defineProperty(HTMLImageElement.prototype, 'decode', originalDecode);
        else Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
      }
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

  it('replaces the candidate set before a new fallback on the same image identity', () => {
    const fixture = mount(responsive(imageA));
    try {
      const previous = fixture.image;
      const next = { src: `${imageA}?w=320`, srcSet: `${imageA}?w=320 320w, ${imageA}?w=640 640w`, sizes: '48px' };
      fixture.update(next);
      expect(fixture.image).toBe(previous);
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(sourceWrite).toBeDefined();
      expect(sourceWrite.connected).toBe(true);
      expect(sourceWrite.before.srcSet).toBe(next.srcSet);
      expect(fixture.state()).toEqual(next);
    } finally { fixture.close(); }
  });

  it('removes old responsive candidates before switching to a plain source', () => {
    const fixture = mount(responsive(imageA));
    try {
      const previous = fixture.image;
      fixture.update(plain(imageA));
      expect(fixture.image).toBe(previous);
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(sourceWrite.before.srcSet).toBeUndefined();
      expect(sourceWrite.before.sizes).toBeUndefined();
      expect(fixture.state()).toEqual(plain(imageA));
    } finally { fixture.close(); }
  });

  it('installs responsive candidates before replacing a plain fallback source', () => {
    const fixture = mount(plain(imageA));
    try {
      const previous = fixture.image;
      fixture.update(responsive(imageA));
      expect(fixture.image).toBe(previous);
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(sourceWrite.before.srcSet).toBe(responsive(imageA).srcSet);
      expect(sourceWrite.before.sizes).toBe('48px');
    } finally { fixture.close(); }
  });

  it('sets the new slot size before selecting new responsive candidates', () => {
    const fixture = mount(responsive(imageA));
    try {
      const previous = fixture.image;
      const next = { src: `${imageA}?w=320`, srcSet: `${imageA}?w=320 320w, ${imageA}?w=640 640w`, sizes: '96px' };
      fixture.update(next);
      expect(fixture.image).toBe(previous);
      const candidateWrite = fixture.writes.find(write => write.attribute === 'srcset')!;
      const sourceWrite = fixture.writes.find(write => write.attribute === 'src')!;
      expect(candidateWrite).toBeDefined();
      expect(sourceWrite).toBeDefined();
      expect(candidateWrite.before.sizes).toBe('96px');
      expect(sourceWrite.before.sizes).toBe('96px');
      expect(sourceWrite.before.srcSet).toBe(next.srcSet);
    } finally { fixture.close(); }
  });

  it('changes only sizes without rewriting unchanged sources or remounting', () => {
    const fixture = mount(responsive(imageA));
    try {
      const previous = fixture.image;
      fixture.update(responsive(imageA, '96px'));
      expect(fixture.image).toBe(previous);
      expect(fixture.writes.map(write => write.attribute)).toEqual(['sizes']);
      expect(fixture.state()).toEqual(responsive(imageA, '96px'));
    } finally { fixture.close(); }
  });

  it('updates only fallback src without disturbing a stable responsive set', () => {
    const fixture = mount(responsive(imageA));
    try {
      const previous = fixture.image;
      fixture.update({ ...responsive(imageA), src: `${imageA}?w=320` });
      expect(fixture.image).toBe(previous);
      expect(fixture.writes.map(write => write.attribute)).toEqual(['src']);
      expect(fixture.writes[0].before.srcSet).toBe(responsive(imageA).srcSet);
      expect(fixture.writes[0].after.srcSet).toBe(responsive(imageA).srcSet);
    } finally { fixture.close(); }
  });

  it('replaces a cold source without inheriting old pixels and reports its load once', () => {
    const fixture = mount(plain(imageA));
    try {
      const previous = fixture.image;
      fixture.pixels(imageA);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      fixture.update(plain(imageB));
      expect(fixture.image).not.toBe(previous);
      expect(previous.isConnected).toBe(false);
      expect(fixture.image.currentSrc).toBe('');
      expect(fixture.image.naturalWidth).toBe(0);
      expect(fixture.image.style.opacity).toBe('1');
      expect(fixture.image.getAttribute('loading')).toBe('lazy');
      fixture.pixels(imageB);
      act(() => fixture.image.dispatchEvent(new Event('load')));
      act(() => fixture.image.dispatchEvent(new Event('load')));
      expect(fixture.onLoad).toHaveBeenCalledTimes(2);
      expect(fixture.onLoad).toHaveBeenCalledWith(imageB, { width: 48, height: 32 });
      expect(fixture.onNaturalSize).toHaveBeenCalledWith({ width: 48, height: 32 });
      expect(fixture.onDecoded).toHaveBeenCalledWith(fixture.image);
      expect(fixture.image.style.opacity).toBe('1');
    } finally { fixture.close(); }
  });
});
