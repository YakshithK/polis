import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DISTRICTS_GEOJSON } from './districts';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({ districts, stepMs = 120, lastEvent, simulationStarted, onFlyoverComplete }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const geoDataRef = useRef(JSON.parse(JSON.stringify(DISTRICTS_GEOJSON)));
  const timeoutsRef = useRef([]);
  const lastProcessedEventRef = useRef(null);
  const pendingDistrictsRef = useRef(new Set());
  const updatePendingRef = useRef(false);

  // High-performance batch updater for Mapbox source to prevent GPU thrashes
  const scheduleMapUpdate = () => {
    if (updatePendingRef.current) return;
    updatePendingRef.current = true;
    requestAnimationFrame(() => {
      const map = mapRef.current;
      if (map) {
        const src = map.getSource('toronto-districts');
        if (src) {
          src.setData(geoDataRef.current);
        }
      }
      updatePendingRef.current = false;
    });
  };

  useEffect(() => {
    if (mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      // Use a completely blank style: pure solid background color with NO base map noise
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#050810' // deep rich dark midnight void
            }
          }
        ]
      },
      center: [-79.38, 43.72], // Start high looking down
      zoom: 9,                 // Start zoomed out
      pitch: 0,                // Flat overview
      bearing: 0,
      attributionControl: false,
      dragRotate: false,       // Locked rotation to prevent judges fumbling camera
      maxBounds: [[-79.65, 43.58], [-79.10, 43.87]], // Strict Toronto bounds
      minZoom: 9,
      maxZoom: 15,
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
          'line-width': 1.5,
          'line-opacity': 0.8,
        },
      });
    });
  }, []);

  // Handle cinematic flyover once simulation starts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !simulationStarted) return;

    // Descend into the city
    map.flyTo({
      center: [-79.38, 43.68],
      zoom: 11.5,
      pitch: 58,
      bearing: -8,
      duration: 3200,
      essential: true,
    });

    const timer = setTimeout(() => {
      if (onFlyoverComplete) {
        onFlyoverComplete();
      }
    }, 3200);

    return () => clearTimeout(timer);
  }, [simulationStarted, onFlyoverComplete]);

  // Synchronize state and trigger wave animations on events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const entries = Object.entries(districts);
    if (entries.length === 0) return;

    // Check if we have a brand new event
    const isNewEvent = lastEvent && (
      !lastProcessedEventRef.current ||
      lastEvent.minute !== lastProcessedEventRef.current.minute ||
      lastEvent.type !== lastProcessedEventRef.current.type ||
      lastEvent.team !== lastProcessedEventRef.current.team
    );

    if (isNewEvent) {
      // 1. Record the new event
      lastProcessedEventRef.current = lastEvent;

      // 2. Clear any active timeouts from the previous wave
      timeoutsRef.current.forEach(id => clearTimeout(id));
      timeoutsRef.current = [];
      pendingDistrictsRef.current.clear();

      // 3. Queue up all districts to be updated via staggered timeouts
      entries.forEach(([districtId, state]) => {
        const excitement = state.emotion?.excitement ?? 50;
        const rank = state.distance_rank ?? 0;

        pendingDistrictsRef.current.add(districtId);

        const id = setTimeout(() => {
          pendingDistrictsRef.current.delete(districtId);
          const feature = geoDataRef.current.features.find(
            f => f.properties.district_id === districtId
          );
          if (feature) {
            feature.properties.excitement = excitement;
          }
          scheduleMapUpdate();
        }, rank * stepMs);

        timeoutsRef.current.push(id);
      });
    } else {
      // Regular state update or heartbeat: update only non-pending districts immediately
      let changed = false;
      entries.forEach(([districtId, state]) => {
        if (!pendingDistrictsRef.current.has(districtId)) {
          const excitement = state.emotion?.excitement ?? 50;
          const feature = geoDataRef.current.features.find(
            f => f.properties.district_id === districtId
          );
          if (feature && feature.properties.excitement !== excitement) {
            feature.properties.excitement = excitement;
            changed = true;
          }
        }
      });

      if (changed) {
        scheduleMapUpdate();
      }
    }
  }, [districts, lastEvent, stepMs]);

  return <div id="map" ref={mapContainer} />;
}
