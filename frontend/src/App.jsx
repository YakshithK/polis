import { useState, useEffect, useRef, useCallback } from 'react';
import MapView from './MapView';
import CityStatusBar from './CityStatusBar';
import LeftPanel from './LeftPanel';
import FeedPanel from './FeedPanel';
import ControlsBar from './ControlsBar';
import DistrictCard from './DistrictCard';
import SplashScreen from './SplashScreen';
import { useSimulation } from './useSimulation';

export default function App() {
  const {
    districts, feedEntries, activityEntries, activityByDistrict,
    connected, connectionError, injectEvent,
    lastEvent, autopilotStatus, triggerAutopilot, eventLog, matchMinute,
    nlState, interpretation, submitNaturalEvent,
  } = useSimulation();

  const [simulationStarted, setSimulationStarted] = useState(false);
  const [strictness,      setStrictness]      = useState('conservative');
  const [userAgent,       setUserAgent]       = useState(null);
  const [clickedDistrict, setClickedDistrict] = useState(null);
  const [replayEvent,     setReplayEvent]     = useState(null);

  const autopilotActive = autopilotStatus === 'generating' || autopilotStatus === 'running';

  const stepMs = lastEvent
    ? lastEvent.severity >= 0.8 ? 80 : lastEvent.severity <= 0.4 ? 180 : 120
    : 120;

  const handleAutopilot = useCallback(() => {
    if (autopilotActive) triggerAutopilot('stop');
    else                  triggerAutopilot('start', strictness);
  }, [autopilotActive, triggerAutopilot, strictness]);

  const handleDistrictClick = useCallback((info) => {
    setClickedDistrict(info);
  }, []);

  const handleEventLogClick = useCallback((ev) => {
    setReplayEvent({ ...ev, _replayTs: Date.now() });
  }, []);

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
        onDistrictClick={handleDistrictClick}
        replayEvent={replayEvent}
        userAgent={userAgent}
      />

      {/* Splash */}
      {!simulationStarted && (
        <SplashScreen
          onStart={(agent) => {
            setUserAgent(agent);
            setSimulationStarted(true);
          }}
        />
      )}

      {/* Backend connection error banner */}
      {connectionError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(220,38,38,0.95)', color: '#fff',
          padding: '8px 16px', fontSize: '13px', fontFamily: 'var(--font-data)',
          textAlign: 'center',
        }}>
          {connectionError} — retrying…
        </div>
      )}

      {/* All UI panels */}
      {simulationStarted && (
        <>
          {/* Top center: Scorebar */}
          <CityStatusBar matchMinute={matchMinute} districts={districts} />

          {/* Left: tabbed panel (Pulse / Events) */}
          <LeftPanel
            districts={districts}
            eventLog={eventLog}
            onEventClick={handleEventLogClick}
            activityByDistrict={activityByDistrict}
          />

          {/* Right: always-visible feed panel */}
          <FeedPanel
            feedEntries={feedEntries}
            activityEntries={activityEntries}
            connected={connected}
          />

          {/* Bottom: Controls */}
          <div className="bottom-panel panel-reveal">
            <ControlsBar
              onEvent={injectEvent}
              autopilotStatus={autopilotStatus}
              onAutopilot={handleAutopilot}
              strictness={strictness}
              onStrictness={setStrictness}
              nlState={nlState}
              interpretation={interpretation}
              onNaturalEvent={submitNaturalEvent}
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
