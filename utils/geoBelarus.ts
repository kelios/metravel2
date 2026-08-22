type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };
type Point = readonly [lng: number, lat: number];
type Ring = { points: readonly Point[]; bbox: BBox };

/**
 * Упрощённый контур Беларуси из Natural Earth 10m, закодированный дельтами
 * целых координат в сотых долях градуса. Массив переиспользует общий страновой
 * резолвер, а лёгкий предикат ниже не тянет контуры остальных стран.
 */
export const BELARUS_OUTLINE: readonly string[] = [
    '2361,5152,-8,14,15,33,-4,9,-13,4,-2,6,-30,6,-2,5,22,22,48,16,5,7,-1,27,-5,6,3,8,-30,46,-10,33,14,-4,54,6,9,-7,12,0,29,10,14,-1,-3,11,4,4,25,0,14,13,16,-1,9,5,9,-7,-5,-1,2,-8,24,2,3,8,-9,8,-17,0,10,19,11,6,-2,20,6,10,9,7,27,3,12,17,34,-2,6,10,14,5,-35,6,15,24,2,12,20,2,16,12,61,-4,6,13,28,19,18,5,20,-12,8,5,22,0,12,-14,10,-1,20,8,37,-7,4,-4,-10,-12,14,-11,20,9,13,0,10,7,20,-2,9,4,27,-7,27,-20,15,1,3,-21,-13,-10,17,-13,5,-14,-10,0,1,-7,-11,-2,-4,-14,40,-17,-11,-13,15,-4,11,-22,50,-18,2,-9,-10,-17,34,2,36,-10,5,-3,-9,-4,3,-8,29,-12,0,-11,-27,-3,3,-3,-6,-7,-30,-12,-32,3,-4,8,-15,2,-23,-3,-2,-9,-11,-8,31,-22,1,-6,-9,-5,15,-13,-8,-4,6,-14,-4,-6,13,-6,-2,-5,8,-10,-38,2,-15,-8,-13,4,-18,-2,2,-7,-20,-9,-22,-30,6,-6,4,-7,-3,-4,6,-6,-10,-13,-19,7,-4,9,-17,8,-32,-5,-19,6,-17,-10,-15,-2,-16,23,-10,3,-26,-10,-7,-13,-9,5,-4,10,-14,2,-13,-4,-12,12,-14,-9,-24,5,-12,-15,-5,3,3,10,-21,3,-21,-3,1,6,-9,1,-4,10,-30,-1,-108,18,-63,2,-75,-7,-15,-16,-26,-13,-35,4',
];

let decodedBelarusOutline: readonly Ring[] | null = null;

function getBelarusOutline(): readonly Ring[] {
    if (decodedBelarusOutline) return decodedBelarusOutline;

    decodedBelarusOutline = BELARUS_OUTLINE.map((encoded) => {
        const deltas = encoded.split(',');
        const points: Point[] = [];
        const bbox: BBox = {
            minLat: Infinity,
            maxLat: -Infinity,
            minLng: Infinity,
            maxLng: -Infinity,
        };
        let lng = 0;
        let lat = 0;

        for (let index = 0; index < deltas.length - 1; index += 2) {
            lng += Number(deltas[index]);
            lat += Number(deltas[index + 1]);
            const pointLng = lng / 100;
            const pointLat = lat / 100;
            points.push([pointLng, pointLat]);
            if (pointLat < bbox.minLat) bbox.minLat = pointLat;
            if (pointLat > bbox.maxLat) bbox.maxLat = pointLat;
            if (pointLng < bbox.minLng) bbox.minLng = pointLng;
            if (pointLng > bbox.maxLng) bbox.maxLng = pointLng;
        }

        return { points, bbox };
    });

    return decodedBelarusOutline;
}

function isInsideRing(lat: number, lng: number, ring: Ring): boolean {
    const { bbox, points } = ring;
    if (
        lat < bbox.minLat ||
        lat > bbox.maxLat ||
        lng < bbox.minLng ||
        lng > bbox.maxLng
    ) {
        return false;
    }

    let inside = false;
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
        const [lngCurrent, latCurrent] = points[index];
        const [lngPrevious, latPrevious] = points[previous];
        if (
            latCurrent > lat !== latPrevious > lat &&
            lng <
                ((lngPrevious - lngCurrent) * (lat - latCurrent)) /
                    (latPrevious - latCurrent) +
                    lngCurrent
        ) {
            inside = !inside;
        }
    }

    return inside;
}

/** Точный координатный гейт Беларуси без загрузки контуров остальных стран. */
export function isBelarusByCoords(lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return getBelarusOutline().some((ring) => isInsideRing(lat, lng, ring));
}
