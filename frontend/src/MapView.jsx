import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DISTRICTS_GEOJSON } from './districts';
import { WORLD_MASK_GEOJSON } from './world-mask';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Emotion color system — dominant emotion drives hue
const EMOTION_NEUTRAL = '#0d1a35';
const EMOTION_PEAKS = {
  excitement:  ['#1a3a6b', '#d97706', '#ea580c'],
  tension:     ['#2d1b69', '#7c3aed', '#a21caf'],
  pride:       ['#1e3a5f', '#1d4ed8', '#2563eb'],
  frustration: ['#3b1219', '#991b1b', '#b91c1c'],
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateColor(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

function getEmotionColor(emotion = {}) {
  const exc = emotion.excitement ?? 0;
  const ten = emotion.tension ?? 0;
  const pri = emotion.pride ?? 0;
  const fru = emotion.frustration ?? 0;

  const vals = { excitement: exc, tension: ten, pride: pri, frustration: fru };
  const dominant = Object.entries(vals).sort((a, b) => b[1] - a[1])[0];
  const [key, value] = dominant;
  const intensity = value / 100;

  const [low, mid, high] = EMOTION_PEAKS[key];
  let color;
  if (intensity < 0.4) {
    color = interpolateColor(EMOTION_NEUTRAL, low, intensity / 0.4);
  } else if (intensity < 0.7) {
    color = interpolateColor(low, mid, (intensity - 0.4) / 0.3);
  } else {
    color = interpolateColor(mid, high, (intensity - 0.7) / 0.3);
  }

  const opacity = 0.55 + intensity * 0.25;
  return { color, opacity };
}

// Layers to hide on dark-v11 base style
const LAYERS_TO_HIDE = [
  'poi-label', 'transit-label', 'building', 'building-outline',
  'road-label-navigation', 'road-minor-label', 'road-exit-shield',
  'road-intersection', 'road-number-shield',
  'border-country-primary', 'border-country-secondary-tertiary',
  'country-label', 'state-label',
];

export default function MapView({ districts, stepMs = 120, lastEvent, simulationStarted, onFlyoverComplete, onDistrictClick }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const geoDataRef = useRef(JSON.parse(JSON.stringify(DISTRICTS_GEOJSON)));
  const timeoutsRef = useRef([]);
  const lastProcessedEventRef = useRef(null);
  const pendingDistrictsRef = useRef(new Set());
  const updatePendingRef = useRef(false);
  const hoveredRef = useRef(null);
  const [tooltip, setTooltip] = useState(null); // {x, y, name, emotion, intensity}

  // Sync emotion values into feature properties and compute color
  function syncFeature(feature, state) {
    const em = state.emotion ?? {};
    feature.properties.excitement  = em.excitement  ?? 0;
    feature.properties.tension     = em.tension     ?? 0;
    feature.properties.pride       = em.pride       ?? 0;
    feature.properties.frustration = em.frustration ?? 0;
    const { color, opacity } = getEmotionColor(em);
    feature.properties.fill_color   = color;
    feature.properties.fill_opacity = opacity;
  }

  const scheduleMapUpdate = () => {
    if (updatePendingRef.current) return;
    updatePendingRef.current = true;
    requestAnimationFrame(() => {
      const map = mapRef.current;
      if (map) {
        const src = map.getSource('toronto-districts');
        if (src) src.setData(geoDataRef.current);
      }
      updatePendingRef.current = false;
    });
  };

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-79.38, 43.82],
      zoom: 9,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      dragRotate: false,
      maxBounds: [[-79.65, 43.55], [-79.10, 43.90]],
      minZoom: 10,
      maxZoom: 14,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Hide noisy base layers
      map.getStyle().layers.forEach(layer => {
        if (
          LAYERS_TO_HIDE.some(pattern => layer.id.includes(pattern)) ||
          layer.id.startsWith('settlement') ||
          layer.id.startsWith('place-') && !layer.id.includes('water')
        ) {
          try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
        }
        // Keep major roads and water only; hide minor roads
        if (layer.type === 'line' && layer['source-layer'] === 'road') {
          const cls = layer.filter?.[2] ?? '';
          if (['service', 'street', 'street_limited', 'path', 'pedestrian', 'track', 'link'].includes(cls)) {
            try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
          }
        }
      });

      // World mask — darkens everything outside Toronto
      map.addSource('world-mask', { type: 'geojson', data: WORLD_MASK_GEOJSON });
      map.addLayer({
        id: 'world-mask',
        type: 'fill',
        source: 'world-mask',
        paint: { 'fill-color': '#050810', 'fill-opacity': 0.92 },
      });

      // Initialize features with neutral color
      geoDataRef.current.features.forEach(f => {
        f.properties.fill_color   = EMOTION_NEUTRAL;
        f.properties.fill_opacity = 0.55;
      });

      map.addSource('toronto-districts', {
        type: 'geojson',
        data: geoDataRef.current,
      });

      // District fill — flat, driven by emotion color
      map.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'toronto-districts',
        paint: {
          'fill-color': ['get', 'fill_color'],
          'fill-opacity': ['get', 'fill_opacity'],
          'fill-color-transition': { duration: 700, delay: 0 },
          'fill-opacity-transition': { duration: 700, delay: 0 },
        },
      });

      // District borders — subtle blue glow
      map.addLayer({
        id: 'district-borders',
        type: 'line',
        source: 'toronto-districts',
        paint: {
          'line-color': 'rgba(80, 120, 255, 0.25)',
          'line-width': 1.5,
          'line-blur': 1,
        },
      });

      // Hover highlight layer
      map.addLayer({
        id: 'district-hover',
        type: 'line',
        source: 'toronto-districts',
        filter: ['==', 'district_id', ''],
        paint: {
          'line-color': 'rgba(80, 120, 255, 0.70)',
          'line-width': 2.5,
        },
      });

      // District name labels
      map.addLayer({
        id: 'district-labels',
        type: 'symbol',
        source: 'toronto-districts',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': 'rgba(232, 237, 248, 0.90)',
          'text-halo-color': 'rgba(5, 8, 16, 0.85)',
          'text-halo-width': 2,
        },
      });

      // Hover interaction
      map.on('mousemove', 'district-fill', (e) => {
        if (!e.features.length) return;
        const feature = e.features[0];
        const id = feature.properties.district_id;
        const name = feature.properties.name;
        if (hoveredRef.current !== id) {
          hoveredRef.current = id;
          map.setFilter('district-hover', ['==', 'district_id', id]);
          map.getCanvas().style.cursor = 'pointer';
        }
        const exc = feature.properties.excitement ?? 0;
        const ten = feature.properties.tension ?? 0;
        const pri = feature.properties.pride ?? 0;
        const fru = feature.properties.frustration ?? 0;
        const vals = { Excitement: exc, Tension: ten, Pride: pri, Frustration: fru };
        const dominant = Object.entries(vals).sort((a, b) => b[1] - a[1])[0];
        setTooltip({
          x: e.point.x + 12,
          y: e.point.y - 8,
          name,
          emotion: dominant[0],
          intensity: Math.round(dominant[1]),
        });
      });

      map.on('mouseleave', 'district-fill', () => {
        hoveredRef.current = null;
        map.setFilter('district-hover', ['==', 'district_id', '']);
        map.getCanvas().style.cursor = '';
        setTooltip(null);
      });

      // Click → district card
      map.on('click', 'district-fill', (e) => {
        if (!e.features.length) return;
        const feature = e.features[0];
        const { district_id, name } = feature.properties;
        if (onDistrictClick) {
          onDistrictClick({
            id: district_id,
            name,
            x: e.point.x,
            y: e.point.y,
            containerWidth: map.getContainer().offsetWidth,
            containerHeight: map.getContainer().offsetHeight,
          });
        }
        setTooltip(null);
      });

      // Close card on clicking outside districts
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['district-fill'] });
        if (!features.length && onDistrictClick) onDistrictClick(null);
      });
    });
  }, []);

  // Cinematic flyover when simulation starts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !simulationStarted) return;

    map.flyTo({
      center: [-79.38, 43.68],
      zoom: 11.5,
      pitch: 10,
      bearing: -5,
      duration: 3000,
      curve: 1.5,
      essential: true,
    });

    const timer = setTimeout(() => { if (onFlyoverComplete) onFlyoverComplete(); }, 3000);
    return () => clearTimeout(timer);
  }, [simulationStarted, onFlyoverComplete]);

  // Camera flyTo on high-severity events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lastEvent || lastEvent.severity < 0.8) return;
    if (!lastEvent.source_district) return;

    const f = geoDataRef.current.features.find(x => x.properties.district_id === lastEvent.source_district);
    if (!f) return;

    map.flyTo({
      center: [f.geometry.coordinates[0][0][0], f.geometry.coordinates[0][0][1]],
      zoom: 12.5,
      pitch: 15,
      bearing: (Math.random() - 0.5) * 24,
      duration: 1600,
      essential: true,
    });

    const returnTimer = setTimeout(() => {
      map.flyTo({ center: [-79.38, 43.68], zoom: 11.5, pitch: 10, bearing: 0, duration: 2000 });
    }, 5000);

    return () => clearTimeout(returnTimer);
  }, [lastEvent]);

  // Wave animation on new events; baseline sync otherwise
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const entries = Object.entries(districts);
    if (entries.length === 0) return;

    const isNewEvent = lastEvent && (
      !lastProcessedEventRef.current ||
      lastEvent.minute !== lastProcessedEventRef.current.minute ||
      lastEvent.type   !== lastProcessedEventRef.current.type  ||
      lastEvent.team   !== lastProcessedEventRef.current.team
    );

    // Build a lookup map once per render instead of .find() per district
    const featureById = {};
    geoDataRef.current.features.forEach(f => { featureById[f.properties.district_id] = f; });

    if (isNewEvent) {
      lastProcessedEventRef.current = lastEvent;
      timeoutsRef.current.forEach(id => clearTimeout(id));
      timeoutsRef.current = [];
      pendingDistrictsRef.current.clear();

      entries.forEach(([districtId, state]) => {
        const rank = state.distance_rank ?? 0;
        pendingDistrictsRef.current.add(districtId);
        const id = setTimeout(() => {
          pendingDistrictsRef.current.delete(districtId);
          const feature = featureById[districtId];
          if (feature) syncFeature(feature, state);
          scheduleMapUpdate();
        }, rank * stepMs);
        timeoutsRef.current.push(id);
      });
    } else {
      let changed = false;
      entries.forEach(([districtId, state]) => {
        if (!pendingDistrictsRef.current.has(districtId)) {
          const feature = featureById[districtId];
          if (feature) {
            const { color } = getEmotionColor(state.emotion);
            if (feature.properties.fill_color !== color) {
              syncFeature(feature, state);
              changed = true;
            }
          }
        }
      });
      if (changed) scheduleMapUpdate();
    }
  }, [districts, lastEvent, stepMs]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div id="map" ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      {tooltip && (
        <div
          className="district-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <strong>{tooltip.name}</strong> · {tooltip.emotion} {tooltip.intensity}
        </div>
      )}
    </div>
  );
}
