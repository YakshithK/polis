import { memo } from 'react';
import FeedEntry from './FeedEntry';

export default memo(function FeedPanel({ feedEntries, activityEntries = [], connected }) {
  return (
    <div className="feed-panel glass panel-reveal">
      <div className="feed-panel-header">
        <div className="lp-feed-status">
          <div className={`feed-status-dot${connected ? ' live' : ''}`} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
            {connected ? 'Live' : 'Connecting…'}
          </span>
        </div>
      </div>
      <div className="lp-scroll">
        {(activityEntries.length === 0 && feedEntries.length === 0) ? (
          <div className="feed-empty-state">The city is quiet.<br />Inject an event below to wake it up.</div>
        ) : (
          [...activityEntries, ...feedEntries].map((entry, i) => (
            <FeedEntry key={`${entry.district}-${entry.ts}-${i}`} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
});
