import { useState, useRef, useEffect } from 'react';
import MoodBar from './MoodBar';
import { DISTRICT_GEO, EFFECT_DURATIONS } from './agents';

const EVENT_ICONS = {
  transit_strike:        '🚇',
  heat_wave:             '🌡️',
  festival:              '🎪',
  power_outage:          '⚡',
  major_layoffs:         '📉',
  cultural_event:        '🎭',
  protest:               '✊',
  street_fair:           '🎠',
  local_incident:        '🚨',
  community_gathering:   '👥',
  street_party:          '🎉',
  city_buzz:             '🏙️',
  neighbourhood_chatter: '💬',
  street_party_forming:  '🎊',
  goal:                  '⚽',
  red_card:              '🟥',
  var_review:            '📺',
  penalty_miss:          '😬',
  championship_win:      '🏆',
  elimination:           '💔',
};

const SOURCE_BADGE = {
  manual:    { label: 'YOU',  color: '#2563eb' },
  natural:   { label: 'NL',   color: '#7c3aed' },
  autopilot: { label: 'AUTO', color: '#64748b' },
  organic:   { label: 'CITY', color: '#16a34a' },
};

const LEGEND = [
  { key: 'Happiness',   color: '#ea580c' },
  { key: 'Stress',      color: '#a21caf' },
  { key: 'Pride',       color: '#2563eb' },
  { key: 'Frustration', color: '#b91c1c' },
];

function pulseColor(v) {
  if (v >= 70) return '#f97316';
  if (v >= 50) return '#d97706';
  return '#1a56db';
}

function peakEmotion(district) {
  const e = district.emotion ?? {};
  return Math.max(e.excitement ?? 0, e.tension ?? 0, e.pride ?? 0, e.frustration ?? 0);
}

function excessEmotion(district) {
  return Math.max(0, peakEmotion(district) - 50);
}

