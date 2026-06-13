import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DISTRICTS_GEOJSON } from './districts';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({ districts, stepMs = 120 }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const geoDataRef = useRef(JSON.parse(JSON.stringify(DISTRICTS_GEOJSON)));
  const timeoutsRef = useRef([]);

  useEffect(() => {
    if (mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-79.3832, 43.6532],
      zoom: 10.5,
      pitch: 45,
      bearing: -15,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('toronto-districts', {
        type: 'geojson',
        data: geoDataRef.current,
      });

      map.addLayer({
        id: 'districts-fill',
        type: 'fill',
        source: 'toronto-districts',
        paint: {
          'fill-color': '#1e3a8a',
          'fill-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'districts-extrusion',
        type: 'fill-extrusion',
        source: 'toronto-districts',
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'excitement'],
            0, '#1e3a8a',
            50, '#f97316',
            100, '#ef4444'
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['get', 'excitement'],
            0, 10,
            100, 500
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
          'fill-extrusion-height-transition': { duration: 800, delay: 0 },
          'fill-extrusion-color-transition': { duration: 800, delay: 0 },
        },
      });
    });
  }, []);

  // Update map when district states change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const entries = Object.entries(districts);
    if (entries.length === 0) return;

    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];

    entries.forEach(([districtId, state]) => {
      const excitement = state.emotion?.excitement ?? 50;
      const rank = state.distance_rank ?? 0;
      const id = setTimeout(() => {
        const feature = geoDataRef.current.features.find(
          f => f.properties.district_id === districtId
        );
        if (feature) feature.properties.excitement = excitement;
        const src = mapRef.current?.getSource('toronto-districts');
        if (src) src.setData(geoDataRef.current);
      }, rank * stepMs);
      timeoutsRef.current.push(id);
    });
  }, [districts, stepMs]);

  return <div id="map" ref={mapContainer} />;
}
