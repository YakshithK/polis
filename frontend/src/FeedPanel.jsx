import FeedEntry from './FeedEntry';

export default function FeedPanel({ feedEntries, connected }) {
  return (
    <div className="feed-panel glass panel-reveal" style={{ animationDelay: '0.15s' }}>
      <div className="feed-panel-header">
        <div className="lp-feed-status">
          <div className={`feed-status-dot${connected ? ' live' : ''}`} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
            {connected ? 'Live' : 'Connecting…'}
          </span>
        </div>
      </div>
      <div className="lp-scroll">
        {feedEntries.length === 0 ? (
          <div className="feed-empty-state">The city is quiet.<br />Inject an event below to wake it up.</div>
        ) : (
          feedEntries.map((entry, i) => (
            <FeedEntry key={`${entry.district}-${entry.ts}-${i}`} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
