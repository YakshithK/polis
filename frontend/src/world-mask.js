// Inverted Toronto polygon — fills the world outside Toronto with dark void
// The outer ring is a world-bounding box; Toronto outline is a "hole"
const TORONTO_OUTLINE = [
  [-79.65, 43.55], [-79.10, 43.55], [-79.10, 43.90], [-79.65, 43.90], [-79.65, 43.55]
];

export const WORLD_MASK_GEOJSON = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      // Outer ring: entire world
      [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
      // Inner ring (hole): Toronto bounding box — light comes through here
      TORONTO_OUTLINE,
    ],
  },
  properties: {},
};
