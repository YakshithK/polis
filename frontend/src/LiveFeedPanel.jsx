import FeedEntry from './FeedEntry';

export default function LiveFeedPanel({ feedEntries, connected, onClose }) {
  return (
    <div className="feed-panel glass panel-reveal" style={{ animationDelay: '0.15s' }}>
      <div className="feed-panel-header">
        <div className="feed-panel-title">
          <div className={`feed-status-dot${connected ? ' live' : ''}`} />
          Live Feed
        </div>
        <button className="feed-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="feed-list">
        {feedEntries.length === 0 ? (
          <div className="feed-empty-state">
            The city is quiet.<br />Tap an event to wake it up.
          </div>
        ) : (
          feedEntries.map((entry, i) => (
            <FeedEntry key={`${entry.district}-${entry.ts}-${i}`} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
