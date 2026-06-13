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
  const { districts, feedEntries, connected, injectEvent } = useSimulation();

  return (
    <div className="app">
      <div className="main-layout">
        <div className="map-container">
          <MapView districts={districts} />
        </div>
        <div className="sidebar">
          <h2>
            <span className={`status-dot ${connected ? 'connected' : ''}`} />
            Live Feed
          </h2>
          {feedEntries.map((entry, i) => (
            <div key={i} className="feed-entry">
              <div className="feed-district">{entry.district}</div>
              <div>{entry.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bottom-bar">
        {EVENTS.map(ev => (
          <button
            key={ev.label}
            className="event-btn"
            onClick={() => injectEvent(ev.type, ev.team)}
          >
            {ev.label}
          </button>
        ))}
      </div>
    </div>
  );
}
