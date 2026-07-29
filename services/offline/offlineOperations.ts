import type {
  OfflineContentType,
  OfflinePackageOperation,
} from './types';

type OperationListener = () => void;
type ProgressReporter = (done: number, total: number) => void;
type OperationRunner<T> = (signal: AbortSignal, report: ProgressReporter) => Promise<T>;

type OperationMeta = {
  key: string;
  type: OfflineContentType;
  sourceId: string | number;
  route: string;
  title: string;
};

type RetryEntry = {
  meta: OperationMeta;
  runner: OperationRunner<unknown>;
};

const errorCodeOf = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/storage|quota|disk.?full/i.test(message)) return 'OFFLINE_STORAGE_FULL';
  return message.trim() || 'OFFLINE_SAVE_FAILED';
};

class OfflineOperations {
  private listeners = new Set<OperationListener>();
  private operations = new Map<string, OfflinePackageOperation>();
  private controllers = new Map<string, AbortController>();
  private retries = new Map<string, RetryEntry>();

  subscribe(listener: OperationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): OfflinePackageOperation[] {
    return Array.from(this.operations.values()).sort((left, right) => right.startedAt - left.startedAt);
  }

  get(key: string): OfflinePackageOperation | null {
    return this.operations.get(key) ?? null;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  async run<T>(meta: OperationMeta, runner: OperationRunner<T>): Promise<T> {
    this.controllers.get(meta.key)?.abort();
    const controller = new AbortController();
    this.controllers.set(meta.key, controller);
    this.retries.set(meta.key, { meta, runner: runner as OperationRunner<unknown> });
    this.operations.set(meta.key, {
      key: meta.key,
      type: meta.type,
      sourceId: String(meta.sourceId),
      route: meta.route,
      title: meta.title,
      status: 'downloading',
      done: 0,
      total: 1,
      errorCode: null,
      startedAt: Date.now(),
    });
    this.emit();

    const report = (done: number, total: number) => {
      if (this.controllers.get(meta.key) !== controller) return;
      const current = this.operations.get(meta.key);
      if (!current) return;
      this.operations.set(meta.key, {
        ...current,
        done: Math.max(0, done),
        total: Math.max(1, total),
      });
      this.emit();
    };

    try {
      const result = await runner(controller.signal, report);
      if (controller.signal.aborted) {
        throw Object.assign(new Error('OFFLINE_OPERATION_ABORTED'), { name: 'AbortError' });
      }
      if (this.controllers.get(meta.key) === controller) {
        this.controllers.delete(meta.key);
        this.operations.delete(meta.key);
        this.retries.delete(meta.key);
        this.emit();
      }
      return result;
    } catch (error) {
      if (this.controllers.get(meta.key) !== controller) throw error;
      this.controllers.delete(meta.key);
      if (controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError') {
        this.operations.delete(meta.key);
        this.emit();
        throw error;
      }
      const current = this.operations.get(meta.key);
      if (current) {
        this.operations.set(meta.key, {
          ...current,
          status: 'failed',
          errorCode: errorCodeOf(error),
        });
        this.emit();
      }
      throw error;
    }
  }

  cancel(key: string): void {
    const controller = this.controllers.get(key);
    controller?.abort();
    this.controllers.delete(key);
    this.operations.delete(key);
    this.retries.delete(key);
    this.emit();
  }

  async retry(key: string): Promise<unknown> {
    const entry = this.retries.get(key);
    if (!entry) return null;
    return this.run(entry.meta, entry.runner);
  }

  clear(key: string): void {
    this.controllers.get(key)?.abort();
    this.controllers.delete(key);
    this.operations.delete(key);
    this.retries.delete(key);
    this.emit();
  }
}

export const offlineOperations = new OfflineOperations();
export { OfflineOperations };
