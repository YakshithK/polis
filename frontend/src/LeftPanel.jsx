import { useState, useRef, useEffect } from 'react';
import MoodBar from './MoodBar';
import FeedEntry from './FeedEntry';

const EVENT_ICONS = {
  goal:             '⚽',
  red_card:         '🟥',
  var_review:       '📺',
  penalty_miss:     '😬',
  elimination:      '💀',
  championship_win: '🏆',
};
const TEAM_LABEL = { canada: 'CAN', opponent: 'OPP' };

const LEGEND = [
  { key: 'excitement',  color: '#ea580c' },
  { key: 'tension',     color: '#a21caf' },
  { key: 'pride',       color: '#2563eb' },
  { key: 'frustration', color: '#b91c1c' },
];

function pulseColor(v) {
  if (v >= 70) return '#ea580c';
  if (v >= 50) return '#d97706';
  return '#3d7bff';
}

function PulseTab({ districts }) {
  const list = Object.values(districts);
  const avg  = (fn) => list.length ? list.reduce((s, d) => s + (fn(d) ?? 0), 0) / list.length : 0;

  const cityPulse  = Math.round(avg(d => d.emotion?.excitement));
  const avgExc     = avg(d => d.emotion?.excitement);
  const avgTen     = avg(d => d.emotion?.tension);
  const avgPri     = avg(d => d.emotion?.pride);
  const avgFru     = avg(d => d.emotion?.frustration);
  const avgSupport = Math.round(avg(d => d.alignment?.canada_support) || 64);

  const hottest = [...list]
    .sort((a, b) => (b.emotion?.excitement ?? 0) - (a.emotion?.excitement ?? 0))
    .slice(0, 3);

  return (
    <div className="lp-scroll">
      <div className="stats-section">
        <div className="stats-label">City Pulse</div>
        <div className="city-pulse-number" style={{ color: pulseColor(cityPulse) }}>{cityPulse}</div>
        <div className="city-pulse-sub">avg excitement</div>
      </div>

      <div className="stats-section">
        <div className="stats-label">Mood Breakdown</div>
        <MoodBar emotion="excitement"  value={avgExc} />
        <MoodBar emotion="tension"     value={avgTen} />
        <MoodBar emotion="pride"       value={avgPri} />
        <MoodBar emotion="frustration" value={avgFru} />
      </div>

      <div className="stats-section">
        <div className="stats-label">Hottest Now</div>
        {hottest.map(d => (
          <div key={d.district_id} className="hottest-row">
            <span>🔥</span>
            <span className="hottest-name">
              {d.district_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span className="hottest-val">{Math.round(d.emotion?.excitement ?? 0)}</span>
          </div>
        ))}
        {!hottest.length && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Loading…</div>}
      </div>

      <div className="stats-section">
        <div className="stats-label">🇨🇦 Canada Support</div>
        <div className="support-pct">avg {avgSupport}% across city</div>
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
    </div>
  );
}

function FeedTab({ feedEntries, connected }) {
  return (
    <div className="lp-scroll">
      <div className="lp-feed-status">
        <div className={`feed-status-dot${connected ? ' live' : ''}`} />
        <span>{connected ? 'Live' : 'Connecting…'}</span>
      </div>
      {feedEntries.length === 0 ? (
        <div className="feed-empty-state">The city is quiet.<br />Tap an event to wake it up.</div>
      ) : (
        feedEntries.map((entry, i) => (
          <FeedEntry key={`${entry.district}-${entry.ts}-${i}`} entry={entry} />
        ))
      )}
    </div>
  );
}

function EventsTab({ eventLog, onEventClick }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  return (
    <div className="lp-scroll">
      {eventLog.length === 0 ? (
        <div className="feed-empty-state">No events yet.<br />Inject an event below to begin.</div>
      ) : (
        eventLog.map((ev, i) => (
          <div
            key={i}
            className="lp-event-row"
            onClick={() => onEventClick?.(ev)}
            title="Click to replay visual wave"
          >
            <span className="lp-event-icon">{EVENT_ICONS[ev.type] ?? '•'}</span>
            <span className="lp-event-min">{ev.minute}'</span>
            <span className="lp-event-team">{TEAM_LABEL[ev.team] ?? ev.team}</span>
            <span className="lp-event-label">
              {ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

const TABS = [
  { id: 'pulse',  label: 'City Pulse' },
  { id: 'feed',   label: 'Live Feed'  },
  { id: 'events', label: 'Events'     },
];

export default function LeftPanel({ districts, feedEntries, connected, eventLog, onEventClick }) {
  const [activeTab, setActiveTab] = useState('pulse');

  return (
    <div className="left-panel glass panel-reveal" style={{ animationDelay: '0.15s' }}>
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
        {activeTab === 'pulse'  && <PulseTab  districts={districts} />}
        {activeTab === 'feed'   && <FeedTab   feedEntries={feedEntries} connected={connected} />}
        {activeTab === 'events' && <EventsTab eventLog={eventLog} onEventClick={onEventClick} />}
      </div>
    </div>
  );
}
