import { useState, useEffect, useRef } from 'react';
import MapView from './MapView';
import Scorebar from './Scorebar';
import CityStatsPanel from './CityStatsPanel';
import LiveFeedPanel from './LiveFeedPanel';
import EventLogBar from './EventLogBar';
import ControlsBar from './ControlsBar';
import DistrictCard from './DistrictCard';
import SplashScreen from './SplashScreen';
import { useSimulation } from './useSimulation';

export default function App() {
  const {
    districts, feedEntries, connected, injectEvent,
    lastEvent, autopilotStatus, triggerAutopilot, eventLog,
  } = useSimulation();

  const [simulationStarted, setSimulationStarted] = useState(false);
  const [flyoverComplete,   setFlyoverComplete]   = useState(false);
  const [feedVisible,       setFeedVisible]       = useState(true);
  const [strictness,        setStrictness]        = useState('conservative');
  const [score,             setScore]             = useState({ canada: 0, opponent: 0 });
  const [matchMinute,       setMatchMinute]       = useState(0);
  const [panelsVisible,     setPanelsVisible]     = useState(false);
  const [clickedDistrict,   setClickedDistrict]   = useState(null);
  const clockRef = useRef(null);

  const autopilotActive = autopilotStatus === 'generating' || autopilotStatus === 'running';

  // Track score from goal events
  useEffect(() => {
    if (lastEvent?.type === 'goal') {
      setScore(prev => ({ ...prev, [lastEvent.team]: prev[lastEvent.team] + 1 }));
    }
  }, [lastEvent]);

  // Match clock: starts after flyover complete
  useEffect(() => {
    if (!connected || !simulationStarted || !flyoverComplete) return;
    if (clockRef.current) return;
    clockRef.current = setInterval(() => setMatchMinute(m => Math.min(m + 1, 90)), 1000);
    return () => { clearInterval(clockRef.current); clockRef.current = null; };
  }, [connected, simulationStarted, flyoverComplete]);

  // Stagger panel fade-in after flyover
  useEffect(() => {
    if (!flyoverComplete) return;
    const t = setTimeout(() => setPanelsVisible(true), 200);
    return () => clearTimeout(t);
  }, [flyoverComplete]);

  const stepMs = lastEvent
    ? lastEvent.severity >= 0.8 ? 80 : lastEvent.severity <= 0.4 ? 180 : 120
    : 120;

  const handleAutopilot = () => {
    if (autopilotActive) triggerAutopilot('stop');
    else                  triggerAutopilot('start', strictness);
  };

  const handleDistrictClick = (info) => {
    setClickedDistrict(info); // null closes card
  };

  // Dismiss district card on ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setClickedDistrict(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <MapView
        districts={districts}
        stepMs={stepMs}
        lastEvent={lastEvent}
        simulationStarted={simulationStarted}
        onFlyoverComplete={() => setFlyoverComplete(true)}
        onDistrictClick={handleDistrictClick}
      />

      {/* Splash */}
      {!simulationStarted && (
        <SplashScreen onStart={() => setSimulationStarted(true)} />
      )}

      {/* All UI panels — render after flyover */}
      {simulationStarted && panelsVisible && (
        <>
          {/* Top center: Scorebar */}
          <Scorebar
            score={score}
            matchMinute={matchMinute}
            autopilotActive={autopilotActive}
            autopilotStatus={autopilotStatus}
          />

          {/* Left: City Stats */}
          <CityStatsPanel districts={districts} />

          {/* Right: Live Feed or pill */}
          {feedVisible ? (
            <LiveFeedPanel
              feedEntries={feedEntries}
              connected={connected}
              onClose={() => setFeedVisible(false)}
            />
          ) : (
            <button
              className="feed-pill glass"
              onClick={() => setFeedVisible(true)}
            >
              {feedEntries[0]?.text ? `💬 "${feedEntries[0].text.slice(0, 40)}…"` : '💬 Live Feed'}
            </button>
          )}

          {/* Bottom: Event log */}
          <EventLogBar eventLog={eventLog} />

          {/* Bottom center: Controls */}
          <ControlsBar
            onEvent={injectEvent}
            autopilotStatus={autopilotStatus}
            onAutopilot={handleAutopilot}
            strictness={strictness}
            onStrictness={setStrictness}
          />

          {/* Floating district card */}
          {clickedDistrict && (
            <DistrictCard
              info={clickedDistrict}
              districts={districts}
              feedEntries={feedEntries}
              eventLog={eventLog}
              onClose={() => setClickedDistrict(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
