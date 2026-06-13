const EMOTION_COLORS = {
  excitement:  '#ea580c',
  tension:     '#a21caf',
  pride:       '#2563eb',
  frustration: '#b91c1c',
};

export default function MoodBar({ emotion, value }) {
  const color = EMOTION_COLORS[emotion] ?? '#3d7bff';
  const pct   = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="mood-row">
      <span className="mood-emotion-label">{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</span>
      <div className="mood-bar-track">
        <div
          className="mood-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="mood-bar-value">{Math.round(pct)}</span>
    </div>
  );
}
