/**
 * Typed hooks for TravelDetailsContainer
 * Separate concerns and improve testability
 */

import { useEffect, useRef, MutableRefObject, useCallback, useState } from "react";
import { Platform, Animated } from "react-native";

/**
 * Hook for safe scroll listener that prevents memory leaks
 */
export function useScrollListener(
  scrollY: Animated.Value,
  handler: (value: number) => void,
  additionalDeps: React.DependencyList = []
) {
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      handler(value);
    });

    return () => {
      scrollY.removeListener(id);
    };
  }, [scrollY, handler, additionalDeps]);
}

/**
 * Hook for safe setTimeout cleanup
 */
export function useTimeout(
  callback: () => void,
  delay: number | null,
  additionalDeps: React.DependencyList = []
) {
  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(callback, delay);
    return () => clearTimeout(id);
  }, [delay, callback, additionalDeps]);
}

/**
 * Hook for safe setInterval cleanup
 */
export function useInterval(
  callback: () => void,
  delay: number | null,
  additionalDeps: React.DependencyList = []
) {
  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [delay, callback, additionalDeps]);
}

/**
 * Hook to safely get DOM element from React Native ref
 */
export function useDOMElement(
  ref: MutableRefObject<any> | null
): HTMLElement | null {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref) {
      setElement(null);
      return;
    }

    const getDOMElement = (): HTMLElement | null => {
      const current = ref.current;
      if (!current) return null;

      // React Native Web exposes DOM node via these properties
      const domNode =
        current._nativeNode || // React Native Web <= 0.18
        current._domNode || // React Native Web 0.19+
        current; // Already a DOM node

      // Validate it's a DOM element
      if (domNode && typeof domNode.getBoundingClientRect === "function") {
        return domNode as HTMLElement;
      }

      return null;
    };

    // Try to get element, with fallback retry logic
    let attempts = 0;
    const maxAttempts = 10;

    const tryGetElement = () => {
      const el = getDOMElement();
      if (el) {
        setElement(el);
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        const nextAttemptDelay = Math.min(16 * attempts, 200);
        setTimeout(tryGetElement, nextAttemptDelay);
      }
    };

    tryGetElement();
  }, [ref]);

  return element;
}

/**
 * Hook for requestIdleCallback with graceful fallback
 */
export function useIdleCallback(
  callback: () => void,
  options: { timeout?: number; enabled?: boolean } = {}
) {
  const { timeout = 1000, enabled = true } = options;

  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;

    const hasRequestIdleCallback =
      typeof (window as any)?.requestIdleCallback === "function";

    if (hasRequestIdleCallback) {
      const id = (window as any).requestIdleCallback(callback, { timeout });
      return () => {
        try {
          (window as any).cancelIdleCallback?.(id);
        } catch {
          // noop
        }
      };
    }

    // Fallback: use setTimeout
    const id = setTimeout(callback, timeout);
    return () => clearTimeout(id);
  }, [callback, enabled, timeout]);
}

/**
 * Hook for IntersectionObserver with validation
 */
export function useIntersectionObserver(
  ref: MutableRefObject<HTMLElement | null> | null,
  handler: (isIntersecting: boolean) => void,
  options?: IntersectionObserverInit
) {
  useEffect(() => {
    if (!ref || !ref.current || Platform.OS !== "web") return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: assume visible if observer not available
      handler(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          handler(entry.isIntersecting);
        }
      },
      options
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, handler, options]);
}

/**
 * Hook for RAF-based animation that auto-cleans up
 */
export function useAnimationFrame(
  callback: (deltaTime: number) => void,
  enabled: boolean = true
) {
  const lastTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;

    const animate = (currentTime: number) => {
      const deltaTime = lastTimeRef.current
        ? currentTime - lastTimeRef.current
        : 0;

      lastTimeRef.current = currentTime;
      callback(deltaTime);

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [callback, enabled]);
}

/**
 * Hook for safe event listener cleanup
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | Document | HTMLElement | null = typeof window !== "undefined" ? window : null,
  options?: boolean | AddEventListenerOptions
) {
  useEffect(() => {
    if (!element) return;

    const isSupported = element && element.addEventListener;
    if (!isSupported) return;

    element.addEventListener(eventName, handler as EventListener, options);

    return () => {
      element.removeEventListener(eventName, handler as EventListener, options);
    };
  }, [element, eventName, handler, options]);
}

/**
 * Hook for managing controlled/uncontrolled component state
 */
export function useControlledState<T>(
  controlledValue: T | undefined,
  initialValue: T,
  onChange?: (value: T) => void
): [T, (value: T) => void] {
  const [internalValue, setInternalValue] = useState(initialValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (newValue: T) => {
      if (isControlled) {
        onChange?.(newValue);
      } else {
        setInternalValue(newValue);
      }
    },
    [isControlled, onChange]
  );

  return [value, setValue];
}

/**
 * Hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Hook for logging component lifecycle (dev only)
 */
export function useComponentLifecycle(componentName: string) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    console.info(`[${componentName}] mounted`);

    return () => {
      console.info(`[${componentName}] unmounted`);
    };
  }, [componentName]);
}

