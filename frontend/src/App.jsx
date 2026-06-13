import { useState } from 'react';
import MapView from './MapView';
import { useSimulation } from './useSimulation';

const EVENTS = [
  { label: '⚽ Canada Goal', type: 'goal', team: 'canada' },
  { label: '⚽ Opponent Goal', type: 'goal', team: 'opponent' },
  { label: '🟥 Red Card', type: 'red_card', team: 'canada' },
  { label: '📺 VAR Review', type: 'var_review', team: 'canada' },
  { label: '💀 Canada Out', type: 'elimination', team: 'canada' },
  { label: '🏆 Canada Wins', type: 'championship_win', team: 'canada' },
];

export default function App() {
  const { districts, feedEntries, connected, injectEvent, lastEvent } = useSimulation();
  const [activeBtn, setActiveBtn] = useState(null);

  const stepMs = lastEvent
    ? lastEvent.severity >= 0.8 ? 80 : lastEvent.severity <= 0.4 ? 180 : 120
    : 120;

  const handleEvent = (ev) => {
    injectEvent(ev.type, ev.team);
    setActiveBtn(ev.label);
    setTimeout(() => setActiveBtn(null), 300);
  };

  return (
    <div className="app">
      <div className="main-layout">
        <div className="map-container">
          <MapView districts={districts} stepMs={stepMs} />
        </div>
        <div className="sidebar">
          <h2>
            <span className={`status-dot ${connected ? 'connected' : ''}`} />
            Live Feed
          </h2>
          {feedEntries.map((entry, i) => (
            <div key={i} className="feed-entry">
              <div className="feed-header">
                <span className={`feed-district ${entry.district}`}>
                  {entry.district.replace(/_/g, ' ')}
                </span>
                {entry.ts && (
                  <span className="feed-ts">
                    {new Date(entry.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
              <div>{entry.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bottom-bar">
        {EVENTS.map(ev => (
          <button
            key={ev.label}
            className={`event-btn ${activeBtn === ev.label ? 'active' : ''}`}
            onClick={() => handleEvent(ev)}
          >
            {ev.label}
          </button>
        ))}
      </div>
    </div>
  );
}
