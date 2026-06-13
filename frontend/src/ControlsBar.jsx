import { useState } from 'react';

const EVENTS = [
  { label: '⚽ CAN Goal',    type: 'goal',             team: 'canada',   color: '#FFB300' },
  { label: '⚽ OPP Goal',    type: 'goal',             team: 'opponent', color: '#4A90D9' },
  { label: '🟥 Red Card',    type: 'red_card',         team: 'canada',   color: '#EF4444' },
  { label: '📺 VAR',         type: 'var_review',       team: 'canada',   color: '#A78BFA' },
  { label: '💀 Elim',        type: 'elimination',      team: 'canada',   color: '#1f2937' },
  { label: '🏆 Win',         type: 'championship_win', team: 'canada',   color: '#FFB300' },
];

export default function ControlsBar({ onEvent, autopilotStatus, onAutopilot, strictness, onStrictness }) {
  const [flashingBtn, setFlashingBtn] = useState(null);
  const autopilotActive = autopilotStatus === 'generating' || autopilotStatus === 'running';

  const handleEvent = (ev) => {
    onEvent(ev.type, ev.team);
    setFlashingBtn(ev.label);
    setTimeout(() => setFlashingBtn(null), 320);
  };

  const autopilotLabel = {
    idle:       '🤖 Autopilot',
    generating: '⏳ Generating…',
    running:    '⏹ Running',
    finished:   '🤖 Autopilot',
  }[autopilotStatus] ?? '🤖 Autopilot';

  return (
    <div className="controls-bar glass panel-reveal" style={{ animationDelay: '0.3s' }}>
      <div className="controls-events-row">
        {EVENTS.map(ev => (
          <button
            key={ev.label}
            className={`event-btn${flashingBtn === ev.label ? ' flashing' : ''}`}
            style={{ '--flash-color': ev.color }}
            onClick={() => handleEvent(ev)}
          >
            {ev.label}
          </button>
        ))}
      </div>
      <div className="controls-autopilot-row">
        <button
          className={`autopilot-btn${autopilotActive ? ' running' : ''}`}
          onClick={onAutopilot}
          disabled={autopilotStatus === 'generating'}
        >
          {autopilotLabel}
        </button>
        <select
          className="strictness-btn"
          value={strictness}
          onChange={e => onStrictness(e.target.value)}
          disabled={autopilotActive}
        >
          <option value="conservative">Conservative</option>
          <option value="expressive">Expressive</option>
        </select>
      </div>
    </div>
  );
}
