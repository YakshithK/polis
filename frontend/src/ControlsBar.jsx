import { useState, useEffect, memo } from 'react';

const EVENTS = [
  { label: '🚇 TTC Delay',      type: 'transit_strike',  team: null },
  { label: '🌡️ Heat Wave',      type: 'heat_wave',       team: null },
  { label: '⚽ Canada Scores',  type: 'street_party',    team: null },
];

const EVENT_ICONS = {
  transit_strike: '🚇', heat_wave: '🌡', festival: '🎉', power_outage: '⚡',
  major_layoffs: '📉', cultural_event: '🎭', protest: '✊', street_fair: '🛍',
  organic: '✦',
};

const PLACEHOLDERS = [
  "Transit strike starting at 6am tomorrow…",
  "Street fair on Kensington Ave this weekend…",
  "Heat wave hitting 38°C in Scarborough…",
  "Power outage near downtown core…",
  "Major tech layoffs announced in North York…",
  "Festival starting in Little Italy tonight…",
];

const SCENARIO_CHIPS = [
  { emoji: '🦠', label: 'COVID returns',     prompt: 'A new COVID outbreak has just been announced. Schools and transit closing.' },
  { emoji: '🌡️', label: 'Heat wave',         prompt: 'Extreme heat wave hits Toronto, temperature hits 42°C this afternoon.' },
  { emoji: '⚡',  label: 'Power outage',      prompt: 'Major power outage across downtown and midtown, affecting transit and watch parties.' },
  { emoji: '🎪', label: 'Festival downtown', prompt: 'A massive street festival has taken over King Street West and the Entertainment District.' },
  { emoji: '🏆', label: 'Canada wins',       prompt: 'Canada just won the World Cup final in the 120th minute of extra time.' },
  { emoji: '🚇', label: 'TTC strike',        prompt: 'TTC workers have just announced an emergency strike effective immediately.' },
  { emoji: '🌧️', label: 'Thunderstorm',     prompt: 'Severe thunderstorm warning across Toronto, outdoor events being cancelled.' },
  { emoji: '🎆', label: 'Celebration',       prompt: 'Spontaneous celebrations breaking out across the city after the match.' },
];

export default memo(function ControlsBar({ onEvent, autopilotStatus, onAutopilot, strictness, onStrictness, nlState, interpretation, onNaturalEvent }) {
  const [text, setText] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [flashingBtn, setFlashingBtn] = useState(null);
  const [chipStart, setChipStart] = useState(0);

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

  const visibleChips = SCENARIO_CHIPS.slice(chipStart, chipStart + 5);

  const autopilotLabel = {
    idle:       '🤖 Auto',
    generating: '⏳ …',
    running:    '⏹ Stop',
    finished:   '🤖 Auto',
  }[autopilotStatus] ?? '🤖 Auto';

  return (
    <div className="controls-bar glass">
      {/* NL Input */}
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

      {/* Scenario chips */}
      <div className="scenario-chips-row">
        <span className="scenario-chips-label">IDEAS</span>
        {visibleChips.map(chip => (
          <button
            key={chip.label}
            className="scenario-chip"
            onClick={() => setText(chip.prompt)}
            title={chip.prompt}
          >
            {chip.emoji} {chip.label}
          </button>
        ))}
        <button
          className="scenario-chip-more"
          onClick={() => setChipStart(s => (s + 5) % SCENARIO_CHIPS.length)}
          title="More scenarios"
        >
          ›
        </button>
      </div>

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
});
