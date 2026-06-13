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
      center: [-79.38, 43.695],
      zoom: 10.8,
      pitch: 55,
      bearing: -10,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.setFog({
        color: 'rgb(8, 8, 20)',
        'high-color': 'rgb(15, 15, 40)',
        'horizon-blend': 0.04,
        'space-color': 'rgb(4, 4, 15)',
        'star-intensity': 0.6,
      });

      map.addSource('toronto-districts', {
        type: 'geojson',
        data: geoDataRef.current,
      });

      map.addLayer({
        id: 'districts-fill',
        type: 'fill',
        source: 'toronto-districts',
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'excitement'],
            0, '#0f172a',
            50, '#1e3a8a',
            100, '#7c2d12',
          ],
          'fill-opacity': 0.4,
        },
      });

      map.addLayer({
        id: 'districts-extrusion',
        type: 'fill-extrusion',
        source: 'toronto-districts',
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'excitement'],
            0,   '#0f172a',
            25,  '#1e3a8a',
            50,  '#2563eb',
            70,  '#f97316',
            85,  '#ef4444',
            100, '#dc2626',
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['get', 'excitement'],
            0, 25,
            100, 650,
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['get', 'excitement'],
            0, 0,
            100, 20,
          ],
          'fill-extrusion-opacity': 0.88,
          'fill-extrusion-height-transition': { duration: 900, delay: 0 },
          'fill-extrusion-color-transition': { duration: 900, delay: 0 },
        },
      });

      map.addLayer({
        id: 'districts-outline',
        type: 'line',
        source: 'toronto-districts',
        paint: {
          'line-color': '#334155',
          'line-width': 1,
          'line-opacity': 0.6,
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
