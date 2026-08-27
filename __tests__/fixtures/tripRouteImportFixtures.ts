export const GPX_SINGLE_WITH_WAYPOINTS = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.1" lon="23.7"><name>  Start camp  </name></wpt>
  <wpt lat="52.15" lon="23.75"><name>Viewpoint</name></wpt>
  <wpt lat="999" lon="23.8"><name>Invalid</name></wpt>
  <trk><name>Main track</name><trkseg>
    <trkpt lat="52.1" lon="23.7"><ele>100</ele></trkpt>
    <trkpt lat="52.15" lon="23.75"><ele>120</ele></trkpt>
    <trkpt lat="52.2" lon="23.8"><ele>110</ele></trkpt>
  </trkseg></trk>
</gpx>`;

export const GPX_MULTIPLE_ROUTES = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>First</name><trkseg>
    <trkpt lat="52.1" lon="23.7"/><trkpt lat="52.2" lon="23.8"/>
  </trkseg></trk>
  <trk><name>Second</name><trkseg>
    <trkpt lat="53.1" lon="24.7"/><trkpt lat="53.2" lon="24.8"/>
  </trkseg></trk>
</gpx>`;

export const KML_WITH_NAMED_POINTS = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Finish</name><Point><coordinates>23.8,52.2,0</coordinates></Point></Placemark>
  <Placemark><name>Lunch</name><Point><coordinates>23.75,52.15,0</coordinates></Point></Placemark>
  <Placemark><name>Invalid</name><Point><coordinates>500,200,0</coordinates></Point></Placemark>
  <Placemark><name>Track</name><LineString><coordinates>
    23.7,52.1,0 23.75,52.15,0 23.8,52.2,0
  </coordinates></LineString></Placemark>
</Document></kml>`;

export const POINT_ONLY_KML_78 = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
${Array.from({ length: 78 }, (_, index) => {
  const lat = 50.01 + index * 0.001;
  const lng = 19.81 + index * 0.001;
  return `  <Placemark><name>Park ${index + 1}</name><Point><coordinates>${lng},${lat},0</coordinates></Point></Placemark>`;
}).join('\n')}
</Document></kml>`;

export const POINT_ONLY_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="52.1" lon="23.7"><name>Start camp</name></wpt>
  <wpt lat="52.15" lon="23.75"><name>Viewpoint</name></wpt>
</gpx>`;

export const EMPTY_GPX = `<?xml version="1.0"?><gpx version="1.1"><metadata/></gpx>`;

export const MALFORMED_GPX = `<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="52.1" lon="23.7"></trkseg></gpx>`;

export const UNSAFE_GPX = `<?xml version="1.0"?>
<!DOCTYPE gpx [<!ENTITY routeName "unsafe">]>
<gpx><trk><name>&routeName;</name><trkseg>
  <trkpt lat="52.1" lon="23.7"/><trkpt lat="52.2" lon="23.8"/>
</trkseg></trk></gpx>`;
