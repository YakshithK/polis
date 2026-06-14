import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DISTRICTS_GEOJSON } from './districts';
import { DISTRICT_COLORS } from './FeedEntry';
import { AGENTS_BY_DISTRICT } from './agents';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// ── Apple Maps emotion overlay ─────────────────────────────────────────────
function emotionToColor(state) {
  const { excitement, tension, pride, frustration } = state.emotion;
  const BASELINE = 50;
  const excD = excitement  - BASELINE;
  const tenD = tension     - BASELINE;
  const priD = pride       - BASELINE;
  const fruD = frustration - BASELINE;
  const maxD = Math.max(excD, tenD, priD, fruD);

  if (maxD < 4) return 'hsl(220, 8%, 82%)';

  const intensity = Math.min(maxD / 45, 1.0);
  let h = 24, s = 85;
  if      (maxD === excD) { h = 24;  s = 85; }
  else if (maxD === tenD) { h = 280; s = 75; }
  else if (maxD === priD) { h = 217; s = 80; }
  else                    { h = 0;   s = 78; }
  const l = 82 - intensity * 38;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ── Toronto landmarks ──────────────────────────────────────────────────────
const TORONTO_LANDMARKS = [
  { id: 'cn-tower',      emoji: '🗼', name: 'CN Tower',          coords: [-79.3871, 43.6426] },
  { id: 'bmo-field',     emoji: '⚽', name: 'BMO Field',          coords: [-79.4186, 43.6332] },
  { id: 'rogers-centre', emoji: '🏟️', name: 'Rogers Centre',     coords: [-79.3891, 43.6414] },
  { id: 'high-park',     emoji: '🌳', name: 'High Park',          coords: [-79.4634, 43.6465] },
  { id: 'distillery',    emoji: '🏭', name: 'Distillery District',coords: [-79.3594, 43.6503] },
  { id: 'toronto-sign',  emoji: '📍', name: 'Toronto Sign',       coords: [-79.3798, 43.6437] },
  { id: 'kensington',    emoji: '🛒', name: 'Kensington Market',  coords: [-79.4007, 43.6544] },
  { id: 'ripleys',       emoji: '🦈', name: "Ripley's Aquarium",  coords: [-79.3861, 43.6426] },
];

const BMO_FIELD = [-79.4186, 43.6332];

// ── District waypoints (from spec) ────────────────────────────────────────
const DISTRICT_WAYPOINTS = {
  scarborough:      [[-79.24,43.77],[-79.26,43.75],[-79.22,43.79],[-79.25,43.76]],
  north_york:       [[-79.41,43.77],[-79.43,43.75],[-79.40,43.78],[-79.42,43.76]],
  etobicoke:        [[-79.56,43.68],[-79.54,43.66],[-79.57,43.70],[-79.55,43.67]],
  downtown:         [[-79.38,43.65],[-79.39,43.66],[-79.37,43.64],[-79.38,43.65]],
  rosedale:         [[-79.37,43.68],[-79.38,43.69],[-79.36,43.67],[-79.37,43.68]],
  kensington:       [[-79.40,43.65],[-79.41,43.65],[-79.40,43.66],[-79.41,43.66]],
  little_portugal:  [[-79.43,43.65],[-79.44,43.65],[-79.43,43.66],[-79.44,43.66]],
  little_italy:     [[-79.42,43.66],[-79.43,43.67],[-79.42,43.67],[-79.43,43.66]],
  east_york:        [[-79.32,43.69],[-79.33,43.70],[-79.31,43.68],[-79.32,43.69]],
  west_end:         [[-79.45,43.65],[-79.46,43.66],[-79.44,43.65],[-79.45,43.66]],
  midtown:          [[-79.40,43.68],[-79.41,43.69],[-79.39,43.67],[-79.40,43.68]],
  yorkville:        [[-79.39,43.67],[-79.40,43.68],[-79.38,43.67],[-79.39,43.68]],
};

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
  goal:            ['⚽', '🎉', '🇨🇦'],
  red_card:        ['🟥', '😱', '⚠️'],
  championship_win:['🏆', '🎊', '🇨🇦'],
};

const DOT_RADIUS = 9;
const EMOJI_CACHE = {};
const EMOJI_SIZE = 24;

