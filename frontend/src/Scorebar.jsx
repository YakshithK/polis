export default function Scorebar({ score, matchMinute, autopilotActive, autopilotStatus }) {
  const progress = Math.min((matchMinute / 90) * 100, 100);

  const getClockDisplay = () => {
    if (autopilotStatus === 'generating') return '⏳';
    if (matchMinute === 45) return 'HALF TIME';
    if (matchMinute >= 90) return 'FULL TIME';
    return `${String(matchMinute).padStart(2, '0')}'`;
  };

  return (
    <div className={`scorebar glass${autopilotActive ? ' autopilot-active' : ''}`}>
      <div className="scorebar-row">
        <span className="scorebar-wordmark">ALGOPOLIS</span>

        <div className="scorebar-center">
          <div className="scorebar-team">
            <span className="scorebar-name">CAN</span>
          </div>
          <span className="scorebar-score">
            {score.canada} — {score.opponent}
          </span>
          <div className="scorebar-team">
            <span className="scorebar-name">BIH</span>
          </div>
        </div>

        <span className={`scorebar-clock${matchMinute === 45 || matchMinute >= 90 ? ' clock-flash' : ''}`}>
          {getClockDisplay()}
        </span>
      </div>
      <div className="scorebar-progress">
        <div className="scorebar-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
