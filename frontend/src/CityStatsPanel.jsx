import MoodBar from './MoodBar';

const LEGEND = [
  { key: 'excitement',  color: '#ea580c' },
  { key: 'tension',     color: '#a21caf' },
  { key: 'pride',       color: '#2563eb' },
  { key: 'frustration', color: '#b91c1c' },
];

function pulseColor(value) {
  if (value >= 70) return '#ea580c';
  if (value >= 50) return '#d97706';
  return '#3d7bff';
}

function peakEmotion(district) {
  const e = district.emotion ?? {};
  return Math.max(e.excitement ?? 0, e.tension ?? 0, e.pride ?? 0, e.frustration ?? 0);
}

function excessEmotion(district) {
  return Math.max(0, peakEmotion(district) - 50);
}

export default function CityStatsPanel({ districts }) {
  const districtList = Object.values(districts);

  const avg = (getter) => {
    if (!districtList.length) return 0;
    return districtList.reduce((s, d) => s + (getter(d) ?? 0), 0) / districtList.length;
  };

  const ranked = [...districtList].sort((a, b) => peakEmotion(b) - peakEmotion(a));
  const cityPulse = Math.round(
    50 +
    avg(d => excessEmotion(d)) * 2.6 +
    (ranked[0] ? excessEmotion(ranked[0]) * 1.25 : 0) +
    (ranked[1] ? excessEmotion(ranked[1]) * 0.75 : 0) +
    (ranked[2] ? excessEmotion(ranked[2]) * 0.5 : 0)
  );
  const avgExc       = avg(d => d.emotion?.excitement);
  const avgTen       = avg(d => d.emotion?.tension);
  const avgPri       = avg(d => d.emotion?.pride);
  const avgFru       = avg(d => d.emotion?.frustration);
  const avgSupport   = Math.round(avg(d => d.alignment?.canada_support) || 64);

  const hottest = ranked
    .slice(0, 3);

  return (
    <div className="city-stats glass panel-reveal" style={{ animationDelay: '0.15s' }}>
      <div className="stats-section">
        <div className="stats-label">City Pulse</div>
        <div className="city-pulse-number" style={{ color: pulseColor(cityPulse) }}>
          {cityPulse}
        </div>
        <div className="city-pulse-sub">avg excitement</div>
      </div>

      <div className="stats-section">
        <div className="stats-label">Mood Breakdown</div>
        <MoodBar emotion="Happiness"   value={Math.min(100, avgExc + avg(d => excessEmotion(d)) * 0.9)} />
        <MoodBar emotion="Stress"      value={Math.min(100, avgTen + avg(d => excessEmotion(d)) * 1.1)} />
        <MoodBar emotion="Pride"       value={Math.min(100, avgPri + avg(d => excessEmotion(d)) * 0.8)} />
        <MoodBar emotion="Frustration" value={Math.min(100, avgFru + avg(d => excessEmotion(d)) * 1.2)} />
      </div>

      <div className="stats-section">
        <div className="stats-label">Hottest Now</div>
        {hottest.map(d => (
          <div key={d.district_id} className="hottest-row">
            <span>🔥</span>
            <span className="hottest-name">{d.district_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            <span className="hottest-val">{Math.round(peakEmotion(d))} · +{Math.round(excessEmotion(d))}</span>
          </div>
        ))}
        {!hottest.length && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Loading…</div>}
      </div>

      <div className="stats-section">
        <div className="stats-label">🇨🇦 Canada Support</div>
        <div className="support-pct">avg {avgSupport}% across city</div>
      </div>

      <div className="stats-section">
        <div className="stats-label">Legend</div>
        {LEGEND.map(({ key, color }) => (
          <div key={key} className="legend-row">
            <div className="legend-dot" style={{ background: color }} />
            <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