function preRenderEmoji(emoji) {
  if (EMOJI_CACHE[emoji] || typeof OffscreenCanvas === 'undefined') return;
  const oc = new OffscreenCanvas(EMOJI_SIZE, EMOJI_SIZE);
  const octx = oc.getContext('2d');
  if (!octx) return;
  octx.font = '16px serif';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText(emoji, 12, 13);
  EMOJI_CACHE[emoji] = oc;
}

function alignToColor(align) {
  if (align >= 0.65) return '#cc0000';
  if (align >= 0.50) return '#888';
  return '#1a56db';
}

function featureCentroid(feature) {
  const coords = feature.geometry.coordinates[0];
  let sumLon = 0, sumLat = 0;
  coords.forEach(([lon, lat]) => { sumLon += lon; sumLat += lat; });
  return [sumLon / coords.length, sumLat / coords.length];
}

function replayStepMs(severity) {
  if (severity >= 0.8) return 80;
  if (severity <= 0.4) return 180;
  return 120;
}

function boostColor(color, severity, distanceRank = 0) {
  const match = /^hsl\(([-\d.]+),\s*([-\d.]+)%,\s*([-\d.]+)%\)$/.exec(color);
  if (!match) return color;
  const hue = Number(match[1]);
  const saturation = Number(match[2]);
  const lightness = Number(match[3]);
  const severityBoost = Math.max(0, Math.min(1, severity ?? 0.8));
  const rankBoost = Math.max(0, 1 - distanceRank * 0.16);
  const boostedSaturation = Math.min(100, saturation + 20 + severityBoost * 12);
  const boostedLightness = Math.max(14, lightness - (18 + severityBoost * 20) * rankBoost);
  return `hsl(${hue}, ${boostedSaturation}%, ${boostedLightness}%)`;
}

