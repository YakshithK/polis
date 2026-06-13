// Character name per district
const CHARACTERS = {
  scarborough:     'Amir',
  north_york:      'Mei',
  etobicoke:       'Carlos',
  downtown:        'Jordan',
  yorkville:       'Isabelle',
  kensington:      'Dev',
  little_portugal: 'Sofia',
  little_italy:    'Marco',
  rosedale:        'William',
  east_york:       'Grace',
  west_end:        'Sam',
  midtown:         'Priya',
};

// 12-step hue wheel for district badge colors
const DISTRICT_COLORS = {
  scarborough:     'hsl(0,   60%, 50%)',
  north_york:      'hsl(30,  60%, 50%)',
  etobicoke:       'hsl(60,  60%, 45%)',
  downtown:        'hsl(90,  55%, 42%)',
  yorkville:       'hsl(120, 55%, 42%)',
  kensington:      'hsl(150, 55%, 42%)',
  little_portugal: 'hsl(180, 55%, 42%)',
  little_italy:    'hsl(210, 60%, 52%)',
  rosedale:        'hsl(240, 60%, 58%)',
  east_york:       'hsl(270, 55%, 52%)',
  west_end:        'hsl(300, 55%, 50%)',
  midtown:         'hsl(330, 55%, 50%)',
};

function formatAge(ts) {
  const secs = Math.round((Date.now() / 1000) - ts);
  if (secs < 5)   return 'just now';
  if (secs < 60)  return `${secs}s`;
  return `${Math.round(secs / 60)}m`;
}

export default function FeedEntry({ entry }) {
  const { district, text, ts, character: wsCharacter } = entry;
  const character = wsCharacter ?? CHARACTERS[district] ?? district;
  const color     = DISTRICT_COLORS[district] ?? '#3d7bff';
  const label     = district.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="feed-entry">
      <div className="feed-entry-header">
        <div className="feed-district-dot" style={{ background: color }} />
        <span className="feed-author">{character} · {label}</span>
        {ts && <span className="feed-timestamp">{formatAge(ts)}</span>}
      </div>
      <div className="feed-text">"{text}"</div>
    </div>
  );
}

export { DISTRICT_COLORS, CHARACTERS };
