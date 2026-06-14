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

const BMO_FIELD = [-79.4186, 43.6332];
const AGENT_JITTER = 0.0002;
const EVENT_SOURCE = {
  goal: 'downtown',
  red_card: 'downtown',
  var_review: 'downtown',
  penalty_miss: 'downtown',
  elimination: 'downtown',
  championship_win: 'downtown',
};

const EVENT_EMOJIS = {
  goal:             ['⚽', '🎉', '🇨🇦', '🔥'],
  red_card:         ['🟥', '😱', '❗'],
  var_review:       ['📺', '🤔'],
  penalty_miss:     ['😬', '😩'],
  elimination:      ['💀', '😢'],
  championship_win: ['🏆', '🎊', '🇨🇦'],
};

function clampAgent(agent) {
  const { lonMin, lonMax, latMin, latMax } = agent.bounds;
  agent.x = Math.max(lonMin, Math.min(lonMax, agent.x));
  agent.y = Math.max(latMin, Math.min(latMax, agent.y));
}

function featureCentroid(feature) {
  const coords = feature.geometry.coordinates[0];
  let sumLon = 0;
  let sumLat = 0;
  coords.forEach(([lon, lat]) => {
    sumLon += lon;
    sumLat += lat;
  });
  return [sumLon / coords.length, sumLat / coords.length];
}

function replayStepMs(severity) {
  if (severity >= 0.8) return 80;
  if (severity <= 0.4) return 180;
  return 120;
}