// ── Agent Card ─────────────────────────────────────────────────────────────
function AgentCard({ agent, districtName, pos, memory, feedText, onClose, containerWidth, containerHeight }) {
  const cardW = 230;
  const cardH = 200;
  const margin = 12;
  let left = pos.x + 14;
  let top  = pos.y - cardH / 2;
  if (left + cardW > containerWidth - margin)  left = pos.x - cardW - 14;
  if (top < margin)                             top  = margin;
  if (top + cardH > containerHeight - margin)   top  = containerHeight - cardH - margin;

  return (
    <div className="agent-card" style={{ left, top }}>
      <div className="agent-card-header">
        <span className="agent-card-emoji">{agent.emoji}</span>
        <div>
          <div className="agent-card-name">{agent.name}</div>
          <div className="agent-card-district">{districtName}</div>
        </div>
        <button className="card-close" onClick={onClose} style={{ marginLeft: 'auto' }}>×</button>
      </div>
      <div className="agent-card-align" style={{ color: alignToColor(agent.align) }}>
        🇨🇦 {Math.round(agent.align * 100)}% Canada
      </div>
      {feedText && (
        <div className="agent-card-quote">"{feedText}"</div>
      )}
      {memory && memory.length > 0 && (
        <div className="agent-card-memory">
          <div className="card-section-label" style={{ marginBottom: 4 }}>Memory</div>
          {memory.map((m, i) => (
            <div key={i} className="agent-card-memory-row">
              {m.mood === 'excited' ? '😊' : m.mood === 'tense' ? '😰' : '😐'} {m.minute}' {m.event}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MapView ────────────────────────────────────────────────────────────────
export default function MapView({ districts, stepMs = 120, lastEvent, simulationStarted, onDistrictClick, replayEvent, userAgent, feedEntries }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const geoDataRef = useRef(JSON.parse(JSON.stringify(DISTRICTS_GEOJSON)));
  const timeoutsRef = useRef([]);
  const lastProcessedEventRef = useRef(null);
  const pendingDistrictsRef = useRef(new Set());
  const hoveredRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [emojiBursts, setEmojiBursts] = useState([]);
  const districtsRef = useRef(districts);
  const lastEmojiEventRef = useRef(null);
  const canvasRef = useRef(null);
  const onEventReceivedRef = useRef(null);
  const featureColorsRef = useRef(new Map());
  const activePulseRef = useRef(null);
  const feedEntriesRef = useRef(feedEntries ?? []);

  // Agent state (refs to live TypedArrays, set inside map.on('load'))
  const agentPxRef = useRef(null);
  const agentPyRef = useRef(null);
  const agentNRef = useRef(0);
  const agentMetaRef = useRef([]); // [{name, emoji, align, districtName, districtId}]
  const agentMemoryRef = useRef({}); // { agentIdx: [{minute, event, mood}] }
  const skipDistrictClickRef = useRef(false);
  const userAgentRef = useRef(userAgent);

  const [selectedAgentIdx, setSelectedAgentIdx] = useState(null);
  const selectedAgentIdxRef = useRef(null);
  const [agentCardPos, setAgentCardPos] = useState(null);
  const [agentCardContainerSize, setAgentCardContainerSize] = useState({ w: 800, h: 600 });

  districtsRef.current = districts;
  feedEntriesRef.current = feedEntries ?? [];

  function spawnEmojiBurst(districtId, emojis) {
    const map = mapRef.current;
    if (!map || !emojis?.length) return;
    const feature = geoDataRef.current.features.find(f => f.properties.district_id === districtId);
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
    const sourceFeature = geoDataRef.current.features.find(f => f.properties.district_id === sourceId);
    if (!sourceFeature) return;
    const [sLon, sLat] = featureCentroid(sourceFeature);
    const ranked = geoDataRef.current.features
      .map(f => {
        const [lon, lat] = featureCentroid(f);
        const dist = Math.hypot(lon - sLon, lat - sLat);
        return { dist, feature: f };
      })
      .sort((a, b) => a.dist - b.dist);
    const step = replayStepMs(event.severity ?? 0.8);
    const replayTimeouts = [];
    ranked.forEach(({ feature }, index) => {
      const id_t = setTimeout(() => {
        const savedColor = featureColorsRef.current.get(feature.id) ?? 'hsl(24, 10%, 90%)';
        map.setFeatureState({ source: 'toronto-districts', id: feature.id }, { flashColor: 'hsl(24, 85%, 95%)' });
        setTimeout(() => {
          map.setFeatureState({ source: 'toronto-districts', id: feature.id }, { flashColor: savedColor });
        }, 400);
      }, index * step);
      replayTimeouts.push(id_t);
    });
    return () => replayTimeouts.forEach(clearTimeout);
  }

  function syncFeature(feature, state) {
    const em = state.emotion ?? {};
    const map = mapRef.current;

    // Only override to emotion color when emotion is meaningfully above baseline.
    // Otherwise keep the district's assigned DISTRICT_COLOR so the map stays colorful at rest.
    const excD = (em.excitement  ?? 50) - 50;
    const tenD = (em.tension     ?? 50) - 50;
    const priD = (em.pride       ?? 50) - 50;
    const fruD = (em.frustration ?? 50) - 50;
    const maxD = Math.max(excD, tenD, priD, fruD);
    const color = maxD >= 4
      ? emotionToColor({ emotion: em })
      : (feature.properties.districtColor ?? 'hsl(24, 10%, 90%)');

    const pulse = activePulseRef.current;
    const distanceRank = state.distance_rank ?? 0;
    const pulseActive = pulse && Date.now() < pulse.expiresAt && distanceRank <= pulse.maxRank;
    const displayColor = pulseActive ? boostColor(color, pulse.severity, distanceRank) : color;
    feature.properties.excitement  = em.excitement  ?? 0;
    feature.properties.tension     = em.tension     ?? 0;
    feature.properties.pride       = em.pride       ?? 0;
    feature.properties.frustration = em.frustration ?? 0;
    feature.properties.emotionColor = displayColor;
    featureColorsRef.current.set(feature.id, displayColor);
    if (map && map.getSource('toronto-districts')) {
      map.setFeatureState({ source: 'toronto-districts', id: feature.id }, { flashColor: displayColor });
    }
  }

  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-79.38, 43.70],
      zoom: 11.2,
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
      // ── Apple Maps paint overrides ──────────────────────────────────────
      try {
        map.setPaintProperty('background', 'background-color', '#F2F0EB');
      } catch (_) {}
      try {
        map.setPaintProperty('landuse', 'fill-color', [
          'match', ['get', 'class'],
          ['park', 'recreation_ground', 'garden', 'golf_course'], '#CAE4B3',
          '#F2F0EB',
        ]);
      } catch (_) {}
      try {
        map.setPaintProperty('water', 'fill-color', '#B3D8F0');
        map.setPaintProperty('water', 'fill-outline-color', '#8EC8E8');
      } catch (_) {}
      ['road-secondary-tertiary', 'road-secondary-tertiary-case'].forEach(l => {
        try { map.setPaintProperty(l, 'line-color', '#FFFFFF'); } catch (_) {}
      });
      ['road-primary', 'road-primary-case'].forEach(l => {
        try { map.setPaintProperty(l, 'line-color', '#FFFFFF'); } catch (_) {}
      });
      ['road-motorway-trunk', 'road-motorway-trunk-case'].forEach(l => {
        try { map.setPaintProperty(l, 'line-color', '#FFD580'); } catch (_) {}
      });
      if (map.getLayer('building')) {
        try {
          map.setPaintProperty('building', 'fill-color', '#E8E4DC');
          map.setPaintProperty('building', 'fill-opacity', 0.7);
        } catch (_) {}
      }

      // ── Toronto landmark markers ────────────────────────────────────────
      TORONTO_LANDMARKS.forEach(lm => {
        const el = document.createElement('div');
        el.className = 'landmark-marker';
        el.innerHTML = `<span class="lm-emoji">${lm.emoji}</span><span class="lm-name">${lm.name}</span>`;
        new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(lm.coords)
          .addTo(map);
      });

      // ── District features setup ─────────────────────────────────────────
      geoDataRef.current.features.forEach((f, idx) => {
        f.id = idx + 1;
        f.properties.districtColor = DISTRICT_COLORS[f.properties.district_id] ?? 'hsl(24, 10%, 90%)';
        f.properties.flashColor = f.properties.districtColor;
        f.properties.emotionColor = f.properties.districtColor;
        featureColorsRef.current.set(f.id, f.properties.districtColor);
      });

      map.addSource('toronto-districts', {
        type: 'geojson',
        data: geoDataRef.current,
      });

      map.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'toronto-districts',
        paint: {
          'fill-color': ['coalesce', ['feature-state', 'flashColor'], ['get', 'districtColor'], 'hsl(24, 10%, 90%)'],
          'fill-opacity': 0.40,
          'fill-color-transition': { duration: 2200, delay: 0 },
        },
      }, 'road-label');

      map.addLayer({
        id: 'district-borders',
        type: 'line',
        source: 'toronto-districts',
        paint: {
          'line-color': 'rgba(0, 0, 0, 0.10)',
          'line-width': 1.2,
        },
      }, 'road-label');

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

      map.addLayer({
        id: 'district-labels',
        type: 'symbol',
        source: 'toronto-districts',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': 'rgba(10, 15, 26, 0.75)',
          'text-halo-color': 'rgba(242, 240, 235, 0.95)',
          'text-halo-width': 1.5,
        },
      });

      map.addSource('user-agent-dot', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
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

      geoDataRef.current.features.forEach(f => {
        map.setFeatureState({ source: 'toronto-districts', id: f.id }, { flashColor: f.properties.districtColor });
      });

      // ── Named agent system (36 agents, 3 per district) ──────────────────
      const features = geoDataRef.current.features;
      const N = 36;
      const aLat          = new Float32Array(N);
      const aLon          = new Float32Array(N);
      const tLat          = new Float32Array(N);
      const tLon          = new Float32Array(N);
      const aSpeed        = new Float32Array(N);
      const aState        = new Uint8Array(N);   // 0=MILLING 1=CELEBRATING 2=FLEEING 3=TENSED 4=FROZEN
      const aDist         = new Uint8Array(N);   // feature index
      const frozenFor     = new Int16Array(N);
      const px            = new Float32Array(N);
      const py            = new Float32Array(N);
      const agentWpIdx    = new Uint8Array(N);
      const transFrames   = new Int16Array(N);   // soft-transition countdown
      const bboxes        = [];
      const agentMeta     = [];  // [{name, emoji, align, districtId, districtName}]

      const MILLING = 0, CELEBRATING = 1, FLEEING = 2, TENSED = 3, FROZEN = 4;

      // Pre-render all agent emojis
      const allEmojis = new Set();
      Object.values(AGENTS_BY_DISTRICT).forEach(agents => agents.forEach(a => allEmojis.add(a.emoji)));
      allEmojis.forEach(preRenderEmoji);

      let agentIdx = 0;
      features.forEach((feature, dIdx) => {
        const coords = feature.geometry.coordinates[0];
        let mnLo = Infinity, mxLo = -Infinity, mnLa = Infinity, mxLa = -Infinity;
        let sLo = 0, sLa = 0;
        coords.forEach(([lo, la]) => {
          if (lo < mnLo) mnLo = lo; if (lo > mxLo) mxLo = lo;
          if (la < mnLa) mnLa = la; if (la > mxLa) mxLa = la;
          sLo += lo; sLa += la;
        });
        bboxes.push({ minLon: mnLo, maxLon: mxLo, minLat: mnLa, maxLat: mxLa });

        const districtId = feature.properties.district_id;
        const districtName = feature.properties.name ?? districtId;
        const districtAgents = AGENTS_BY_DISTRICT[districtId] ?? [];
        const waypoints = DISTRICT_WAYPOINTS[districtId] ?? [
          [(mnLo + mxLo) / 2, (mnLa + mxLa) / 2],
        ];

        districtAgents.slice(0, 3).forEach((agent, j) => {
          const i = agentIdx++;
          // Start at a random waypoint
          const startWp = Math.floor(Math.random() * waypoints.length);
          agentWpIdx[i] = startWp;
          const [lon, lat] = waypoints[startWp];
          aLon[i] = lon + (Math.random() - 0.5) * 0.003;
          aLat[i] = lat + (Math.random() - 0.5) * 0.003;
          tLon[i] = aLon[i];
          tLat[i] = aLat[i];
          aSpeed[i] = 0.04 + Math.random() * 0.03;
          aState[i] = MILLING;
          aDist[i] = dIdx;
          frozenFor[i] = 0;
          transFrames[i] = 0;
          agentMeta.push({ name: agent.name, emoji: agent.emoji, align: agent.align, districtId, districtName });
        });
      });

      agentMetaRef.current = agentMeta;
      agentPxRef.current = px;
      agentPyRef.current = py;
      agentNRef.current = N;

      function clampToDistrictBbox(lon, lat, dIdx) {
        const b = bboxes[dIdx];
        if (!b) return [lon, lat];
        return [
          Math.max(b.minLon, Math.min(b.maxLon, lon)),
          Math.max(b.minLat, Math.min(b.maxLat, lat)),
        ];
      }

      function pickNextWaypoint(i) {
        const districtId = features[aDist[i]]?.properties?.district_id;
        const waypoints = DISTRICT_WAYPOINTS[districtId];
        if (!waypoints?.length) return;
        agentWpIdx[i] = (agentWpIdx[i] + 1) % waypoints.length;
        const [lon, lat] = waypoints[agentWpIdx[i]];
        [tLon[i], tLat[i]] = clampToDistrictBbox(lon, lat, aDist[i]);
      }

      function updateAgentPositions() {
        for (let i = 0; i < N; i++) {
          const s = aState[i];

          if (s === FROZEN) {
            if (--frozenFor[i] <= 0) aState[i] = MILLING;
            continue;
          }

          let spd = aSpeed[i];
          if (transFrames[i] > 0) {
            // Soft ramp-up after state change
            const ramp = 1 - (transFrames[i] / 60);
            spd = spd * ramp;
            transFrames[i]--;
          }
          if (s === CELEBRATING) spd *= 2.5;
          else if (s === FLEEING) spd *= 2.0;
          else if (s === TENSED)  spd *= 0.3;

          if (s === CELEBRATING) {
            // Drift toward BMO Field but clamp to district bbox
            const driftLon = BMO_FIELD[0] * 0.1 + aLon[i] * 0.9 + (Math.random() - 0.5) * 0.004;
            const driftLat = BMO_FIELD[1] * 0.1 + aLat[i] * 0.9 + (Math.random() - 0.5) * 0.004;
            [tLon[i], tLat[i]] = clampToDistrictBbox(driftLon, driftLat, aDist[i]);
          } else if (s === FLEEING) {
            const b = bboxes[aDist[i]];
            if (b) {
              const cx = (b.minLon + b.maxLon) / 2;
              const cy = (b.minLat + b.maxLat) / 2;
              const dx = aLon[i] - cx, dy = aLat[i] - cy;
              const len = Math.hypot(dx, dy) || 0.0001;
              const rawLon = aLon[i] + (dx / len) * 0.008;
              const rawLat = aLat[i] + (dy / len) * 0.008;
              [tLon[i], tLat[i]] = clampToDistrictBbox(rawLon, rawLat, aDist[i]);
            }
          } else if (s === TENSED) {
            const rawLon = aLon[i] + (Math.random() - 0.5) * 0.001;
            const rawLat = aLat[i] + (Math.random() - 0.5) * 0.001;
            [tLon[i], tLat[i]] = clampToDistrictBbox(rawLon, rawLat, aDist[i]);
          } else {
            // MILLING — advance waypoints when close enough
            const dx = tLon[i] - aLon[i];
            const dy = tLat[i] - aLat[i];
            if (Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) {
              pickNextWaypoint(i);
            }
          }

          aLon[i] += (tLon[i] - aLon[i]) * spd;
          aLat[i] += (tLat[i] - aLat[i]) * spd;
        }
      }

      function onEventReceived(event) {
        if (!event) return;
        const t = event.type;
        const setStateWithTransition = (newState) => {
          for (let i = 0; i < N; i++) {
            aState[i] = newState;
            transFrames[i] = 60;
            // Pick a new target clamped to bbox
            pickNextWaypoint(i);
          }
        };

        if (t === 'power_outage') {
          for (let i = 0; i < N; i++) { aState[i] = FROZEN; frozenFor[i] = 90; transFrames[i] = 0; }
        } else if (t === 'transit_strike' || t === 'major_layoffs' || t === 'elimination') {
          setStateWithTransition(FLEEING);
          setTimeout(() => {
            for (let i = 0; i < N; i++) if (aState[i] === FLEEING) { aState[i] = MILLING; pickNextWaypoint(i); }
          }, 5000);
        } else if (t === 'heat_wave' || t === 'red_card' || t === 'penalty_miss') {
          setStateWithTransition(TENSED);
          setTimeout(() => {
            for (let i = 0; i < N; i++) if (aState[i] === TENSED) { aState[i] = MILLING; pickNextWaypoint(i); }
          }, 6000);
        } else if (t === 'festival' || t === 'street_fair' || t === 'cultural_event' || t === 'goal' || t === 'championship_win' || t === 'street_party') {
          setStateWithTransition(CELEBRATING);
          setTimeout(() => {
            for (let i = 0; i < N; i++) if (aState[i] === CELEBRATING) { aState[i] = MILLING; pickNextWaypoint(i); }
          }, 7000);
        }
      }

      onEventReceivedRef.current = onEventReceived;

      // ── RAF draw loop ──────────────────────────────────────────────────
      const agentCanvas = canvasRef.current;
      const ctx = agentCanvas ? agentCanvas.getContext('2d', { alpha: true, desynchronized: true }) : null;
      let lastPositionUpdate = 0;
      let projectionDirty = true;
      let renderDirty = true;
      let rafId;
      const _proj = [0, 0];

      function drawFrame(timestamp) {
        if (timestamp - lastPositionUpdate > 66) {
          updateAgentPositions();
          projectionDirty = true;
          lastPositionUpdate = timestamp;
        }
        if (projectionDirty) {
          for (let i = 0; i < N; i++) {
            _proj[0] = aLon[i]; _proj[1] = aLat[i];
            const pt = map.project(_proj);
            px[i] = pt.x; py[i] = pt.y;
          }
          projectionDirty = false;
          renderDirty = true;
        }
        if (renderDirty && agentCanvas && ctx) {
          ctx.clearRect(0, 0, agentCanvas.width, agentCanvas.height);
          for (let i = 0; i < N; i++) {
            const meta = agentMeta[i];
            if (!meta) continue;
            const isSelected = (i === selectedAgentIdxRef.current);
            const alignColor = alignToColor(meta.align);

            ctx.globalAlpha = 0.92;
            // Background circle
            ctx.beginPath();
            ctx.arc(px[i], py[i], DOT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = alignColor;
            ctx.fill();

            // White ring
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Emoji (pre-rendered)
            const cached = EMOJI_CACHE[meta.emoji];
            if (cached) {
              ctx.globalAlpha = 1.0;
              ctx.drawImage(cached, px[i] - 10, py[i] - 10, 20, 20);
            }

            // Selected ring
            if (isSelected) {
              ctx.globalAlpha = 1.0;
              ctx.beginPath();
              ctx.arc(px[i], py[i], DOT_RADIUS + 3, 0, Math.PI * 2);
              ctx.strokeStyle = '#1a56db';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1.0;
          renderDirty = false;
        }

        rafId = requestAnimationFrame(drawFrame);
      }

      rafId = requestAnimationFrame(drawFrame);
      map.on('move', () => {
        projectionDirty = true;
        renderDirty = true;
        const userSource = map.getSource('user-agent-dot');
        if (userSource && userAgentRef.current) {
          const center = map.getCenter();
          userSource.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
              properties: { name: userAgentRef.current.name, job: userAgentRef.current.job },
            }],
          });
        }
      });
      map.on('remove', () => cancelAnimationFrame(rafId));

      // ── Hover tooltip ──────────────────────────────────────────────────
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

      // ── Unified click: agents first, then district ─────────────────────
      map.on('click', (e) => {
        const cx = e.point.x;
        const cy = e.point.y;

        // Check if any agent was clicked
        const _px = agentPxRef.current;
        const _py = agentPyRef.current;
        const _n  = agentNRef.current;

        if (_px && _py) {
          for (let i = 0; i < _n; i++) {
            const dx = _px[i] - cx;
            const dy = _py[i] - cy;
            if (dx * dx + dy * dy <= DOT_RADIUS * DOT_RADIUS) {
              selectedAgentIdxRef.current = i;
              setSelectedAgentIdx(i);
              setAgentCardPos({ x: e.point.x, y: e.point.y });
              const container = map.getContainer();
              setAgentCardContainerSize({ w: container.offsetWidth, h: container.offsetHeight });
              skipDistrictClickRef.current = true;
              return;
            }
          }
        }

        // No agent hit — dismiss agent card
        selectedAgentIdxRef.current = null;
        setSelectedAgentIdx(null);
        setAgentCardPos(null);
        skipDistrictClickRef.current = false;

        // Check district
        const features = map.queryRenderedFeatures(e.point, { layers: ['district-fill'] });
        if (features.length && onDistrictClick) {
          const { district_id, name } = features[0].properties;
          onDistrictClick({
            id: district_id, name,
            x: e.point.x, y: e.point.y,
            containerWidth: map.getContainer().offsetWidth,
            containerHeight: map.getContainer().offsetHeight,
          });
        } else if (!features.length && onDistrictClick) {
          onDistrictClick(null);
        }
      });
    });
  }, []);

  // Flat map flyover on simulation start
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !simulationStarted) return;
    map.flyTo({
      center: [-79.38, 43.68],
      zoom: 11.5,
      pitch: 0,
      bearing: 0,
      duration: 1500,
      curve: 1.2,
      essential: true,
    });
  }, [simulationStarted]);

  // Camera flyTo on high-severity events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lastEvent || lastEvent.severity < 0.8) return;
    if (!lastEvent.source_district) return;
    const f = geoDataRef.current.features.find(x => x.properties.district_id === lastEvent.source_district);
    if (!f) return;
    const [lon, lat] = featureCentroid(f);
    map.flyTo({ center: [lon, lat], zoom: 12.5, pitch: 0, bearing: 0, duration: 1600, essential: true });
    const returnTimer = setTimeout(() => {
      map.flyTo({ center: [-79.38, 43.68], zoom: 11.5, pitch: 0, bearing: 0, duration: 2000 });
    }, 5000);
    return () => clearTimeout(returnTimer);
  }, [lastEvent]);

  // Wave animation on new events
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

    const featureById = {};
    geoDataRef.current.features.forEach(f => { featureById[f.properties.district_id] = f; });

    if (isNewEvent) {
      lastProcessedEventRef.current = lastEvent;
      activePulseRef.current = {
        key: `${lastEvent.type}-${lastEvent.minute}-${lastEvent.team ?? 'none'}`,
        severity: lastEvent.severity ?? 0.8,
        expiresAt: Date.now() + 9000,
        maxRank: Math.max(4, lastEvent.severity >= 0.8 ? 8 : 6),
      };
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

  // Canvas resize
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

  // Wire lastEvent → agent state machine
  useEffect(() => {
    if (!lastEvent) return;
    onEventReceivedRef.current?.(lastEvent);

    // Record agent memory: note event for all agents
    const minute = lastEvent.minute ?? 0;
    const eventLabel = lastEvent.type?.replace(/_/g, ' ') ?? '';
    const mood = ['goal', 'championship_win', 'street_party', 'festival'].includes(lastEvent.type)
      ? 'excited'
      : ['red_card', 'elimination', 'penalty_miss', 'heat_wave', 'power_outage'].includes(lastEvent.type)
        ? 'tense'
        : 'neutral';

    for (let i = 0; i < agentNRef.current; i++) {
      if (!agentMemoryRef.current[i]) agentMemoryRef.current[i] = [];
      agentMemoryRef.current[i].unshift({ minute, event: eventLabel, mood });
      if (agentMemoryRef.current[i].length > 3) agentMemoryRef.current[i].pop();
    }
  }, [lastEvent]);

  // Emoji burst on high-severity events
  useEffect(() => {
    if (!lastEvent || (lastEvent.severity ?? 0) < 0.7) return;
    const key = `${lastEvent.type}-${lastEvent.team}-${lastEvent.minute}`;
    if (lastEmojiEventRef.current === key) return;
    lastEmojiEventRef.current = key;
    const emojis = EVENT_EMOJIS[lastEvent.type] ?? ['✨', '🔥'];
    spawnEmojiBurst(lastEvent.source_district || 'downtown', emojis);
  }, [lastEvent]);

  // Visual-only replay
  useEffect(() => {
    if (!replayEvent) return;
    return triggerReplayWave(replayEvent);
  }, [replayEvent]);

  // Update userAgentRef and user-agent-dot source on change
  useEffect(() => {
    userAgentRef.current = userAgent;
    const map = mapRef.current;
    if (map && map.isStyleLoaded() && userAgent) {
      const userSource = map.getSource('user-agent-dot');
      if (userSource) {
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
    }
  }, [userAgent]);

  // Agent card data
  const selectedMeta = selectedAgentIdx !== null ? agentMetaRef.current[selectedAgentIdx] : null;
  const agentFeedText = selectedMeta
    ? (feedEntriesRef.current.find(f => f.district === selectedMeta.districtId)?.text ?? null)
    : null;
  const agentMemory = selectedAgentIdx !== null ? agentMemoryRef.current[selectedAgentIdx] : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div id="map" ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Landmark CSS is injected globally via index.css */}

      {/* Emoji bursts */}
      <div className="emoji-burst-container">
        {emojiBursts.map(p => (
          <span key={p.id} className="emoji-burst-particle" style={{ left: p.x, top: p.y }}>
            {p.emoji}
          </span>
        ))}
      </div>

      {/* District hover tooltip */}
      {tooltip && (
        <div className="district-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.name}</strong> · {tooltip.emotion} {tooltip.intensity}
        </div>
      )}

      {/* Agent card */}
      {selectedMeta && agentCardPos && (
        <AgentCard
          agent={selectedMeta}
          districtName={selectedMeta.districtName}
          pos={agentCardPos}
          memory={agentMemory}
          feedText={agentFeedText}
          containerWidth={agentCardContainerSize.w}
          containerHeight={agentCardContainerSize.h}
          onClose={() => {
            selectedAgentIdxRef.current = null;
            setSelectedAgentIdx(null);
            setAgentCardPos(null);
          }}
        />
      )}
    </div>
  );
}
