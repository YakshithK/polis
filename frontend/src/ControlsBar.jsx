import { useState, useEffect } from 'react';

const EVENTS = [
  { label: '⚽ CAN Goal',    type: 'goal',             team: 'canada',   color: '#f97316' },
  { label: '⚽ OPP Goal',    type: 'goal',             team: 'opponent', color: '#1a56db' },
  { label: '🟥 Red Card',    type: 'red_card',         team: 'canada',   color: '#dc2626' },
  { label: '📺 VAR',         type: 'var_review',       team: 'canada',   color: '#9333ea' },
  { label: '💀 Elim',        type: 'elimination',      team: 'canada',   color: '#0a0f1a' },
  { label: '🏆 Win',         type: 'championship_win', team: 'canada',   color: '#d97706' },
];

const EVENT_ICONS = {
  goal: '⚽', red_card: '🟥', var_review: '📺',
  penalty_miss: '😬', elimination: '💀', championship_win: '🏆', organic: '✦',
};

const PLACEHOLDERS = [
  "Canada scores a header in the 78th minute…",
  "Red card for Bosnia's midfielder…",
  "Fans flooding the streets of Scarborough…",
  "Power outage near BMO Field…",
  "Street party breaking out in Kensington…",
];

export default function ControlsBar({ onEvent, autopilotStatus, onAutopilot, strictness, onStrictness, nlState, interpretation, onNaturalEvent }) {
  const [text, setText] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [flashingBtn, setFlashingBtn] = useState(null);

  const autopilotActive = autopilotStatus === 'generating' || autopilotStatus === 'running';

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = () => {
    if (!text.trim() || nlState === 'interpreting') return;
    onNaturalEvent?.(text.trim());
    setText('');
  };

  const handleEvent = (ev) => {
    onEvent(ev.type, ev.team);
    setFlashingBtn(ev.label);
    setTimeout(() => setFlashingBtn(null), 320);
  };

  const autopilotLabel = {
    idle:       '🤖 Auto',
    generating: '⏳ …',
    running:    '⏹ Stop',
    finished:   '🤖 Auto',
  }[autopilotStatus] ?? '🤖 Auto';

  return (
    <div className="controls-bar glass">
      {/* NL Input — hero */}
      <div className="nl-input-wrapper">
        <span className="nl-input-icon">✦</span>
        <input
          className="nl-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={PLACEHOLDERS[placeholderIdx]}
          disabled={nlState === 'interpreting'}
        />
        <button className="nl-send" onClick={handleSubmit} disabled={nlState === 'interpreting'}>
          {nlState === 'interpreting' ? '…' : 'Send →'}
        </button>
      </div>

      {/* Interpretation chip */}
      {nlState === 'interpreted' && interpretation && (
        <div className="nl-chip">
          {EVENT_ICONS[interpretation.type] ?? '•'} {interpretation.description} · {interpretation.minute}' · {interpretation.severity?.toFixed(2)}
        </div>
      )}

      {/* Quick actions */}
      <div className="quick-actions">
        {EVENTS.map(ev => (
          <button
            key={ev.label}
            className={`quick-btn${flashingBtn === ev.label ? ' flashing' : ''}`}
            onClick={() => handleEvent(ev)}
          >
            {ev.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
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
