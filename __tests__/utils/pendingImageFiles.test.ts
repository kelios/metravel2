import {
  createPendingImageSession,
  getPendingImageFile,
  registerPendingImageFile,
  removePendingImageFile,
} from '@/utils/pendingImageFiles';

describe('pending point photos', () => {
  const originalRevoke = URL.revokeObjectURL;
  const revoke = jest.fn();

  beforeEach(() => {
    URL.revokeObjectURL = revoke;
    revoke.mockClear();
  });

  afterEach(() => {
    URL.revokeObjectURL = originalRevoke;
  });

  it('disposes each abandoned session without clearing another editor or a new generation', () => {
    const other = createPendingImageSession();
    const otherUrl = 'blob:other';
    const file = new File(['preview'], 'point.jpg', { type: 'image/jpeg' });
    registerPendingImageFile(otherUrl, file, other.urls);
    const session = createPendingImageSession();

    for (let index = 0; index < 10; index++) {
      const signal = session.startWork();
      const url = `blob:discard-${index}`;
      registerPendingImageFile(url, file, session.urls);
      expect(signal.aborted).toBe(false);
      expect(getPendingImageFile(url)).toBe(file);

      session.dispose();
      expect(signal.aborted).toBe(true);
      expect(getPendingImageFile(url)).toBeNull();
      expect(session.urls.size).toBe(0);
    }
    expect(revoke).toHaveBeenCalledTimes(10);
    expect(getPendingImageFile(otherUrl)).toBe(file);
    other.dispose();
  });

  it('forgets a committed file without racing the deferred revoke of its preview', () => {
    const session = createPendingImageSession();
    const url = 'blob:committed';
    registerPendingImageFile(url, new File(['preview'], 'point.jpg'), session.urls);
    removePendingImageFile(url);
    session.dispose();
    expect(getPendingImageFile(url)).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
  });
});
