// Toronto district boundaries — real approximate neighbourhood polygons
// Coordinates: [longitude, latitude] (GeoJSON order)

function poly(id, name, coords) {
  return {
    type: 'Feature',
    id,
    properties: { district_id: id, name, excitement: 50 },
    geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
  };
}

function rect(id, name, lonMin, latMin, lonMax, latMax) {
  return poly(id, name, [
    [lonMin, latMin], [lonMax, latMin], [lonMax, latMax], [lonMin, latMax],
  ]);
}

export const DISTRICTS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    // --- Large outer districts with irregular shapes ---
    poly('scarborough', 'Scarborough', [
      [-79.300, 43.700], [-79.218, 43.697], [-79.155, 43.712],
      [-79.155, 43.835], [-79.248, 43.840], [-79.300, 43.818],
    ]),
    poly('north_york', 'North York', [
      [-79.540, 43.722], [-79.295, 43.722], [-79.280, 43.775],
      [-79.295, 43.815], [-79.402, 43.822], [-79.482, 43.810],
      [-79.540, 43.778],
    ]),
    poly('etobicoke', 'Etobicoke', [
      [-79.648, 43.578], [-79.488, 43.578], [-79.488, 43.622],
      [-79.508, 43.690], [-79.522, 43.762], [-79.648, 43.762],
    ]),

    // --- Inner downtown core ---
    poly('downtown', 'Downtown', [
      [-79.402, 43.635], [-79.328, 43.633], [-79.323, 43.650],
      [-79.328, 43.668], [-79.402, 43.668],
    ]),

    // --- North of Bloor ---
    rect('yorkville',  'Yorkville',  -79.415, 43.665, -79.390, 43.685),
    rect('rosedale',   'Rosedale',   -79.390, 43.665, -79.348, 43.695),
    rect('midtown',    'Midtown',    -79.440, 43.688, -79.348, 43.728),

    // --- West side ---
    rect('kensington',      'Kensington',      -79.428, 43.643, -79.398, 43.668),
    rect('little_italy',    'Little Italy',    -79.442, 43.648, -79.408, 43.678),
    rect('little_portugal', 'Little Portugal', -79.472, 43.630, -79.430, 43.662),
    rect('west_end',        'West End',        -79.528, 43.615, -79.432, 43.700),

    // --- East ---
    rect('east_york', 'East York', -79.350, 43.665, -79.278, 43.730),
  ],
};
