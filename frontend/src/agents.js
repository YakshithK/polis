export const AGENTS_BY_DISTRICT = {
  scarborough: [
    { id: 'amir',    name: 'Amir',     emoji: '🧑🏿',    align: 0.90, voice: 'passionate, loud, uses caps' },
    { id: 'grace',   name: 'Grace',    emoji: '👩🏽',    align: 0.82, voice: 'community-minded, measured' },
    { id: 'marcus',  name: 'Marcus',   emoji: '🧔🏾',   align: 0.75, voice: 'sarcastic, dry humor, still watching' },
  ],
  north_york: [
    { id: 'hassan',  name: 'Hassan',   emoji: '🧑🏾',    align: 0.80, voice: 'family-oriented, watches with relatives' },
    { id: 'mei',     name: 'Mei',      emoji: '👩🏻',    align: 0.72, voice: 'excited but composed, livestreaming' },
    { id: 'raj',     name: 'Raj',      emoji: '🧑🏽',    align: 0.76, voice: 'cricket fan who got into soccer last year' },
  ],
  etobicoke: [
    { id: 'donna',   name: 'Donna',    emoji: '👩🏼‍🦳',  align: 0.74, voice: 'neighbourhood watch energy, proud Canadian' },
    { id: 'kevin',   name: 'Kevin',    emoji: '🧑🏼',    align: 0.70, voice: 'sports bar regular, very loud' },
    { id: 'tanya',   name: 'Tanya',    emoji: '👩🏽',    align: 0.68, voice: 'surprised by how much she cares' },
  ],
  downtown: [
    { id: 'jordan',  name: 'Jordan',   emoji: '🧑🏽',    align: 0.58, voice: 'chronically online, extremely reactive' },
    { id: 'priya',   name: 'Priya',    emoji: '👩🏽‍💼', align: 0.62, voice: 'analytical, cites statistics mid-celebration' },
    { id: 'kai',     name: 'Kai',      emoji: '🧑🏽‍🎨', align: 0.55, voice: 'artist, makes everything aesthetic' },
  ],
  yorkville: [
    { id: 'james',   name: 'James',    emoji: '🧑🏼‍💼', align: 0.44, voice: 'more interested in the champagne than the match' },
    { id: 'elise',   name: 'Elise',    emoji: '👩🏼‍💼', align: 0.46, voice: 'watched in a private club, aesthetically invested' },
    { id: 'richard', name: 'Richard',  emoji: '👴🏼',    align: 0.42, voice: 'claims to be above sports but keeps checking the score' },
  ],
  kensington: [
    { id: 'theo',    name: 'Theo',     emoji: '🧑🏻‍🦱', align: 0.55, voice: 'counterculture, suspicious of mainstream excitement' },
    { id: 'luna',    name: 'Luna',     emoji: '👩🏻‍🦰', align: 0.60, voice: 'found a way to relate this to gentrification' },
    { id: 'sam_k',   name: 'Sam',      emoji: '🧑🏼',    align: 0.58, voice: 'vintage store owner, cautiously optimistic' },
  ],
  little_portugal: [
    { id: 'sofia',   name: 'Sofia',    emoji: '👩🏻',    align: 0.50, voice: 'split loyalties, warm, conflicted' },
    { id: 'diogo',   name: 'Diogo',    emoji: '🧑🏻',    align: 0.25, voice: 'Portugal mode, apologetic about Canada' },
    { id: 'ana',     name: 'Ana',      emoji: '👩🏻‍🦱', align: 0.55, voice: 'practical, loves both teams' },
  ],
  little_italy: [
    { id: 'marco',   name: 'Marco',    emoji: '🧑🏻',    align: 0.55, voice: 'Italy fan first, Canada fan second' },
    { id: 'giulia',  name: 'Giulia',   emoji: '👩🏻',    align: 0.60, voice: 'makes everything about food' },
    { id: 'franco',  name: 'Franco',   emoji: '👴🏻',    align: 0.50, voice: 'has seen too many heartbreaks to get excited' },
  ],
  rosedale: [
    { id: 'william', name: 'William',  emoji: '👴🏼',    align: 0.45, voice: 'polite, detached, champagne-adjacent' },
    { id: 'catherine', name: 'Catherine', emoji: '👩🏼', align: 0.50, voice: 'diplomatically opinionated, world traveler' },
    { id: 'oliver',  name: 'Oliver',   emoji: '🧑🏼',    align: 0.48, voice: 'vaguely watching from a rooftop patio' },
  ],
  east_york: [
    { id: 'denise',  name: 'Denise',   emoji: '👩🏾',    align: 0.72, voice: 'lifelong Toronto fan, very online' },
    { id: 'pat',     name: 'Pat',      emoji: '🧑🏼',    align: 0.68, voice: 'pub quiz regular, knows all the stats' },
    { id: 'zeynep',  name: 'Zeynep',   emoji: '👩🏽',    align: 0.74, voice: 'calls Canada goals before they happen' },
  ],
  west_end: [
    { id: 'nadia',   name: 'Nadia',    emoji: '👩🏽',    align: 0.66, voice: 'cyclist, progressive, quietly patriotic' },
    { id: 'felix',   name: 'Felix',    emoji: '🧑🏻',    align: 0.62, voice: 'works in tech, watching on second monitor' },
    { id: 'bea',     name: 'Bea',      emoji: '👩🏼‍🦱', align: 0.64, voice: 'artist-run gallery owner, ambivalent then ecstatic' },
  ],
  midtown: [
    { id: 'claire',  name: 'Claire',   emoji: '👩🏼',    align: 0.60, voice: 'young professional, Raptors crossover fan' },
    { id: 'andrew',  name: 'Andrew',   emoji: '🧑🏼',    align: 0.56, voice: 'finance bro who showed up for the vibe' },
    { id: 'diana',   name: 'Diana',    emoji: '👩🏻‍🦳', align: 0.58, voice: 'teacher, keeps it calm, very proud' },
  ],
};

