import { canShowNearTravelMapMode, getNearTravelMapOrigin } from '@/components/travel/utils/nearTravelMapAvailability';

it('uses the first valid route address or legacy coordinate without accepting invalid bounds', () => {
  const source = { travelAddress: [{ coord: '95,30' }, { coord: '53.9,27.56' }], coordsMeTravel: [{ lat: 50.1, lng: 19.1 }] };
  expect(getNearTravelMapOrigin(source)).toEqual({ lat: 53.9, lng: 27.56 });
  expect(getNearTravelMapOrigin({ coordsMeTravel: [{ lat: 50.1, lng: 19.1 }] })).toEqual({ lat: 50.1, lng: 19.1 });
  expect(canShowNearTravelMapMode(getNearTravelMapOrigin({}))).toBe(false);
  expect(canShowNearTravelMapMode(getNearTravelMapOrigin({ travelAddress: [{ coord: '95,200' }] }))).toBe(false);
});

it('does not assume unknown nearby points, but exposes genuinely loaded nearby map points', () => {
  const origin = getNearTravelMapOrigin({});
  expect(canShowNearTravelMapMode(origin, [])).toBe(false);
  expect(canShowNearTravelMapMode(origin, [{ coord: '50.1,19.1' }])).toBe(true);
  expect(canShowNearTravelMapMode({ lat: 50.1, lng: 19.1 }, [])).toBe(true);
});
