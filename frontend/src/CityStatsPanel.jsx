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

export default function CityStatsPanel({ districts }) {
  const districtList = Object.values(districts);

  const avg = (getter) => {
    if (!districtList.length) return 0;
    return districtList.reduce((s, d) => s + (getter(d) ?? 0), 0) / districtList.length;
  };

  const cityPulse    = Math.round(avg(d => d.emotion?.excitement));
  const avgExc       = avg(d => d.emotion?.excitement);
  const avgTen       = avg(d => d.emotion?.tension);
  const avgPri       = avg(d => d.emotion?.pride);
  const avgFru       = avg(d => d.emotion?.frustration);
  const avgSupport   = Math.round(avg(d => d.alignment?.canada_support) || 64);

  const hottest = [...districtList]
    .sort((a, b) => (b.emotion?.excitement ?? 0) - (a.emotion?.excitement ?? 0))
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
        <MoodBar emotion="excitement"  value={avgExc} />
        <MoodBar emotion="tension"     value={avgTen} />
        <MoodBar emotion="pride"       value={avgPri} />
        <MoodBar emotion="frustration" value={avgFru} />
      </div>

      <div className="stats-section">
        <div className="stats-label">Hottest Now</div>
        {hottest.map(d => (
          <div key={d.district_id} className="hottest-row">
            <span>🔥</span>
            <span className="hottest-name">{d.district_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            <span className="hottest-val">{Math.round(d.emotion?.excitement ?? 0)}</span>
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
