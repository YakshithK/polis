// Toronto district approximate boundaries (roughly 2km x 2km boxes around centroids)
// Each feature has id = district_id string, plus properties.district_id and excitement: 50

function makeRect(id, name, lat, lon) {
  const dLon = 0.025;
  const dLat = 0.015;
  return {
    type: 'Feature',
    id: id,
    properties: {
      district_id: id,
      name: name,
      excitement: 50,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ]],
    },
  };
}

export const DISTRICTS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    makeRect('scarborough',     'Scarborough',     43.7764, -79.2318),
    makeRect('north_york',      'North York',      43.7615, -79.4111),
    makeRect('etobicoke',       'Etobicoke',       43.6205, -79.5132),
    makeRect('downtown',        'Downtown',        43.6532, -79.3832),
    makeRect('yorkville',       'Yorkville',       43.6709, -79.3957),
    makeRect('kensington',      'Kensington',      43.6547, -79.4005),
    makeRect('little_portugal', 'Little Portugal', 43.6490, -79.4390),
    makeRect('little_italy',    'Little Italy',    43.6610, -79.4197),
    makeRect('rosedale',        'Rosedale',        43.6782, -79.3777),
    makeRect('east_york',       'East York',       43.6920, -79.3194),
    makeRect('west_end',        'West End',        43.6426, -79.4559),
    makeRect('midtown',         'Midtown',         43.6977, -79.3855),
  ],
};
