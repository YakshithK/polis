import { useEffect, useRef } from 'react';

const EVENT_ICONS = {
  goal:             '⚽',
  red_card:         '🟥',
  var_review:       '📺',
  penalty_miss:     '😬',
  elimination:      '💀',
  championship_win: '🏆',
};

const TEAM_LABEL = { canada: 'CAN', opponent: 'OPP' };

function eventDesc(ev) {
  const icon  = EVENT_ICONS[ev.type]  ?? '•';
  const team  = TEAM_LABEL[ev.team]   ?? ev.team;
  const label = ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `${icon} ${ev.minute}' ${team} ${label}`;
}

export default function EventLogBar({ eventLog, onEventClick }) {
  const scrollRef = useRef(null);

  // Auto-scroll to newest (rightmost)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [eventLog]);

  return (
    <div className="event-log-bar glass panel-reveal" style={{ animationDelay: '0.3s' }}>
      <span className="event-log-label">Event Log</span>
      <div className="event-log-scroll" ref={scrollRef}>
        {eventLog.length === 0 ? (
          <span className="event-log-empty">No events yet · inject an event below to begin</span>
        ) : (
          eventLog.map((ev, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <span className="event-log-sep">·</span>}
              <span 
                className="event-log-item"
                onClick={() => onEventClick && onEventClick(ev)}
                style={{ cursor: 'pointer' }}
                title="Click to replay visual wave"
              >
                {EVENT_ICONS[ev.type] ?? '•'}&nbsp;
                <span className="event-log-min">{ev.minute}'</span>&nbsp;
                {TEAM_LABEL[ev.team] ?? ev.team}&nbsp;
                {ev.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
