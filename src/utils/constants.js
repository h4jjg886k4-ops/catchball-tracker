export const VIEWS = {
  HOME: 'home',
  SETUP: 'setup',
  LIVE: 'live',
  STATS: 'stats',
  HISTORY: 'history',
};

export const EVENT_TYPES = {
  // Serve
  ACE:              'ace',
  SERVE_IN:         'serve_in',
  SERVE_ERROR:      'serve_error',
  // Attack – 2nd ball (player receives and immediately attacks)
  ATTACK_WIN_2ND:   'attack_win_2nd',   // wins the point
  ATTACK_CONT_2ND:  'attack_cont_2nd',  // rally continues, no point
  // Attack – 3rd ball (set + attack sequence)
  ATTACK_WIN_3RD:   'attack_win_3rd',   // wins the point
  ATTACK_CONT_3RD:  'attack_cont_3rd',  // rally continues, no point
  // Attack errors (always lose the point)
  ATTACK_OUT:       'attack_out',       // ball goes out / net / floor on own side
  ATTACK_BLOCKED:   'attack_blocked',   // opponent block wins the rally
  // Defense
  DEFENSE_SUCCESS:  'defense_success',  // successful dig / defense
  DEFENSE_ERROR:    'defense_error',    // ball drops / failed defense
  BLOCK_TOUCH:      'block_touch',      // touched the block, rally continues
  BLOCK_MISTAKE:    'block_mistake',    // blocking mistake, coach decides on point
  // Setting
  SET_SUCCESS:      'set_success',      // clean set
  SET_ERROR:        'set_error',        // illegal / out / missed set
  // Other
  BLOCK:            'block',            // own team blocks opponent → point
  OPPONENT_ERROR:   'opponent_error',   // opponent mistake gives us a point
  FREE_BALL:        'free_ball',        // free ball received, rally continues
};

const T = EVENT_TYPES;

// Events that immediately score a point for HOME team
export const HOME_SCORE_EVENTS = new Set([
  T.ACE,
  T.ATTACK_WIN_2ND,
  T.ATTACK_WIN_3RD,
  T.BLOCK,
  T.OPPONENT_ERROR,
]);

// Events that immediately score a point for OPPONENT
export const OPPONENT_SCORE_EVENTS = new Set([
  T.SERVE_ERROR,
  T.ATTACK_OUT,
  T.ATTACK_BLOCKED,
  T.DEFENSE_ERROR,
  T.SET_ERROR,
]);

// Events that trigger the court attack drawing popup (opponent scored via an attack we could have defended)
export const COURT_DRAW_EVENTS = new Set([
  T.ATTACK_BLOCKED,
  T.SET_ERROR,
  T.BLOCK_MISTAKE,
]);

// Events where rally continues (neither team scored yet)
export const NEUTRAL_EVENTS = new Set([
  T.SERVE_IN,
  T.ATTACK_CONT_2ND,
  T.ATTACK_CONT_3RD,
  T.DEFENSE_SUCCESS,
  T.SET_SUCCESS,
  T.FREE_BALL,
  T.BLOCK_TOUCH,
  T.BLOCK_MISTAKE,
]);

/**
 * EVENT_CONFIG drives both the EventButtons UI and the event log labels.
 * score: '+1' | '-1' | null
 * color: 'green' | 'red' | 'blue' | 'slate'
 */
export const EVENT_CONFIG = [
  // ── SERVE ──────────────────────────────────────────────────────────
  { type: T.ACE,              label: 'Ace',              emoji: '🎯', score: '+1', color: 'green', category: 'serve' },
  { type: T.SERVE_IN,         label: 'Serve In',         emoji: '✅', score: null, color: 'blue',  category: 'serve' },
  { type: T.SERVE_ERROR,      label: 'Serve Error',      emoji: '❌', score: '-1', color: 'red',   category: 'serve' },
  // ── ATTACK ─────────────────────────────────────────────────────────
  { type: T.ATTACK_WIN_2ND,   label: 'Win – 2nd Ball',   emoji: '⚡', score: '+1', color: 'green', category: 'attack' },
  { type: T.ATTACK_CONT_2ND,  label: 'Continue – 2nd',   emoji: '↩️', score: null, color: 'blue',  category: 'attack' },
  { type: T.ATTACK_WIN_3RD,   label: 'Win – 3rd Ball',   emoji: '⚡', score: '+1', color: 'green', category: 'attack' },
  { type: T.ATTACK_CONT_3RD,  label: 'Continue – 3rd',   emoji: '↩️', score: null, color: 'blue',  category: 'attack' },
  { type: T.ATTACK_OUT,       label: 'Attack Out',        emoji: '💥', score: '-1', color: 'red',   category: 'attack' },
  { type: T.ATTACK_BLOCKED,   label: 'Blocked',           emoji: '🛑', score: '-1', color: 'red',   category: 'attack' },
  // ── DEFENSE ────────────────────────────────────────────────────────
  { type: T.BLOCK_TOUCH,      label: 'Block Touch',      emoji: '🖐️', score: null, color: 'blue',  category: 'defense' },
  { type: T.BLOCK_MISTAKE,    label: 'Blocking Mistake', emoji: '🚫', score: null, color: 'slate', category: 'defense' },
  { type: T.DEFENSE_ERROR,    label: 'Defense Error',    emoji: '⛔', score: '-1', color: 'red',   category: 'defense' },
  // ── SETTING ────────────────────────────────────────────────────────
  { type: T.SET_SUCCESS,      label: 'Successful Set',   emoji: '🙌', score: null, color: 'blue',  category: 'setting' },
  { type: T.SET_ERROR,        label: 'Setting Error',    emoji: '🔴', score: '-1', color: 'red',   category: 'setting' },
  // ── OTHER ──────────────────────────────────────────────────────────
  { type: T.BLOCK,            label: 'Block',            emoji: '🛡️', score: '+1', color: 'green', category: 'other' },
  { type: T.OPPONENT_ERROR,   label: 'Opponent Error',   emoji: '🎁', score: '+1', color: 'green', category: 'other' },
  { type: T.FREE_BALL,        label: 'Free Ball',        emoji: '🏐', score: null, color: 'slate', category: 'other' },
];

export const POSITIONS = {
  SETTER: 'Setter',
  OPPOSITE: 'Opposite',
  OUTSIDE: 'Outside',
  MIDDLE: 'Middle',
  LIBERO: 'Libero',
  DS: 'DS',
};

export const POSITION_ABBR = {
  Setter: 'S',
  Opposite: 'OPP',
  Outside: 'OH',
  Middle: 'MB',
  Libero: 'L',
  DS: 'DS',
};

export const ROTATION_LAYOUT = [
  [4, 3, 2],  // front row: left → right
  [5, 6, 1],  // back row:  left → right
];

export const SET_WIN_SCORE = 25;
export const SET_5_WIN_SCORE = 15;
export const MIN_LEAD = 2;
