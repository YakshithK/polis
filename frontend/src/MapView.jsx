import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DISTRICTS_GEOJSON } from './districts';
import { DISTRICT_COLORS } from './FeedEntry';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function emotionToColor(state) {
  const { excitement, tension, pride, frustration } = state.emotion;
  const BASELINE = 50;
  const excD = excitement  - BASELINE;
  const tenD = tension     - BASELINE;
  const priD = pride       - BASELINE;
  const fruD = frustration - BASELINE;
  const maxD = Math.max(excD, tenD, priD, fruD);

  if (maxD < 4) return 'hsl(220, 8%, 82%)'; // near-baseline → neutral grey

  const intensity = Math.min(maxD / 45, 1.0);
  let h = 24, s = 85;
  if      (maxD === excD) { h = 24;  s = 85; }
  else if (maxD === tenD) { h = 280; s = 75; }
  else if (maxD === priD) { h = 217; s = 80; }
  else                    { h = 0;   s = 78; }
  const l = 82 - intensity * 38;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

const NATHAN_PHILLIPS = [-79.383, 43.653]; // city gathering point for festivals

const EVENT_EMOJIS = {
  transit_strike:  ['🚇', '😤', '⏰'],
  heat_wave:       ['🌡️', '😰', '🥵'],
  festival:        ['🎪', '🎉', '🎶'],
  power_outage:    ['⚡', '🕯️', '😱'],
  major_layoffs:   ['📉', '😢', '💼'],
  cultural_event:  ['🎭', '🎨', '✨'],
  protest:         ['✊', '📢', '🪧'],
  street_fair:     ['🎠', '🍦', '🎈'],
  local_incident:  ['🚨', '😬'],
  community_gathering: ['👥', '💬'],
};

// Major Toronto road corridors as [lon, lat] waypoints
const TORONTO_ROADS = [
  [[-79.388,43.641],[-79.388,43.650],[-79.388,43.665],[-79.388,43.680],[-79.388,43.700],[-79.388,43.730],[-79.388,43.760],[-79.388,43.795]], // Yonge St N-S
  [[-79.520,43.664],[-79.480,43.664],[-79.440,43.664],[-79.400,43.668],[-79.370,43.672],[-79.340,43.678],[-79.310,43.685]], // Bloor/Danforth E-W
  [[-79.550,43.705],[-79.500,43.705],[-79.460,43.705],[-79.420,43.705],[-79.390,43.705],[-79.360,43.705],[-79.330,43.705]], // Eglinton Ave E-W
  [[-79.550,43.775],[-79.500,43.775],[-79.460,43.775],[-79.420,43.775],[-79.390,43.775],[-79.350,43.775],[-79.300,43.775],[-79.260,43.775]], // Sheppard Ave E-W
  [[-79.550,43.808],[-79.500,43.808],[-79.460,43.808],[-79.420,43.808],[-79.385,43.808],[-79.350,43.808],[-79.300,43.808],[-79.250,43.808]], // Finch Ave E-W
  [[-79.550,43.733],[-79.500,43.733],[-79.460,43.733],[-79.420,43.733],[-79.390,43.733],[-79.360,43.733],[-79.330,43.733]], // Lawrence Ave E-W
  [[-79.490,43.648],[-79.450,43.648],[-79.420,43.648],[-79.400,43.648],[-79.380,43.650],[-79.360,43.650]], // Queen St E-W
  [[-79.430,43.643],[-79.410,43.644],[-79.390,43.645],[-79.370,43.646],[-79.350,43.648]], // King St E-W
  [[-79.403,43.640],[-79.403,43.650],[-79.403,43.662],[-79.403,43.673],[-79.403,43.685]], // Spadina N-S
  [[-79.414,43.640],[-79.414,43.653],[-79.414,43.665],[-79.414,43.678],[-79.414,43.695],[-79.414,43.710]], // Bathurst N-S
  [[-79.431,43.640],[-79.431,43.653],[-79.431,43.665],[-79.431,43.680],[-79.431,43.700],[-79.431,43.720]], // Dufferin N-S
  [[-79.330,43.658],[-79.330,43.680],[-79.330,43.705],[-79.330,43.730],[-79.330,43.755]], // Don Valley N-S
  [[-79.260,43.715],[-79.260,43.740],[-79.260,43.765],[-79.260,43.790],[-79.260,43.815]], // Kennedy Rd Scarborough N-S
  [[-79.190,43.750],[-79.190,43.775],[-79.190,43.800],[-79.190,43.825]], // Morningside Scarborough N-S
  [[-79.540,43.640],[-79.540,43.660],[-79.540,43.685],[-79.540,43.710],[-79.540,43.730]], // Kipling/Islington Etobicoke N-S
  [[-79.580,43.700],[-79.550,43.700],[-79.520,43.700],[-79.490,43.700]], // Dixon Rd Etobicoke E-W
];

const DISTRICT_ROAD_MAP = {
  downtown:        [0, 6, 7, 8, 9],
  yorkville:       [0, 1, 8, 9],
  midtown:         [0, 2, 9, 10],
  kensington:      [8, 9, 6],
  west_end:        [10, 1, 6],
  little_portugal: [10, 6],
  little_italy:    [8, 9, 1],
  rosedale:        [0, 1],
  east_york:       [11, 1],
  north_york:      [0, 3, 5, 2],
  etobicoke:       [14, 15, 3],
  scarborough:     [12, 13, 3, 4],
};


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

export default function MapView({ districts, stepMs = 120, lastEvent, simulationStarted, onDistrictClick, replayEvent, userAgent }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const geoDataRef = useRef(JSON.parse(JSON.stringify(DISTRICTS_GEOJSON)));
  const timeoutsRef = useRef([]);
  const lastProcessedEventRef = useRef(null);
  const pendingDistrictsRef = useRef(new Set());
  const hoveredRef = useRef(null);
  const [tooltip, setTooltip] = useState(null); // {x, y, name, emotion, intensity}
  const [emojiBursts, setEmojiBursts] = useState([]); // [{id, x, y, emoji}]
  const districtsRef = useRef(districts);
  const lastEmojiEventRef = useRef(null);
  const canvasRef = useRef(null);
  const onEventReceivedRef = useRef(null);
  const featureColorsRef = useRef(new Map());

  districtsRef.current = districts;

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

    const sourceId = event.source_district || 'downtown';
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
        const savedColor = featureColorsRef.current.get(feature.id) ?? feature.properties.districtColor ?? 'hsl(24, 10%, 90%)';
        map.setFeatureState({ source: 'toronto-districts', id: feature.id }, { flashColor: 'hsl(24, 85%, 95%)' });
        setTimeout(() => {
          map.setFeatureState({ source: 'toronto-districts', id: feature.id }, { flashColor: savedColor });
        }, 400);
      }, rank * step);
      replayTimeouts.push(id_t);
    });

    return () => replayTimeouts.forEach(clearTimeout);
  }

  function syncFeature(feature, state) {
    const em = state.emotion ?? {};
    feature.properties.excitement  = em.excitement  ?? 0;
    feature.properties.tension     = em.tension     ?? 0;
    feature.properties.pride       = em.pride       ?? 0;
    feature.properties.frustration = em.frustration ?? 0;
  }

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-79.38, 43.82],
      zoom: 9,
      pitch: 45,
      bearing: 0,
      attributionControl: false,
      dragRotate: false,
      touchZoomRotate: false,
      maxBounds: [[-79.65, 43.55], [-79.10, 43.90]],
      minZoom: 10,
      maxZoom: 14,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Assign stable integer IDs (required for setFeatureState) and init neutral color
      geoDataRef.current.features.forEach((f, idx) => {
        f.id = idx + 1;
        f.properties.districtColor = DISTRICT_COLORS[f.properties.district_id] ?? 'hsl(24, 10%, 90%)';
        f.properties.flashColor = f.properties.districtColor;
        featureColorsRef.current.set(f.id, f.properties.districtColor);
      });

      map.addSource('toronto-districts', {
        type: 'geojson',
        data: geoDataRef.current,
      });

      // District fill — color via feature-state so Mapbox interpolates per-feature smoothly
      map.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'toronto-districts',
        paint: {
          'fill-color': ['coalesce', ['feature-state', 'flashColor'], ['get', 'districtColor'], 'hsl(24, 10%, 90%)'],
          'fill-opacity': 0.42,
          'fill-color-transition': { duration: 700, delay: 0 },
        },
      }, 'road-label');

      // District borders
      map.addLayer({
        id: 'district-borders',
        type: 'line',
        source: 'toronto-districts',
        paint: {
          'line-color': 'rgba(0, 0, 0, 0.12)',
          'line-width': 1.5,
        },
      }, 'road-label');

      // Hover highlight layer
      map.addLayer({
        id: 'district-hover',
        type: 'line',
        source: 'toronto-districts',
        filter: ['==', 'district_id', ''],
        paint: {
          'line-color': '#1a56db',
          'line-width': 2.5,
        },
      }, 'road-label');

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
          'text-color': 'rgba(10, 15, 26, 0.85)',
          'text-halo-color': 'rgba(255, 255, 255, 0.9)',
          'text-halo-width': 1.5,
        },
      });

      if (map.getSource('composite')) {
        map.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': '#101826',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.35,
          },
        }, 'waterway-label');
      }

      map.addSource('user-agent-dot', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'user-agent-dot',
        type: 'circle',
        source: 'user-agent-dot',
        paint: {
          'circle-radius': 7,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#050810',
          'circle-stroke-width': 2,
        },
      });

      // Seed feature-state so transitions fire from the very first color change
      geoDataRef.current.features.forEach(f => {
        map.setFeatureState({ source: 'toronto-districts', id: f.id }, { flashColor: f.properties.districtColor });
      });

      // Cache 2D context once — avoids getContext overhead every frame
      const agentCanvas = canvasRef.current;
      const ctx = agentCanvas ? agentCanvas.getContext('2d', { alpha: true, desynchronized: true }) : null;

      // ── TypedArray agent system ─────────────────────────────
      const N = 360;
      const aLat     = new Float32Array(N);
      const aLon     = new Float32Array(N);
      const tLat     = new Float32Array(N);
      const tLon     = new Float32Array(N);
      const aSpeed   = new Float32Array(N);
      const aState   = new Uint8Array(N);   // 0=MILLING 1=CELEBRATING 2=FLEEING 3=TENSED 4=FROZEN
      const aDist    = new Uint8Array(N);
      const frozenFor = new Int16Array(N);
      const px       = new Float32Array(N);
      const py       = new Float32Array(N);
      const aRoadIdx  = new Int8Array(N).fill(-1);
      const aWpIdx    = new Int8Array(N);
      const aWpDir    = new Int8Array(N).fill(1);
      const dotBucket = [];
      const bboxes   = [];

      const MILLING = 0, CELEBRATING = 1, FLEEING = 2, TENSED = 3, FROZEN = 4;

      const features = geoDataRef.current.features;

      function pickRoadTarget(i) {
        const distId = features[aDist[i]]?.properties?.district_id;
        const roads = DISTRICT_ROAD_MAP[distId] ?? [];
        if (!roads.length) return;
        const roadIdx = roads[Math.floor(Math.random() * roads.length)];
        const road = TORONTO_ROADS[roadIdx];
        if (!road?.length) return;
        aRoadIdx[i] = roadIdx;
        aWpIdx[i] = Math.floor(Math.random() * road.length);
        aWpDir[i] = Math.random() < 0.5 ? 1 : -1;
        tLon[i] = road[aWpIdx[i]][0];
        tLat[i] = road[aWpIdx[i]][1];
      }

      function advanceWaypoint(i) {
        const road = TORONTO_ROADS[aRoadIdx[i]];
        if (!road) { pickRoadTarget(i); return; }
        let next = aWpIdx[i] + aWpDir[i];
        if (next >= road.length) { aWpDir[i] = -1; next = road.length - 2; }
        if (next < 0)            { aWpDir[i] =  1; next = 1; }
        if (next < 0 || next >= road.length) { pickRoadTarget(i); return; }
        aWpIdx[i] = next;
        tLon[i] = road[next][0];
        tLat[i] = road[next][1];
      }

      features.forEach((feature, dIdx) => {
        const coords = feature.geometry.coordinates[0];
        let mnLo = Infinity, mxLo = -Infinity, mnLa = Infinity, mxLa = -Infinity;
        let sLo = 0, sLa = 0;
        coords.forEach(([lo, la]) => {
          if (lo < mnLo) mnLo = lo; if (lo > mxLo) mxLo = lo;
          if (la < mnLa) mnLa = la; if (la > mxLa) mxLa = la;
          sLo += lo; sLa += la;
        });
        bboxes.push({ minLon: mnLo, maxLon: mxLo, minLat: mnLa, maxLat: mxLa, cLon: sLo / coords.length, cLat: sLa / coords.length });

        for (let j = 0; j < 30; j++) {
          const i = dIdx * 30 + j;
          aLat[i] = mnLa + Math.random() * (mxLa - mnLa);
          aLon[i] = mnLo + Math.random() * (mxLo - mnLo);
          tLat[i] = aLat[i]; tLon[i] = aLon[i];
          aSpeed[i] = 0.06 + Math.random() * 0.04;
          aState[i] = MILLING;
          aDist[i] = dIdx;
          frozenFor[i] = 0;
          dotBucket.push(i);
          pickRoadTarget(i);
        }
      });

      function updateAgentPositions() {
        for (let i = 0; i < N; i++) {
          const s = aState[i];
          if (s === FROZEN) { if (--frozenFor[i] <= 0) aState[i] = MILLING; continue; }

          let spd = aSpeed[i];
          if (s === CELEBRATING) spd *= 3.0;
          else if (s === FLEEING) spd *= 2.5;
          else if (s === TENSED)  spd *= 0.3;

          if (s === CELEBRATING) {
            tLon[i] = NATHAN_PHILLIPS[0] + (Math.random() - 0.5) * 0.012;
            tLat[i] = NATHAN_PHILLIPS[1] + (Math.random() - 0.5) * 0.012;
          } else if (s === FLEEING) {
            const b = bboxes[aDist[i]];
            if (b) {
              const dx = aLon[i] - b.cLon, dy = aLat[i] - b.cLat;
              const len = Math.hypot(dx, dy) || 0.0001;
              tLon[i] = aLon[i] + (dx / len) * 0.015;
              tLat[i] = aLat[i] + (dy / len) * 0.015;
            }
          } else if (s === TENSED) {
            tLon[i] = aLon[i] + (Math.random() - 0.5) * 0.001;
            tLat[i] = aLat[i] + (Math.random() - 0.5) * 0.001;
          } else {
            // MILLING — follow road waypoints
            const dx = tLon[i] - aLon[i];
            const dy = tLat[i] - aLat[i];
            if (Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) {
              advanceWaypoint(i);
            }
          }

          aLon[i] += (tLon[i] - aLon[i]) * spd;
          aLat[i] += (tLat[i] - aLat[i]) * spd;
        }
      }

      function onEventReceived(event) {
        if (!event) return;
        const t = event.type;
        if (t === 'power_outage') {
          for (let i = 0; i < N; i++) { aState[i] = FROZEN; frozenFor[i] = 90; }
        } else if (t === 'transit_strike' || t === 'major_layoffs') {
          for (let i = 0; i < N; i++) { aState[i] = FLEEING; }
          setTimeout(() => { for (let i = 0; i < N; i++) if (aState[i] === FLEEING) { aState[i] = MILLING; pickRoadTarget(i); } }, 5000);
        } else if (t === 'heat_wave') {
          for (let i = 0; i < N; i++) { aState[i] = TENSED; }
          setTimeout(() => { for (let i = 0; i < N; i++) if (aState[i] === TENSED) { aState[i] = MILLING; pickRoadTarget(i); } }, 6000);
        } else if (t === 'festival' || t === 'street_fair' || t === 'cultural_event') {
          for (let i = 0; i < N; i++) { aState[i] = CELEBRATING; }
          setTimeout(() => { for (let i = 0; i < N; i++) if (aState[i] === CELEBRATING) { aState[i] = MILLING; pickRoadTarget(i); } }, 7000);
        } else if (t === 'protest') {
          for (let i = 0; i < N; i++) { aState[i] = TENSED; }
          setTimeout(() => { for (let i = 0; i < N; i++) if (aState[i] === TENSED) { aState[i] = MILLING; pickRoadTarget(i); } }, 8000);
        }
      }

      onEventReceivedRef.current = onEventReceived;

      // RAF draw loop — 15Hz position, on-demand render
      let lastPositionUpdate = 0;
      let projectionDirty = true;
      let renderDirty = true;
      let rafId;
      const _projCoord = [0, 0]; // reuse to avoid 360 allocs/frame

      function drawFrame(timestamp) {
        if (timestamp - lastPositionUpdate > 66) { // 15Hz positions — enough for slow city movement
          updateAgentPositions();
          projectionDirty = true;
          lastPositionUpdate = timestamp;
        }
        if (projectionDirty) {
          for (let i = 0; i < N; i++) {
            _projCoord[0] = aLon[i]; _projCoord[1] = aLat[i];
            const pt = map.project(_projCoord);
            px[i] = pt.x; py[i] = pt.y;
          }
          projectionDirty = false;
          renderDirty = true;
        }
        if (renderDirty && agentCanvas && ctx) {
          ctx.clearRect(0, 0, agentCanvas.width, agentCanvas.height);
          const DOT = 4;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          for (let k = 0; k < dotBucket.length; k++) { const i = dotBucket[k]; ctx.rect(px[i] - 2, py[i] - 2, DOT, DOT); }
          ctx.fill();
          renderDirty = false;
        }
        const userSource = map.getSource('user-agent-dot');
        if (userSource && userAgent) {
          const center = map.getCenter();
          userSource.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
              properties: { name: userAgent.name, job: userAgent.job },
            }],
          });
        }
        rafId = requestAnimationFrame(drawFrame);
      }

      rafId = requestAnimationFrame(drawFrame);

      // Re-project + redraw whenever the map pans or zooms
      map.on('move', () => { projectionDirty = true; renderDirty = true; });
      map.on('remove', () => cancelAnimationFrame(rafId));

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
      pitch: 45,
      bearing: 0,
      duration: 1500,
      curve: 1.2,
      essential: true,
    });

    return () => {};
  }, [simulationStarted]);

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
      pitch: 45,
      bearing: 0,
      duration: 1600,
      essential: true,
    });

    const returnTimer = setTimeout(() => {
      map.flyTo({ center: [-79.38, 43.68], zoom: 11.5, pitch: 45, bearing: 0, duration: 2000 });
    }, 5000);

    return () => clearTimeout(returnTimer);
  }, [lastEvent]);

  // Wave animation on new events; baseline sync otherwise
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource('toronto-districts')) return;

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
        }, rank * stepMs);
        timeoutsRef.current.push(id);
      });
    } else {
      entries.forEach(([districtId, state]) => {
        if (!pendingDistrictsRef.current.has(districtId)) {
          const feature = featureById[districtId];
          if (feature) {
            const color = emotionToColor({ emotion: state.emotion ?? {} });
            if (feature.properties.emotionColor !== color) syncFeature(feature, state);
          }
        }
      });
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

  // Wire lastEvent to TypedArray agent state machine
  useEffect(() => {
    if (!lastEvent) return;
    onEventReceivedRef.current?.(lastEvent);
  }, [lastEvent]);

  // Emoji burst on high-severity events
  useEffect(() => {
    if (!lastEvent || (lastEvent.severity ?? 0) < 0.7) return;
    const key = `${lastEvent.type}-${lastEvent.team}-${lastEvent.minute}`;
    if (lastEmojiEventRef.current === key) return;
    lastEmojiEventRef.current = key;

    const emojis = EVENT_EMOJIS[lastEvent.type] ?? ['✨', '🔥'];
    const districtId = lastEvent.source_district || 'downtown';
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

