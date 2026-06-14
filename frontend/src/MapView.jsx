import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DISTRICTS_GEOJSON } from './districts';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function emotionToColor(state) {
  const { excitement, tension, pride, frustration } = state.emotion;
  const dominant = Math.max(excitement, tension, pride, frustration);
  const intensity = dominant / 100;
  let h = 24, s = 85;
  if (dominant === excitement)        { h = 24;  s = 85; }
  else if (dominant === tension)      { h = 280; s = 75; }
  else if (dominant === pride)        { h = 217; s = 80; }
  else if (dominant === frustration)  { h = 0;   s = 78; }
  const l = 90 - (intensity * 45);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

const BMO_FIELD = [-79.4186, 43.6332];
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
  const districtsRef = useRef(districts);
  const lastEmojiEventRef = useRef(null);
  const canvasRef = useRef(null);
  const onEventReceivedRef = useRef(null);

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
        const savedColor = feature.properties.emotionColor;
        feature.properties.emotionColor = 'hsl(24, 85%, 95%)';
        scheduleMapUpdate();
        setTimeout(() => {
          feature.properties.emotionColor = savedColor;
          scheduleMapUpdate();
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
    feature.properties.emotionColor = emotionToColor({ emotion: em });
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
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-79.38, 43.82],
      zoom: 9,
      pitch: 0,
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
      // Initialize features with neutral color
      geoDataRef.current.features.forEach(f => {
        f.properties.emotionColor = 'hsl(24, 10%, 90%)';
      });

      map.addSource('toronto-districts', {
        type: 'geojson',
        data: geoDataRef.current,
      });

      // District fill — driven by emotion color, static opacity
      map.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'toronto-districts',
        paint: {
          'fill-color': ['get', 'emotionColor'],
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

      // ── TypedArray agent system ─────────────────────────────
      const N = 360;
      const aLat = new Float32Array(N);
      const aLon = new Float32Array(N);
      const tLat = new Float32Array(N);
      const tLon = new Float32Array(N);
      const aSpeed = new Float32Array(N);
      const aState = new Uint8Array(N);  // 0=MILLING 1=CELEBRATING 2=FLEEING 3=TENSED 4=FROZEN
      const aDist = new Uint8Array(N);
      const frozenFor = new Int16Array(N);
      const px = new Float32Array(N);
      const py = new Float32Array(N);
      const cooldown = new Uint16Array(N);
      const redBucket = [], greyBucket = [], blueBucket = [];
      const bboxes = [];  // { minLon, maxLon, minLat, maxLat, cLon, cLat }

      const RED_T = 0.65, BLUE_T = 0.35;
      const MILLING = 0, CELEBRATING = 1, FLEEING = 2, TENSED = 3, FROZEN = 4;

      const features = geoDataRef.current.features;
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

        const distId = feature.properties.district_id;
        const dState = Object.values(districtsRef.current).find(d => d.district_id === distId);
        const support = (dState?.alignment?.canada_support ?? 50) / 100;

        for (let j = 0; j < 30; j++) {
          const i = dIdx * 30 + j;
          aLat[i] = mnLa + Math.random() * (mxLa - mnLa);
          aLon[i] = mnLo + Math.random() * (mxLo - mnLo);
          tLat[i] = aLat[i]; tLon[i] = aLon[i];
          aSpeed[i] = 0.025 + Math.random() * 0.015;
          aState[i] = MILLING;
          aDist[i] = dIdx;
          frozenFor[i] = 0;
          cooldown[i] = Math.floor(Math.random() * 120);
          if (support > RED_T) redBucket.push(i);
          else if (support < BLUE_T) blueBucket.push(i);
          else greyBucket.push(i);
        }
      });

      function pickNewTarget(i) {
        const b = bboxes[aDist[i]]; if (!b) return;
        tLon[i] = b.minLon + Math.random() * (b.maxLon - b.minLon);
        tLat[i] = b.minLat + Math.random() * (b.maxLat - b.minLat);
      }

      function updateAgentPositions() {
        for (let i = 0; i < N; i++) {
          const s = aState[i];
          if (s === FROZEN) { if (--frozenFor[i] <= 0) aState[i] = MILLING; continue; }
          let spd = aSpeed[i];
          if (s === CELEBRATING) spd *= 3.5;
          else if (s === FLEEING) spd *= 2.5;
          else if (s === TENSED) spd *= 0.4;

          if (--cooldown[i] <= 0) {
            const b = bboxes[aDist[i]];
            if (s === CELEBRATING) {
              tLon[i] = BMO_FIELD[0]; tLat[i] = BMO_FIELD[1]; cooldown[i] = 90;
            } else if (s === FLEEING && b) {
              const dx = aLon[i] - b.cLon, dy = aLat[i] - b.cLat;
              const len = Math.hypot(dx, dy) || 0.0001;
              tLon[i] = aLon[i] + (dx / len) * 0.02;
              tLat[i] = aLat[i] + (dy / len) * 0.02;
              cooldown[i] = 30;
            } else if (s === TENSED) {
              tLon[i] = aLon[i] + (Math.random() - 0.5) * 0.003;
              tLat[i] = aLat[i] + (Math.random() - 0.5) * 0.003;
              cooldown[i] = 15;
            } else {
              pickNewTarget(i); cooldown[i] = 60 + Math.floor(Math.random() * 120);
            }
          }

          aLon[i] += (tLon[i] - aLon[i]) * spd;
          aLat[i] += (tLat[i] - aLat[i]) * spd;

          // Clamp to district for milling/tensed
          if (s === MILLING || s === TENSED) {
            const b = bboxes[aDist[i]];
            if (b) {
              aLon[i] = Math.max(b.minLon, Math.min(b.maxLon, aLon[i]));
              aLat[i] = Math.max(b.minLat, Math.min(b.maxLat, aLat[i]));
            }
          }
        }
      }

      function onEventReceived(event) {
        if (!event) return;
        if (event.type === 'var_review' || event.type === 'penalty_miss') {
          for (let i = 0; i < N; i++) { aState[i] = TENSED; cooldown[i] = 20; }
          setTimeout(() => { for (let i = 0; i < N; i++) if (aState[i] === TENSED) aState[i] = MILLING; }, 4000);
        } else if (event.type === 'red_card') {
          for (let i = 0; i < N; i++) { aState[i] = FROZEN; frozenFor[i] = 90; }
        } else if (event.type === 'elimination') {
          for (let i = 0; i < N; i++) { aState[i] = FLEEING; cooldown[i] = 0; }
          setTimeout(() => { for (let i = 0; i < N; i++) if (aState[i] === FLEEING) aState[i] = MILLING; }, 5000);
        } else if (event.type === 'championship_win') {
          for (let i = 0; i < N; i++) { aState[i] = CELEBRATING; cooldown[i] = 0; }
        } else if (event.type === 'goal' && event.team === 'canada') {
          redBucket.forEach(i => { aState[i] = CELEBRATING; cooldown[i] = 0; });
          greyBucket.forEach(i => { aState[i] = CELEBRATING; cooldown[i] = 0; });
          setTimeout(() => {
            redBucket.forEach(i => { if (aState[i] === CELEBRATING) aState[i] = MILLING; });
            greyBucket.forEach(i => { if (aState[i] === CELEBRATING) aState[i] = MILLING; });
          }, 6000);
        } else if (event.type === 'goal' && event.team === 'opponent') {
          blueBucket.forEach(i => { aState[i] = CELEBRATING; cooldown[i] = 0; });
          setTimeout(() => { blueBucket.forEach(i => { if (aState[i] === CELEBRATING) aState[i] = MILLING; }); }, 6000);
        }
      }

      onEventReceivedRef.current = onEventReceived;

      // RAF draw loop — 30Hz position, 60Hz render
      let lastPositionUpdate = 0;
      let projectionDirty = true;
      let rafId;

      function drawFrame(timestamp) {
        if (timestamp - lastPositionUpdate > 33) {
          updateAgentPositions();
          projectionDirty = true;
          lastPositionUpdate = timestamp;
        }
        if (projectionDirty) {
          for (let i = 0; i < N; i++) {
            const pt = map.project([aLon[i], aLat[i]]);
            px[i] = pt.x; py[i] = pt.y;
          }
          projectionDirty = false;
        }
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false, desynchronized: true });
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const DOT = 4;
          ctx.fillStyle = '#cc0000';
          redBucket.forEach(i => ctx.fillRect(px[i] - 2, py[i] - 2, DOT, DOT));
          ctx.fillStyle = '#94a3b8';
          greyBucket.forEach(i => ctx.fillRect(px[i] - 2, py[i] - 2, DOT, DOT));
          ctx.fillStyle = '#1a56db';
          blueBucket.forEach(i => ctx.fillRect(px[i] - 2, py[i] - 2, DOT, DOT));
        }
        rafId = requestAnimationFrame(drawFrame);
      }

      rafId = requestAnimationFrame(drawFrame);

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
      pitch: 0,
      bearing: 0,
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
      pitch: 0,
      bearing: 0,
      duration: 1600,
      essential: true,
    });

    const returnTimer = setTimeout(() => {
      map.flyTo({ center: [-79.38, 43.68], zoom: 11.5, pitch: 0, bearing: 0, duration: 2000 });
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
            const color = emotionToColor({ emotion: state.emotion ?? {} });
            if (feature.properties.emotionColor !== color) {
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

