export default function Scorebar({ score, matchMinute, autopilotActive, autopilotStatus }) {
  const progress = Math.min((matchMinute / 90) * 100, 100);

  return (
    <div className={`scorebar glass${autopilotActive ? ' autopilot-active' : ''}`}>
      <div className="scorebar-row">
        <span className="scorebar-wordmark">ALGOPOLIS</span>

        <div className="scorebar-center">
          <div className="scorebar-team">
            <span className="scorebar-flag">🇨🇦</span>
            <span className="scorebar-name">CAN</span>
          </div>
          <span className="scorebar-score">
            {score.canada} — {score.opponent}
          </span>
          <div className="scorebar-team" style={{ flexDirection: 'row-reverse' }}>
            <span className="scorebar-flag">🇧🇦</span>
            <span className="scorebar-name">BIH</span>
          </div>
        </div>

        <span className="scorebar-clock">
          {autopilotStatus === 'generating' ? '⏳' : `${String(Math.min(matchMinute, 90)).padStart(2, '0')}'`}
        </span>
      </div>
      <div className="scorebar-progress">
        <div className="scorebar-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
