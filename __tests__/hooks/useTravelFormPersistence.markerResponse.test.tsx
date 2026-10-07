import { act, renderHook } from '@testing-library/react-native';
import { useTravelFormPersistence } from '@/hooks/useTravelFormPersistence';
import { getEmptyFormData } from '@/utils/travelFormUtils';
import type { MarkerData, TravelFormData } from '@/types/types';

jest.mock('@/api/misc', () => ({ saveFormData: jest.fn() }));
jest.mock('@/utils/toast', () => ({ showToastMessage: jest.fn() }));
jest.mock('@/hooks/useImprovedAutoSave', () => ({
  useImprovedAutoSave: jest.fn(() => ({ updateBaseline: jest.fn(), cancelPending: jest.fn(), status: 'idle' })),
}));

const a: MarkerData = { id: 101, lat: 53.9, lng: 27.56, country: 19, address: 'A', categories: [1], image: 'https://example.com/a.jpg' };
const b: MarkerData = { ...a, id: 102, lat: 53.91, address: 'B' };
const travel = (markers: MarkerData[]): TravelFormData => ({ ...getEmptyFormData('225'), id: 225, name: 'Route', coordsMeTravel: markers });

function setup(source: TravelFormData, current: TravelFormData = source) {
  const baseline = jest.fn();
  const params = {
    formState: { data: source, reset: jest.fn(), updateField: jest.fn(), updateFields: jest.fn() },
    initialFormData: source, stableTravelId: 225, queryClient: null, userId: '1',
    isAuthenticated: true, hasAccess: true, isFormHydrated: true, isOnline: true,
    isManualSaveInFlight: false, setIsManualSaveInFlight: jest.fn(), setMarkers: jest.fn(), showToast: jest.fn(),
    formDataRef: { current }, saveAbortControllerRef: { current: null }, mountedRef: { current: true },
    manualSaveInFlightRef: { current: false }, manualSavePromiseRef: { current: null },
    suppressAutosaveErrorToastRef: { current: false }, pendingBaselineRef: { current: null },
    serverTextBaselineRef: { current: null }, didInvalidateAfterCreateRef: { current: false },
    updateBaselineRef: { current: baseline }, rehydrateMarkerIdsFromServer: jest.fn().mockResolvedValue(null),
    uploadPendingMarkerImages: jest.fn().mockResolvedValue(undefined),
  } as unknown as Parameters<typeof useTravelFormPersistence>[0];
  return { ...renderHook(() => useTravelFormPersistence(params)), params };
}