function PulseTab({ districts, activityByDistrict }) {
  const list = Object.values(districts);
  const avg  = (fn) => list.length ? list.reduce((s, d) => s + (fn(d) ?? 0), 0) / list.length : 0;

  const avgExc = avg(d => d.emotion?.excitement);
  const avgTen = avg(d => d.emotion?.tension);
  const avgPri = avg(d => d.emotion?.pride);
  const avgFru = avg(d => d.emotion?.frustration);

  const avgExcitement = Math.round(avgExc);

  const ranked = [...list].sort((a, b) => peakEmotion(b) - peakEmotion(a));
  const cityPulse = Math.round(
    50 +
    avg(d => excessEmotion(d)) * 2.6 +
    (ranked[0] ? excessEmotion(ranked[0]) * 1.25 : 0) +
    (ranked[1] ? excessEmotion(ranked[1]) * 0.75 : 0) +
    (ranked[2] ? excessEmotion(ranked[2]) * 0.5 : 0)
  );

  // Affected population: districts with excitement > 65
  const affectedPop = list.reduce((sum, d) => {
    if ((d.emotion?.excitement ?? 0) > 65) {
      const geo = DISTRICT_GEO[d.district_id];
      return sum + (geo?.population ?? 0);
    }
    return sum;
  }, 0);

  const totalPop = Object.values(DISTRICT_GEO).reduce((s, g) => s + g.population, 0);
  const totalArea = Object.values(DISTRICT_GEO).reduce((s, g) => s + g.area_km2, 0);
  const activeDistrictsCount = list.filter(d => peakEmotion(d) > 55).length;

  const avgCanadaSupport = Math.round(
    list.reduce((s, d) => s + (DISTRICT_GEO[d.district_id]?.canada_support ?? 60), 0) / (list.length || 1)
  );

  const domEmotion = (d) => {
    const e = d.emotion ?? {};
    const peak = Math.max(e.excitement ?? 0, e.tension ?? 0, e.pride ?? 0, e.frustration ?? 0);
    if (peak === e.tension)     return { val: peak, label: 'Stress',      color: '#a21caf' };
    if (peak === e.frustration) return { val: peak, label: 'Frustration', color: '#b91c1c' };
    if (peak === e.pride)       return { val: peak, label: 'Pride',       color: '#2563eb' };
    return                               { val: peak, label: 'Happiness',  color: '#ea580c' };
  };
  const hottest = ranked.slice(0, 3);

  const fmtPop = (n) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M` : n >= 1000 ? `${Math.round(n/1000)}K` : String(n);

  return (
    <div className="lp-scroll">
      <div className="stats-section">
        <div className="stats-label">City Pulse</div>
        <div className="city-pulse-number" style={{ color: pulseColor(cityPulse) }}>{cityPulse}</div>
        <div className="city-pulse-sub">avg excitement {avgExcitement}</div>
      </div>

      <div className="stats-section">
        <div className="stats-label">Affected Population</div>
        <div className="city-pulse-number" style={{ fontSize: 'var(--text-xl)', color: pulseColor(cityPulse) }}>
          {fmtPop(affectedPop)}
        </div>
        <div className="city-pulse-sub">currently excited (excitement &gt; 65)</div>
      </div>

      <div className="stats-section">
        <div className="stats-label">Mood Breakdown</div>
        <MoodBar emotion="Happiness"   value={Math.min(100, avgExc + avg(d => excessEmotion(d)) * 0.9)} />
        <MoodBar emotion="Stress"      value={Math.min(100, avgTen + avg(d => excessEmotion(d)) * 1.1)} />
        <MoodBar emotion="Pride"       value={Math.min(100, avgPri + avg(d => excessEmotion(d)) * 0.8)} />
        <MoodBar emotion="Frustration" value={Math.min(100, avgFru + avg(d => excessEmotion(d)) * 1.2)} />
      </div>

      <div className="stats-section">
        <div className="stats-label">Hottest Now</div>
        {hottest.map(d => {
          const dom = domEmotion(d);
          const geo = DISTRICT_GEO[d.district_id];
          return (
            <div key={d.district_id} className="hottest-row">
              <span>🔥</span>
              <span className="hottest-name">
                {d.district_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
              <span className="hottest-val" style={{ color: dom.color }}>
                {Math.round(dom.val)} · {geo ? fmtPop(geo.population) : ''}
              </span>
            </div>
          );
        })}
        {!hottest.length && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>Loading…</div>}
      </div>

      <div className="stats-section">
        <div className="stats-label">City Stats</div>
        <div className="city-stat-row"><span>Total population</span><span className="city-stat-val">{fmtPop(totalPop)}</span></div>
        <div className="city-stat-row"><span>City area</span><span className="city-stat-val">{Math.round(totalArea)} km²</span></div>
        <div className="city-stat-row"><span>Districts active</span><span className="city-stat-val">{activeDistrictsCount} / {list.length}</span></div>
        <div className="city-stat-row"><span>🇨🇦 Support avg</span><span className="city-stat-val">{avgCanadaSupport}%</span></div>
      </div>

      <div className="stats-section">
        <div className="stats-label">Legend</div>
        {LEGEND.map(({ key, color }) => (
          <div key={key} className="legend-row">
            <div className="legend-dot" style={{ background: color }} />
            <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
          </div>
        ))}
      </div>

      <div className="stats-section">
        <div className="stats-label">Citizens</div>
        {Object.entries(activityByDistrict ?? {}).slice(0, 4).map(([district, payload]) => (
          <div key={district} style={{ marginBottom: 10 }}>
            <div className="hottest-name">{district.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{payload?.archetype}</div>
            {(payload?.citizens ?? []).slice(0, 2).map((person) => (
              <div key={person.citizen} style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
                {person.citizen}: {person.activity}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


function EventsTab({ eventLog, onEventClick, matchMinute }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  return (
    <div className="lp-scroll">
      {eventLog.length === 0 ? (
        <div className="feed-empty-state">No events yet.<br />Inject an event below to begin.</div>
      ) : (
        eventLog.map((ev, i) => {
          const duration = ev.duration_minutes ?? EFFECT_DURATIONS[ev.type] ?? 120;
          const elapsed = Math.max(0, matchMinute - (ev.minute ?? 0));
          const remaining = Math.max(0, duration - elapsed);
          const pct = duration > 0 ? (remaining / duration) : 0;

          return (
            <div
              key={i}
              className="lp-event-row"
              onClick={() => onEventClick?.(ev)}
              title="Click to replay visual wave"
            >
              <span className="lp-event-icon">{EVENT_ICONS[ev.type] ?? '•'}</span>
              <span className="lp-event-min">{ev.minute}'</span>
              <span className="lp-event-label">
                {ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
              {(() => {
                const badge = SOURCE_BADGE[ev.source] ?? SOURCE_BADGE.autopilot;
                return (
                  <span className="lp-event-source" style={{ background: badge.color }}>
                    {badge.label}
                  </span>
                );
              })()}
              {remaining > 0 && (
                <div className="lp-event-decay-wrap">
                  <div className="lp-event-decay-bar" style={{ width: `${Math.round(pct * 100)}%` }} />
                  <span className="lp-event-decay-time">{remaining}'</span>
                </div>
              )}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

const TABS = [
  { id: 'pulse',  label: 'Pulse'  },
  { id: 'events', label: 'Events' },
];

export default function LeftPanel({ districts, eventLog, onEventClick, activityByDistrict, matchMinute }) {
  const [activeTab, setActiveTab] = useState('pulse');

  return (
    <div className="left-panel glass panel-reveal">
      <div className="left-panel-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`left-panel-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="left-panel-body">
        {activeTab === 'pulse'  && <PulseTab  districts={districts} activityByDistrict={activityByDistrict} />}
        {activeTab === 'events' && <EventsTab eventLog={eventLog} onEventClick={onEventClick} matchMinute={matchMinute} />}
      </div>
    </div>
  );
}
