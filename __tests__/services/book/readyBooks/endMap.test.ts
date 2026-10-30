import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import countries from '../../../../data/travelBooks/maps/countries.json';
import source from '../../../../data/travelBooks/maps/source.json';
import by from '../../../../data/travelBooks/by/source-records.json';
import pl from '../../../../data/travelBooks/pl/source-records.json';
import {buildReadyBookPagePlan, readyBookBodyPageCount} from '../../../../services/book/readyBooks/composition';
import {buildReadyBookEndMapModel, projectReadyBookMapCoordinate, renderReadyBookEndMap} from '../../../../services/book/readyBooks/render/endMap';

const book = (country: 'BY' | 'PL') => ({
  country,
  stops: (country === 'BY' ? by : pl).records.map(record => ({id: record.id, title: record.printTitle, ...record.coordinates})),
});
const profiles = ['pocket-150x100', 'album-a5'] as const;

describe('the selected-place map at the end of a ready photo diary', () => {
  it.each(['BY', 'PL'] as const)('preserves published layout 1 and uses the final map in explicit layout 2 for %s', country => {
    const input = book(country);
    const legacy = buildReadyBookPagePlan({...input, layoutVersion: 1});
    const current = buildReadyBookPagePlan({...input, layoutVersion: 2});
    const bodyPages = country === 'BY' ? 108 : 104;
    expect(legacy).toHaveLength(bodyPages);
    expect(current).toHaveLength(bodyPages);
    expect(legacy.filter(page => page.kind === 'map')).toEqual([{kind: 'map', number: 8}]);
    expect(legacy.find(page => page.kind === 'destination')!.number).toBe(9);
    expect(legacy.filter(page => page.kind !== 'padding').at(-1)!.kind).toBe('credits');
    expect(current.find(page => page.kind === 'destination')!.number).toBe(8);
    expect(current.filter(page => page.kind === 'map')).toEqual([{kind: 'map', number: country === 'BY' ? 107 : 104}]);
    expect(current).toEqual(buildReadyBookPagePlan(input));
  });

  it.each(['BY', 'PL'] as const)('keeps every %s place, roles and legend before the final map', country => {
    const input = book(country), plan = buildReadyBookPagePlan(input);
    expect(plan).toHaveLength(country === 'BY' ? 108 : 104);
    expect(plan).toHaveLength(readyBookBodyPageCount(input.stops.length));
    expect(plan.filter(page => page.kind !== 'padding').at(-1)).toMatchObject({kind: 'map', number: country === 'BY' ? 107 : 104});
    expect(plan.filter(page => page.kind === 'map')).toHaveLength(1);
    const destinations = plan.filter(page => page.kind === 'destination');
    expect(destinations.map(page => page.stopId)).toEqual(input.stops.map(stop => stop.id));
    expect(destinations[0].number).toBe(8);
    for (const destination of destinations) {
      expect(plan.slice(destination.number - 1, destination.number + 2).map(page => page.kind)).toEqual(['destination', 'photo-memory', 'notes']);
    }
    const legend = plan.filter(page => page.kind === 'checklist');
    expect(legend).toHaveLength(4);
    expect(legend.flatMap(page => page.stopIds)).toEqual(input.stops.map(stop => stop.id));
    expect(legend[0].number).toBeGreaterThan(plan.find(page => page.kind === 'credits')!.number);
    expect(legend.at(-1)!.number).toBeLessThan(plan.find(page => page.kind === 'map')!.number);
  });

  it.each(['BY', 'PL'] as const)('plots the entire %s source list with readable, distinct numbered labels', country => {
    for (const id of profiles) {
      const input = book(country), model = buildReadyBookEndMapModel(input, {id});
      expect(model.markers.map(marker => marker.stopId)).toEqual(input.stops.map(stop => stop.id));
      expect(model.markers.map(marker => marker.ordinal)).toEqual(input.stops.map((_, index) => index + 1));
      expect(model.fontSizePt).toBe(id === 'album-a5' ? 10.5 : 9);
      for (const [index, marker] of model.markers.entries()) {
        expect(marker.label.x - model.labelRadiusMm).toBeGreaterThanOrEqual(0);
        expect(marker.label.x + model.labelRadiusMm).toBeLessThanOrEqual(model.widthMm);
        expect(marker.label.y - model.labelRadiusMm).toBeGreaterThanOrEqual(0);
        expect(marker.label.y + model.labelRadiusMm).toBeLessThanOrEqual(model.heightMm);
        for (const other of model.markers.slice(index + 1)) {
          expect(Math.hypot(marker.label.x - other.label.x, marker.label.y - other.label.y))
            .toBeGreaterThanOrEqual(model.labelRadiusMm * 2 + model.labelGapMm - .0001);
        }
      }
      const svg = renderReadyBookEndMap(input, {id});
      expect(svg.match(/data-stop-id=/g)).toHaveLength(input.stops.length);
      expect(svg.match(/data-stop-position=/g)).toHaveLength(input.stops.length);
      expect(svg).toContain(`width="${model.widthMm}mm" height="${model.heightMm}mm"`);
      expect(svg).toContain(`data-country-outline="${country}"`);
      expect(svg).not.toMatch(/<polyline|<image|(?:href|src)=["']https?:/);
    }
  });

  it.each([
    ['PL', 'point-14244', 'point-14243'],
    ['PL', 'point-12590', 'point-12593'],
    ['BY', 'point-5485', 'point-5486'],
  ] as const)('separates nearby %s labels %s / %s without moving their actual coordinates', (country, first, second) => {
    const model = buildReadyBookEndMapModel(book(country), {id: 'pocket-150x100'});
    const a = model.markers.find(marker => marker.stopId === first)!;
    const b = model.markers.find(marker => marker.stopId === second)!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(model.labelRadiusMm);
    expect(Math.hypot(a.label.x - b.label.x, a.label.y - b.label.y)).toBeGreaterThan(2 * model.labelRadiusMm);
    expect(Math.hypot(a.label.x - a.x, a.label.y - a.y)).toBeGreaterThan(0);
    expect(Math.hypot(b.label.x - b.x, b.label.y - b.y)).toBeGreaterThan(0);
    expect(buildReadyBookEndMapModel(book(country), {id: 'pocket-150x100'})).toEqual(model);
  });

  it('uses the identical geographic transform for a country vertex and a selected place there', () => {
    const feature = countries.features.find(item => item.properties.isoA2 === 'BY')!;
    const [lng, lat] = feature.geometry.coordinates[0][0];
    const model = buildReadyBookEndMapModel({country: 'BY', stops: [{id: 'outline-vertex', lat, lng}]}, {id: 'album-a5'});
    const point = model.markers[0];
    expect(model.outlinePaths[0].startsWith(`M${Number(point.x.toFixed(3))},${Number(point.y.toFixed(3))}L`)).toBe(true);
  });

  it('keeps zero coordinates valid and rejects non-finite or out-of-range WGS84 input', () => {
    expect(projectReadyBookMapCoordinate(0, 0).x).toBe(0);
    expect(projectReadyBookMapCoordinate(0, 0).y).toBeCloseTo(0);
    expect(projectReadyBookMapCoordinate(54, 20).y).toBeLessThan(projectReadyBookMapCoordinate(53, 20).y);
    expect(projectReadyBookMapCoordinate(54, 21).x).toBeGreaterThan(projectReadyBookMapCoordinate(54, 20).x);
    for (const [lat, lng] of [[NaN, 20], [54, Infinity], [91, 20], [54, -181]]) {
      expect(() => projectReadyBookMapCoordinate(lat, lng)).toThrow('finite WGS84');
    }
  });

  it('escapes editorial labels and rejects duplicate or missing selected IDs', () => {
    const point = {id: 'safe', title: '<script>unsafe</script>', lat: 54, lng: 27};
    const svg = renderReadyBookEndMap({country: 'BY', stops: [point]}, {id: 'album-a5'});
    expect(svg).toContain('&lt;script&gt;unsafe&lt;/script&gt;');
    expect(svg).not.toContain('<script>');
    expect(() => buildReadyBookEndMapModel({country: 'BY', stops: [point, point]}, {id: 'album-a5'})).toThrow('distinct selected');
    expect(() => buildReadyBookEndMapModel({country: 'BY', stops: []}, {id: 'album-a5'})).toThrow('distinct selected');
  });

  it('pins the two unprojected country outlines to their public-domain source', () => {
    expect(countries.features.map(feature => feature.properties.isoA2)).toEqual(['BY', 'PL']);
    expect(source.license).toBe('Public domain');
    expect(source.attributionRequired).toBe(false);
    expect(source.coordinateReferenceSystem).toContain('4326');
    const bytes = readFileSync('data/travelBooks/maps/countries.json');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.extractedSha256);
  });
});