export const DISTRICT_GEO = {
  scarborough:     { population: 629244,  area_km2: 187.7, density_per_km2: 3354,  canada_support: 82 },
  north_york:      { population: 655571,  area_km2: 174.0, density_per_km2: 3767,  canada_support: 75 },
  etobicoke:       { population: 380000,  area_km2: 131.0, density_per_km2: 2901,  canada_support: 70 },
  downtown:        { population: 296378,  area_km2: 7.1,   density_per_km2: 41744, canada_support: 60 },
  rosedale:        { population: 15200,   area_km2: 2.3,   density_per_km2: 6608,  canada_support: 40 },
  kensington:      { population: 22000,   area_km2: 1.4,   density_per_km2: 15714, canada_support: 55 },
  little_portugal: { population: 25000,   area_km2: 1.8,   density_per_km2: 13889, canada_support: 50 },
  little_italy:    { population: 20000,   area_km2: 1.6,   density_per_km2: 12500, canada_support: 52 },
  east_york:       { population: 117000,  area_km2: 21.5,  density_per_km2: 5442,  canada_support: 72 },
  west_end:        { population: 85000,   area_km2: 12.0,  density_per_km2: 7083,  canada_support: 63 },
  midtown:         { population: 95000,   area_km2: 14.8,  density_per_km2: 6419,  canada_support: 58 },
  yorkville:       { population: 28000,   area_km2: 2.5,   density_per_km2: 11200, canada_support: 45 },
};

// EFFECT_DURATIONS mirror of backend — used for decay bar display
export const EFFECT_DURATIONS = {
  goal:             120,
  red_card:          45,
  var_review:        20,
  penalty_miss:      60,
  championship_win: 480,
  elimination:      360,
  heat_wave:        300,
  pandemic:        1440,
  power_outage:     180,
  street_party:     150,
  festival:         480,
  traffic_jam:       90,
  storm:            200,
  transit_strike:   200,
  major_layoffs:    360,
  cultural_event:   120,
  protest:          180,
  street_fair:      120,
  organic:          120,
};
