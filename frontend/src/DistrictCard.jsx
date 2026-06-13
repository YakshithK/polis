import { useEffect, useState } from 'react';
import MoodBar from './MoodBar';
import { DISTRICT_COLORS, CHARACTERS } from './FeedEntry';

export default function DistrictCard({ info, districts, feedEntries, eventLog, onClose }) {
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!info) return;
    const cardW = 280;
    const cardH = 380;
    const margin = 12;
    let left = info.x + margin;
    let top  = info.y - cardH / 2;
    if (left + cardW > info.containerWidth - margin)  left  = info.x - cardW - margin;
    if (top  < margin)                                  top   = margin;
    if (top  + cardH > info.containerHeight - margin)  top   = info.containerHeight - cardH - margin;
    setPos({ left, top });
  }, [info]);

  if (!info) return null;

  const state   = districts[info.id] ?? {};
  const emotion = state.emotion ?? {};
  const support = Math.round(state.alignment?.canada_support ?? 60);
  const character = CHARACTERS[info.id] ?? info.name;

  // Last 2 feed entries for this district
  const recentFeed = feedEntries.filter(f => f.district === info.id).slice(0, 2);
  // Last 3 events
  const recentEvents = [...eventLog].reverse().slice(0, 3);

  return (
    <div
      className="district-card"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="card-header">
        <span className="card-title">{info.name}</span>
        <button className="card-close" onClick={onClose}>×</button>
      </div>
      <div className="card-body">
        {/* Canada support */}
        <div>
          <div className="card-section-label">🇨🇦 Canada Support</div>
          <div className="card-support-row">
            <span className="card-support-label">Support</span>
            <div className="card-support-bar">
              <div className="card-support-fill" style={{ width: `${support}%` }} />
            </div>
            <span className="card-support-pct">{support}%</span>
          </div>
        </div>

        {/* Mood */}
        <div>
          <div className="card-section-label">Current Mood</div>
          <MoodBar emotion="excitement"  value={emotion.excitement} />
          <MoodBar emotion="tension"     value={emotion.tension} />
          <MoodBar emotion="pride"       value={emotion.pride} />
          <MoodBar emotion="frustration" value={emotion.frustration} />
        </div>

        {/* Residents */}
        {recentFeed.length > 0 && (
          <div>
            <div className="card-section-label">Residents</div>
            {recentFeed.map((f, i) => (
              <div key={i} className="card-resident">
                <span className="card-resident-name">{character}</span>
                <span className="card-resident-text">"{f.text}"</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent events */}
        {recentEvents.length > 0 && (
          <div>
            <div className="card-section-label">Recent Events</div>
            {recentEvents.map((ev, i) => (
              <div key={i} className="card-event-row">
                <span>{ev.type === 'goal' ? '⚽' : ev.type === 'red_card' ? '🟥' : '📺'}</span>
                <span className="card-event-min">{ev.minute}'</span>
                <span>{ev.team === 'canada' ? 'CAN' : 'OPP'} {ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