export default function MapView({ districts, stepMs = 120, lastEvent, simulationStarted, onFlyoverComplete, onDistrictClick, replayEvent }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const geoDataRef = useRef(JSON.parse(JSON.stringify(DISTRICTS_GEOJSON)));
  const timeoutsRef = useRef([]);
  const lastProcessedEventRef = useRef(null);
  const pendingDistrictsRef = useRef(new Set());
  const updatePendingRef = useRef(false);
  const hoveredRef = useRef(null);
  const [tooltip, setTooltip] = useState(null); // {x, y, name, emotion, intensity}
  const [emojiBursts, setEmojiBursts] = useState([]); // [{id, x, y, emoji}]
  const agentsRef = useRef([]);
  const districtsRef = useRef(districts);
  const agentAnimRef = useRef(null);
  const lastEmojiEventRef = useRef(null);
  const canvasRef = useRef(null);

  districtsRef.current = districts;

  function drawAgentCanvas() {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map || !map.isStyleLoaded()) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    agentsRef.current.forEach(a => {
      const { x, y } = map.project([a.x, a.y]);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function spawnEmojiBurst(districtId, emojis) {
    const map = mapRef.current;
    if (!map || !emojis?.length) return;
    const feature = geoDataRef.current.features.find(
      f => f.properties.district_id === districtId,
    );
    if (!feature) return;
    const [lon, lat] = featureCentroid(feature);
    const point = map.project([lon, lat]);
    const count = 3 + Math.floor(Math.random() * 3);
    const particles = Array.from({ length: count }, (_, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      x: point.x + (Math.random() - 0.5) * 40,
      y: point.y + (Math.random() - 0.5) * 20,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }));
    setEmojiBursts(prev => [...prev, ...particles]);
    particles.forEach(p => {
      setTimeout(() => {
        setEmojiBursts(prev => prev.filter(x => x.id !== p.id));
      }, 1500);
    });
  }

  function triggerReplayWave(event) {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !event) return;

    const sourceId = event.source_district || EVENT_SOURCE[event.type] || 'downtown';
    const sourceFeature = geoDataRef.current.features.find(
      f => f.properties.district_id === sourceId,
    );
    if (!sourceFeature) return;

    const [sLon, sLat] = featureCentroid(sourceFeature);
    const ranked = geoDataRef.current.features
      .map(f => {
        const [lon, lat] = featureCentroid(f);
        const dist = Math.hypot(lon - sLon, lat - sLat);
        return { id: f.properties.district_id, dist, feature: f };
      })
      .sort((a, b) => a.dist - b.dist);

    const step = replayStepMs(event.severity ?? 0.8);
    const replayTimeouts = [];

    ranked.forEach(({ feature }, index) => {
      const rank = index;
      const id_t = setTimeout(() => {
        const savedColor = feature.properties.fill_color;
        const savedOpacity = feature.properties.fill_opacity;
        feature.properties.fill_color = '#ffffff';
        feature.properties.fill_opacity = Math.min(0.95, savedOpacity + 0.25);
        scheduleMapUpdate();
        setTimeout(() => {
          feature.properties.fill_color = savedColor;
          feature.properties.fill_opacity = savedOpacity;
          scheduleMapUpdate();
        }, 400);
      }, rank * step);
      replayTimeouts.push(id_t);
    });

    return () => replayTimeouts.forEach(clearTimeout);
  }

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

      // Seed agent dots inside district bounding boxes
      const agents = [];
      geoDataRef.current.features.forEach(feature => {
        const districtId = feature.properties.district_id;
        let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
        let sumLon = 0, sumLat = 0, count = 0;
        
        const coords = feature.geometry.coordinates[0];
        coords.forEach(([lon, lat]) => {
          if (lon < lonMin) lonMin = lon;
          if (lon > lonMax) lonMax = lon;
          if (lat < latMin) latMin = lat;
          if (lat > latMax) latMax = lat;
          sumLon += lon;
          sumLat += lat;
          count++;
        });
        
        const centroidX = sumLon / count;
        const centroidY = sumLat / count;
        
        for (let i = 0; i < 60; i++) {
          const x = lonMin + Math.random() * (lonMax - lonMin);
          const y = latMin + Math.random() * (latMax - latMin);
          agents.push({
            id: `${districtId}-${i}`,
            districtId,
            x,
            y,
            originX: x,
            originY: y,
            bounds: { lonMin, lonMax, latMin, latMax },
            centroidX,
            centroidY,
            mode: 'normal',
            modeTimer: 0
          });
        }
      });
      agentsRef.current = agents;

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

  // Keep canvas pixel size matched to map container
  useEffect(() => {
    const container = mapContainer.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const sync = () => {
      canvas.width  = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };
    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // Agent dot Brownian motion — draws directly to Canvas overlay (no Mapbox setData)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let running = true;
    const tick = (now) => {
      if (!running) return;
      const agents = agentsRef.current;
      if (agents.length) {
        agents.forEach(agent => {
          if (agent.mode === 'freeze') {
            if (now >= agent.modeTimer) agent.mode = 'normal';
            return;
          }
          if (agent.mode === 'goal_drift') {
            const t = 0.012;
            agent.x += (BMO_FIELD[0] - agent.x) * t;
            agent.y += (BMO_FIELD[1] - agent.y) * t;
            if (now >= agent.modeTimer) {
              agent.mode = 'return';
              agent.modeTimer = now + 3000;
            }
          } else if (agent.mode === 'return') {
            const t = 0.015;
            agent.x += (agent.originX - agent.x) * t;
            agent.y += (agent.originY - agent.y) * t;
            if (now >= agent.modeTimer) agent.mode = 'normal';
          } else if (agent.mode === 'scatter') {
            const dx = agent.x - agent.centroidX;
            const dy = agent.y - agent.centroidY;
            const len = Math.hypot(dx, dy) || 0.0001;
            agent.x += (dx / len) * 0.00035;
            agent.y += (dy / len) * 0.00035;
            if (now >= agent.modeTimer) agent.mode = 'normal';
          } else {
            agent.x += (Math.random() - 0.5) * 2 * AGENT_JITTER;
            agent.y += (Math.random() - 0.5) * 2 * AGENT_JITTER;
          }
          clampAgent(agent);
        });
        drawAgentCanvas();
      }
      agentAnimRef.current = requestAnimationFrame(tick);
    };

    agentAnimRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (agentAnimRef.current) cancelAnimationFrame(agentAnimRef.current);
    };
  }, []);

  // Switch agent modes on match events
  useEffect(() => {
    if (!lastEvent) return;
    const agents = agentsRef.current;
    if (!agents.length) return;
    const now = performance.now();
    const districtStates = districtsRef.current;

    if (lastEvent.type === 'var_review') {
      agents.forEach(a => {
        a.mode = 'freeze';
        a.modeTimer = now + 3000;
      });
    } else if (lastEvent.type === 'elimination') {
      agents.forEach(a => {
        a.mode = 'scatter';
        a.modeTimer = now + 3000;
      });
    } else if (lastEvent.type === 'goal' && lastEvent.team === 'canada') {
      agents.forEach(a => {
        const state = districtStates[a.districtId];
        const exc = state?.emotion?.excitement ?? 0;
        const ca = state?.alignment?.canada_support ?? 0;
        if (exc > 60 || ca > 60) {
          a.mode = 'goal_drift';
          a.modeTimer = now + 3000;
        }
      });
    }
  }, [lastEvent]);

  // Emoji burst on high-severity events
  useEffect(() => {
    if (!lastEvent || (lastEvent.severity ?? 0) < 0.7) return;
    const key = `${lastEvent.type}-${lastEvent.team}-${lastEvent.minute}`;
    if (lastEmojiEventRef.current === key) return;
    lastEmojiEventRef.current = key;

    const emojis = EVENT_EMOJIS[lastEvent.type] ?? ['✨', '🔥'];
    const districtId = lastEvent.source_district || EVENT_SOURCE[lastEvent.type] || 'downtown';
    spawnEmojiBurst(districtId, emojis);
  }, [lastEvent]);

  // Visual-only wave replay from event log clicks
  useEffect(() => {
    if (!replayEvent) return;
    return triggerReplayWave(replayEvent);
  }, [replayEvent]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div id="map" ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div className="emoji-burst-container">
        {emojiBursts.map(p => (
          <span
            key={p.id}
            className="emoji-burst-particle"
            style={{ left: p.x, top: p.y }}
          >
            {p.emoji}
          </span>
        ))}
      </div>
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

