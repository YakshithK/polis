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

export default memo(function CityStatusBar({ matchMinute }) {
  const clock = useMemo(() => simTime(matchMinute), [matchMinute]);

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
      </div>
    </div>
  );
});
