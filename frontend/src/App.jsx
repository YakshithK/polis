import { useState, useEffect, useRef } from 'react';
import MapView from './MapView';
import Scorebar from './Scorebar';
import LeftPanel from './LeftPanel';
import ControlsBar from './ControlsBar';
import DistrictCard from './DistrictCard';
import SplashScreen from './SplashScreen';
import { useSimulation } from './useSimulation';
import { useAmbience } from './useAmbience';

export default function App() {
  const {
    districts, feedEntries, connected, connectionError, injectEvent,
    lastEvent, autopilotStatus, triggerAutopilot, eventLog, matchMinute,
  } = useSimulation();

  const [simulationStarted, setSimulationStarted] = useState(false);
  const [flyoverComplete,   setFlyoverComplete]   = useState(false);
  const [strictness,        setStrictness]        = useState('conservative');
  const [score,             setScore]             = useState({ canada: 0, opponent: 0 });
  const [panelsVisible,     setPanelsVisible]     = useState(false);
  const [clickedDistrict,   setClickedDistrict]   = useState(null);
  const [replayEvent,       setReplayEvent]       = useState(null);

  const autopilotActive = autopilotStatus === 'generating' || autopilotStatus === 'running';

  const { start: startAmbience, setAmbience, triggerGroan } = useAmbience();

  // Reset score when starting autopilot
  useEffect(() => {
    if (autopilotStatus === 'generating') {
      setScore({ canada: 0, opponent: 0 });
    }
  }, [autopilotStatus]);

  // Track score from goal events
  useEffect(() => {
    if (lastEvent?.type === 'goal') {
      setScore(prev => ({ ...prev, [lastEvent.team]: prev[lastEvent.team] + 1 }));
    }
  }, [lastEvent]);


  // Stagger panel fade-in after flyover
  useEffect(() => {
    if (!flyoverComplete) return;
    const t = setTimeout(() => setPanelsVisible(true), 200);
    return () => clearTimeout(t);
  }, [flyoverComplete]);

  // Start ambient audio when user clicks Start (browser requires gesture)
  useEffect(() => {
    if (simulationStarted) startAmbience();
  }, [simulationStarted]);

  // Update ambience crossfade on every district state change
  useEffect(() => {
    const vals = Object.values(districts);
    if (!vals.length) return;
    const avg = vals.reduce((sum, d) => sum + (d.emotion?.excitement ?? 0), 0) / vals.length;
    setAmbience(avg);
  }, [districts]);

  // One-shot groan on elimination
  useEffect(() => {
    if (lastEvent?.type === 'elimination' && lastEvent?.team === 'canada') {
      triggerGroan();
    }
  }, [lastEvent]);

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

  const handleEventLogClick = (ev) => {
    setReplayEvent({ ...ev, _replayTs: Date.now() });
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
        replayEvent={replayEvent}
      />

      {/* Splash */}
      {!simulationStarted && (
        <SplashScreen onStart={() => setSimulationStarted(true)} />
      )}

      {/* Backend connection error banner */}
      {connectionError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(185,28,28,0.92)', color: '#fff',
          padding: '8px 16px', fontSize: '13px', fontFamily: 'monospace',
          textAlign: 'center',
        }}>
          {connectionError} — retrying…
        </div>
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

          {/* Left: tabbed panel (City Pulse / Live Feed / Events) */}
          <LeftPanel
            districts={districts}
            feedEntries={feedEntries}
            connected={connected}
            eventLog={eventLog}
            onEventClick={handleEventLogClick}
          />

          {/* Bottom center: Controls */}
          <div className="bottom-panel panel-reveal" style={{ animationDelay: '0.3s' }}>
            <ControlsBar
              onEvent={injectEvent}
              autopilotStatus={autopilotStatus}
              onAutopilot={handleAutopilot}
              strictness={strictness}
              onStrictness={setStrictness}
            />
          </div>

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
