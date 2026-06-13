import { useState, useEffect, useRef } from 'react';
import MapView from './MapView';
import Scoreboard from './Scoreboard';
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
  const { districts, feedEntries, connected, injectEvent, lastEvent, autopilotStatus, triggerAutopilot } = useSimulation();
  const [activeBtn, setActiveBtn] = useState(null);
  const [strictness, setStrictness] = useState('conservative');
  const [score, setScore] = useState({ canada: 0, opponent: 0 });
  const [matchMinute, setMatchMinute] = useState(0);
  const clockRef = useRef(null);

  // Cinematic & Startup States
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [flyoverComplete, setFlyoverComplete] = useState(false);
  const [feedVisible, setFeedVisible] = useState(true);

  const autopilotActive = autopilotStatus === 'generating' || autopilotStatus === 'running';

  // Track score from goal events
  useEffect(() => {
    if (lastEvent?.type === 'goal') {
      setScore(prev => ({ ...prev, [lastEvent.team]: prev[lastEvent.team] + 1 }));
    }
  }, [lastEvent]);

  // Match clock: starts when connected, simulation started, and cinematic flyover complete
  useEffect(() => {
    if (!connected || !simulationStarted || !flyoverComplete) return;
    if (clockRef.current) return;
    clockRef.current = setInterval(() => setMatchMinute(m => Math.min(m + 1, 90)), 1000);
    return () => { clearInterval(clockRef.current); clockRef.current = null; };
  }, [connected, simulationStarted, flyoverComplete]);

  const districtList = Object.values(districts);
  const cityMood = districtList.length
    ? districtList.reduce((sum, d) => sum + (d.emotion?.excitement ?? 50), 0) / districtList.length
    : 50;

  const stepMs = lastEvent
    ? lastEvent.severity >= 0.8 ? 80 : lastEvent.severity <= 0.4 ? 180 : 120
    : 120;

  const handleEvent = (ev) => {
    injectEvent(ev.type, ev.team);
    setActiveBtn(ev.label);
    setTimeout(() => setActiveBtn(null), 300);
  };

  const handleAutopilot = () => {
    if (autopilotActive) {
      triggerAutopilot('stop');
    } else {
      triggerAutopilot('start', strictness);
    }
  };

  const autopilotLabel = {
    idle: '🤖 Autopilot',
    generating: '⏳ Generating…',
    running: '⏹ Stop Autopilot',
    finished: '🤖 Autopilot',
  }[autopilotStatus] ?? '🤖 Autopilot';

  return (
    <div className="app">
      {/* Absolute Full Screen Map Background */}
      <MapView
        districts={districts}
        stepMs={stepMs}
        lastEvent={lastEvent}
        simulationStarted={simulationStarted}
        onFlyoverComplete={() => setFlyoverComplete(true)}
      />

      {/* Opening Splash Overlay */}
      {!simulationStarted && (
        <div className="splash-overlay">
          <div className="splash-content">
            <h1 className="splash-title">P O L I S</h1>
            <p className="splash-subtitle">48 nations. 3 million people. One city.</p>
            <div className="splash-card">
              <h2>World Cup 2026 — Toronto</h2>
              <p className="splash-meta">June 12 · Canada 1–1 Bosnia-Herzegovina</p>
            </div>
            <button className="start-btn" onClick={() => setSimulationStarted(true)}>
              Start Simulation →
            </button>
          </div>
        </div>
      )}

      {/* Floating Scoreboard (Top Center) */}
      {simulationStarted && (
        <div className="scoreboard-container">
          <Scoreboard score={score} matchMinute={matchMinute} cityMood={cityMood} />
        </div>
      )}

      {/* Floating Dismissable Live Feed Panel (Right Side) */}
      {simulationStarted && feedVisible && (
        <div className="sidebar glass">
          <div className="sidebar-header">
            <h2>
              <span className={`status-dot ${connected ? 'connected' : ''}`} />
              Live Feed
            </h2>
            <button className="close-feed-btn" onClick={() => setFeedVisible(false)} title="Close Feed">
              ×
            </button>
          </div>
          <div className="feed-list">
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
                <div className="feed-body">{entry.text}</div>
              </div>
            ))}
            {feedEntries.length === 0 && (
              <div className="feed-empty">Waiting for city activity...</div>
            )}
          </div>
        </div>
      )}

      {/* Reopen Feed Button (Floating top right) */}
      {simulationStarted && !feedVisible && (
        <button className="toggle-feed-btn glass" onClick={() => setFeedVisible(true)}>
          💬 Live Feed
        </button>
      )}

      {/* Floating Bottom Bar Event Controls (Bottom Center) */}
      {simulationStarted && (
        <div className="bottom-bar glass">
          <div className="events-grid">
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
          <div className="autopilot-controls">
            <select
              className="strictness-select"
              value={strictness}
              onChange={e => setStrictness(e.target.value)}
              disabled={autopilotActive}
            >
              <option value="conservative">Conservative</option>
              <option value="expressive">Expressive</option>
            </select>
            <button
              className={`event-btn autopilot-btn ${autopilotActive ? 'active' : ''}`}
              onClick={handleAutopilot}
              disabled={autopilotStatus === 'generating'}
            >
              {autopilotLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
