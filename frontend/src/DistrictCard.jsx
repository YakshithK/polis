import { useEffect, useState } from 'react';
import MoodBar from './MoodBar';
import { DISTRICT_COLORS, CHARACTERS } from './FeedEntry';
import { AGENTS_BY_DISTRICT, DISTRICT_GEO } from './agents';

const EVENT_ICONS = {
  transit_strike: '🚇', heat_wave: '🌡️', festival: '🎪', power_outage: '⚡',
  major_layoffs: '📉', cultural_event: '🎭', protest: '✊', street_fair: '🎠',
  goal: '⚽', red_card: '🟥', var_review: '📺', penalty_miss: '😬',
  championship_win: '🏆', elimination: '💔', street_party: '🎉',
  community_gathering: '👥', local_incident: '🚨', city_buzz: '🏙️',
};

function fmtPop(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

export default function DistrictCard({ info, districts, feedEntries, eventLog, onClose, matchMinute }) {
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!info) return;
    const cardW = 290;
    const cardH = 460;
    const margin = 12;
    let left = info.x + margin;
    let top  = info.y - cardH / 2;
    if (left + cardW > info.containerWidth - margin)  left  = info.x - cardW - margin;
    if (top  < margin)                                 top   = margin;
    if (top  + cardH > info.containerHeight - margin)  top   = info.containerHeight - cardH - margin;
    setPos({ left, top });
  }, [info]);

  if (!info) return null;

  const state      = districts[info.id] ?? {};
  const emotion    = state.emotion ?? {};
  const activeEffects = state.active_effects ?? [];
  const geo        = DISTRICT_GEO[info.id] ?? {};
  const alignment  = geo.canada_support ?? 60;
  const agents     = AGENTS_BY_DISTRICT[info.id] ?? [];

  // Last 2 feed entries for this district
  const recentFeed = feedEntries.filter(f => f.district === info.id).slice(0, 2);
  // Last 3 events
  const recentEvents = [...eventLog].reverse().slice(0, 3);

  // Active effects with remaining time
  const liveEffects = activeEffects.filter(eff => {
    const elapsed = (matchMinute ?? 0) - (eff.start_minute ?? 0);
    return elapsed < (eff.duration_minutes ?? 120);
  }).slice(0, 3);

  return (
    <div
      className="district-card"
      style={{ left: pos.left, top: pos.top, borderColor: DISTRICT_COLORS[info.id] ?? 'rgba(255,255,255,0.15)', width: 290 }}
    >
      <div className="card-header">
        <span className="card-title" style={{ color: DISTRICT_COLORS[info.id] ?? 'inherit' }}>
          {info.name.toUpperCase()}
        </span>
        <button className="card-close" onClick={onClose}>×</button>
      </div>

      <div className="card-body">
        {/* Geo stats */}
        {geo.population && (
          <div>
            <div className="card-section-label">Geo Stats</div>
            <div className="card-geo-grid">
              <div className="card-geo-item"><span className="card-geo-key">Population</span><span className="card-geo-val">{fmtPop(geo.population)}</span></div>
              <div className="card-geo-item"><span className="card-geo-key">Density</span><span className="card-geo-val">{(geo.density_per_km2 ?? 0).toLocaleString()} /km²</span></div>
              <div className="card-geo-item"><span className="card-geo-key">Area</span><span className="card-geo-val">{geo.area_km2} km²</span></div>
              <div className="card-geo-item">
                <span className="card-geo-key">🇨🇦 Support</span>
                <span className="card-geo-val" style={{ color: '#cc0000' }}>{alignment}%</span>
              </div>
            </div>
            <div className="card-support-bar-track">
              <div className="card-support-bar-fill" style={{ width: `${alignment}%` }} />
            </div>
          </div>
        )}

        {/* Current Mood */}
        <div>
          <div className="card-section-label">Current Mood</div>
          <MoodBar emotion="excitement"  value={emotion.excitement} />
          <MoodBar emotion="tension"     value={emotion.tension} />
          <MoodBar emotion="pride"       value={emotion.pride} />
          <MoodBar emotion="frustration" value={emotion.frustration} />
        </div>

        {/* Active Effects */}
        {liveEffects.length > 0 && (
          <div>
            <div className="card-section-label">Active Effects</div>
            {liveEffects.map((eff, i) => {
              const elapsed = (matchMinute ?? 0) - (eff.start_minute ?? 0);
              const remaining = Math.max(0, (eff.duration_minutes ?? 120) - elapsed);
              const pct = (eff.duration_minutes ?? 120) > 0
                ? remaining / (eff.duration_minutes ?? 120)
                : 0;
              return (
                <div key={i} className="card-effect-row">
                  <span>{EVENT_ICONS[eff.event_type] ?? '•'}</span>
                  <span className="card-effect-label">
                    {(eff.event_type ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className="card-effect-time">{remaining}'</span>
                  <div className="card-effect-track">
                    <div className="card-effect-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Residents (named agents) */}
        {agents.length > 0 && (
          <div>
            <div className="card-section-label">Residents</div>
            <div className="card-agents-row">
              {agents.map(a => (
                <div key={a.id} className="card-agent-chip" title={a.voice}>
                  <span className="card-agent-emoji">{a.emoji}</span>
                  <span className="card-agent-name">{a.name}</span>
                </div>
              ))}
            </div>
            {recentFeed.length > 0 && (
              <div className="card-resident-quote">
                "{recentFeed[0].text}"
              </div>
            )}
          </div>
        )}

        {/* Recent events */}
        {recentEvents.length > 0 && (
          <div>
            <div className="card-section-label">Recent Events</div>
            {recentEvents.map((ev, i) => (
              <div key={i} className="card-event-row">
                <span>{EVENT_ICONS[ev.type] ?? '🏙️'}</span>
                <span className="card-event-min">{ev.minute}'</span>
                <span>{ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
