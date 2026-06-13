export default function Scoreboard({ score, matchMinute, cityMood }) {
  const moodColor = cityMood >= 70 ? '#ef4444' : cityMood >= 50 ? '#f97316' : '#3b82f6';

  return (
    <div className="scoreboard">
      <div className="scoreboard-row">
        <div className="team-block">
          <span className="team-flag">🇨🇦</span>
          <span className="team-name">CAN</span>
          <span className="team-score">{score.canada}</span>
        </div>
        <div className="match-clock">
          <span className="clock-min">{String(Math.min(matchMinute, 90)).padStart(2, '0')}'</span>
        </div>
        <div className="team-block opponent">
          <span className="team-score">{score.opponent}</span>
          <span className="team-name">BIH</span>
          <span className="team-flag">🇧🇦</span>
        </div>
      </div>
      <div className="mood-row">
        <span className="mood-label">City Mood</span>
        <div className="mood-track">
          <div
            className="mood-fill"
            style={{ width: `${cityMood}%`, background: moodColor }}
          />
        </div>
        <span className="mood-pct">{Math.round(cityMood)}%</span>
      </div>
    </div>
  );
}