describe('late marker save response preserves latest route ownership', () => {
  it.each(['sent reorder', 'in-flight reorder', 'deleted point', 'deleted all', 'edited point'])('keeps current route after response: %s', async (change) => {
    const source = travel(change === 'sent reorder' ? [b, a] : [a, b]);
    const current = change.includes('reorder') ? [b, a] : change === 'deleted point' ? [b] : change === 'deleted all' ? [] : [{ ...a, address: 'New address', categories: [9] }, b];
    const { result, params } = setup(source, travel(current));
    await act(async () => {
      result.current.applySavedData(travel([{ ...a, image: 'https://example.com/new-a.jpg' }, b]), source, { preserveEditingState: true });
    });
    expect(params.formDataRef.current.coordsMeTravel.map(marker => marker.id)).toEqual(current.map(marker => marker.id));
    if (change === 'edited point') expect(params.formDataRef.current.coordsMeTravel[0]).toEqual(expect.objectContaining({ address: 'New address', categories: [9], image: 'https://example.com/new-a.jpg' }));
  });

  it.each([null, 'https://example.com/newer-user-photo.jpg', 'blob:http://localhost/newer-photo'])('keeps a newer user image change: %s', async (image) => {
    const source = travel([a, b]);
    const { result, params } = setup(source, travel([{ ...a, image }, b]));
    await act(async () => {
      result.current.applySavedData(travel([{ ...a, image: 'https://example.com/stale-response.jpg' }, b]), source, { preserveEditingState: true });
    });
    expect(params.formDataRef.current.coordsMeTravel[0].image).toBe(image);
  });

  it('assigns server ids one-to-one without replacing distinct previews at identical coordinates', async () => {
    const first = { ...a, id: null, image: 'blob:http://localhost/first' };
    const second = { ...b, id: null, lat: a.lat, image: 'blob:http://localhost/second' };
    const source = travel([first, second]);
    const { result, params } = setup(source);
    await act(async () => {
      result.current.applySavedData(travel([{ ...first, id: 201, image: null }, { ...second, id: 202, image: null }]), source);
    });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([{ ...first, id: 201 }, { ...second, id: 202 }]);
  });

  it('keeps new local points in their current position and does not mutate the response', async () => {
    const source = travel([a, b]);
    const added = { ...a, id: null, lat: 54, address: 'Added' };
    const liveA = { ...a, address: 'Edited' };
    const response = travel([a, b]);
    const { result, params } = setup(source, travel([added, b, liveA]));
    await act(async () => { result.current.applySavedData(response, source); });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([added, b, liveA]);
    expect(response.coordsMeTravel).toEqual([a, b]);
  });

  it('does not graft a different persisted id onto a coincident point', async () => {
    const source = travel([a]);
    const replacement = { ...a, id: 999, address: 'Replacement' };
    const { result, params } = setup(source, travel([replacement]));
    await act(async () => { result.current.applySavedData(source, source); });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([replacement]);
  });

  it('does not assign an existing live id to a newly added coincident point', async () => {
    const source = travel([a, b]);
    const added = { ...a, id: null, address: 'Added at A', image: 'blob:http://localhost/added' };
    const { result, params } = setup(source, travel([added, a, b]));
    await act(async () => { result.current.applySavedData(source, source); });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([added, a, b]);
  });

  it.each(['New at A', a.address])('reserves a newly returned id for its dispatched id-less point before a new coincident point: %s', async (address) => {
    const dispatched = { ...a, id: null, image: 'blob:http://localhost/dispatched' };
    const added = { ...dispatched, address, image: 'blob:http://localhost/added' };
    const source = travel([dispatched]);
    const { result, params } = setup(source, travel([added, dispatched]));
    await act(async () => {
      result.current.applySavedData(travel([{ ...dispatched, id: 201, image: null }]), source);
    });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([added, { ...dispatched, id: 201 }]);
    expect(params.uploadPendingMarkerImages).toHaveBeenCalledWith([added, { ...dispatched, id: 201 }]);
  });

  it('does not assign the returned id of a removed id-less point to its coincident replacement', async () => {
    const dispatched = { ...a, id: null, image: 'blob:http://localhost/dispatched' };
    const replacement = { ...dispatched, address: 'Replacement', image: 'blob:http://localhost/replacement' };
    const source = travel([dispatched]);
    const { result, params } = setup(source, travel([replacement]));
    await act(async () => {
      result.current.applySavedData(travel([{ ...dispatched, id: 201, image: null }]), source);
    });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([replacement]);
  });

  it('preserves edited categories on a cloned dispatched id-less point', async () => {
    const dispatched = { ...a, id: null, image: 'blob:http://localhost/dispatched' };
    const edited = { ...dispatched, categories: [9] };
    const source = travel([dispatched]);
    const { result, params } = setup(source, travel([edited]));
    await act(async () => {
      result.current.applySavedData(travel([{ ...dispatched, id: 201, image: null }]), source);
    });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([{ ...edited, id: 201 }]);
  });

  it('preserves cloned id-less address edits without guessing ownership from coincident coordinates', async () => {
    const dispatched = { ...a, id: null, image: 'blob:http://localhost/dispatched' };
    const edited = { ...dispatched, address: 'Edited A', categories: [9] };
    const added = { ...dispatched, address: 'New at A', image: 'blob:http://localhost/added' };
    const source = travel([dispatched]);
    const { result, params } = setup(source, travel([added, edited]));
    await act(async () => {
      result.current.applySavedData(travel([{ ...dispatched, id: 201, image: null }]), source);
    });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([added, edited]);
    expect(params.uploadPendingMarkerImages).toHaveBeenCalledWith([added, edited]);
  });

  it('does not guess between coincident cloned id-less points with the same address', async () => {
    const dispatched = { ...a, id: null, image: 'blob:http://localhost/dispatched' };
    const cloned = { ...dispatched, categories: [9] };
    const added = { ...dispatched, image: 'blob:http://localhost/added' };
    const source = travel([dispatched]);
    const { result, params } = setup(source, travel([added, cloned]));
    await act(async () => {
      result.current.applySavedData(travel([{ ...dispatched, id: 201, image: null }]), source);
    });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([added, cloned]);
  });

  it('does not resurrect a deleted id through a new point at the same coordinates', async () => {
    const source = travel([a, b]);
    const replacement = { ...a, id: null, address: 'New point at A' };
    const { result, params } = setup(source, travel([replacement, b]));
    await act(async () => { result.current.applySavedData(source, source); });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([replacement, b]);
  });

  it('assigns returned ids to coincident new points by their distinct addresses after reorder', async () => {
    const first = { ...a, id: null, image: 'blob:http://localhost/first' };
    const second = { ...b, id: null, lat: a.lat, image: 'blob:http://localhost/second' };
    const source = travel([first, second]);
    const { result, params } = setup(source, travel([second, first]));
    await act(async () => {
      result.current.applySavedData(travel([{ ...first, id: 201, image: null }, { ...second, id: 202, image: null }]), source);
    });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([{ ...second, id: 202 }, { ...first, id: 201 }]);
  });

  it('does not recover a deleted saved id onto a new coincident pending-photo point', async () => {
    const source = travel([a, b]);
    const replacement = { ...a, id: null, address: 'Replacement', image: 'blob:http://localhost/replacement' };
    const { result, params } = setup(source, travel([replacement, b]));
    (params.rehydrateMarkerIdsFromServer as jest.Mock).mockResolvedValue([{ ...a, image: replacement.image }, b]);
    await act(async () => { result.current.applySavedData(source, source); });
    expect(params.formDataRef.current.coordsMeTravel).toEqual([replacement, b]);
    expect(params.uploadPendingMarkerImages).toHaveBeenCalledWith([replacement, b]);
  });
});
