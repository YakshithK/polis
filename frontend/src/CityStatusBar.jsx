import { memo, useMemo } from 'react';

const SIM_START_HOUR = 6; // 6:00 AM Jul 31 2026
const SIM_MINUTES    = 24 * 60; // full day

function simTime(matchMinute) {
  const elapsed = (matchMinute / 90) * SIM_MINUTES;
  const total   = SIM_START_HOUR * 60 + elapsed;
  const hOfDay  = Math.floor(total / 60) % 24;
  const min     = Math.floor(total % 60);
  const day     = Math.floor(total / (24 * 60));
  const date    = day === 0 ? 'Jul 31, 2026' : 'Aug 1, 2026';
  const h12     = hOfDay % 12 || 12;
  const ampm    = hOfDay >= 12 ? 'PM' : 'AM';
  return `${date} · ${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
}

function getCityPulse(districts) {
  const list = Object.values(districts ?? {});
  if (!list.length) return { pulse: 0, label: 'Calm' };

  const peakFor = (district) => Math.max(
    district.emotion?.excitement ?? 0,
    district.emotion?.tension ?? 0,
    district.emotion?.pride ?? 0,
    district.emotion?.frustration ?? 0,
  );

  const avgPulse = list.reduce((sum, district) => sum + peakFor(district), 0) / list.length;
  const hottest = [...list].sort((a, b) => peakFor(b) - peakFor(a))[0]?.emotion ?? {};
  const label = Object.entries({
    Happiness: hottest.excitement ?? 0,
    Stress: hottest.tension ?? 0,
    Pride: hottest.pride ?? 0,
    Frustration: hottest.frustration ?? 0,
  }).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Calm';

  return { pulse: Math.round(avgPulse), label };
}

export default memo(function CityStatusBar({ matchMinute, districts }) {
  const clock = useMemo(() => simTime(matchMinute), [matchMinute]);
  const cityPulse = useMemo(() => getCityPulse(districts), [districts]);

  return (
    <div className="scorebar glass">
      <div className="scorebar-row" style={{ justifyContent: 'center', gap: 16 }}>
        <span className="scorebar-wordmark" style={{ letterSpacing: '0.12em', fontSize: 'var(--text-sm)' }}>
          ALGOPOLIS
        </span>
        <span style={{ color: 'var(--surface-border)' }}>·</span>
        <span className="scorebar-clock" style={{ fontFamily: 'var(--font-data)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          {clock}
        </span>
        <span style={{ color: 'var(--surface-border)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          Pulse {cityPulse.pulse} · {cityPulse.label}
        </span>
      </div>
    </div>
  );
});
