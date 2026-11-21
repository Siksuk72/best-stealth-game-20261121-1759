// VERDANT — Stealth in the Moonlit Glasshouse.
// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area (32 by 18 tiles of 40 px); the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, cols: 32, rows: 18, tile: 40 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 132,
  sneakSpeed: 68,
  /** Noise radius while walking; sneaking is far quieter. */
  walkNoise: 120,
  sneakNoise: 34,
  /** How close a guard must be to spot a player hiding in a bush. */
  bushSpotRange: 52,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 56,
  investigateSpeed: 78,
  chaseSpeed: 108,
  /** How far a guard's lantern light reaches, in pixels. */
  viewRange: 228,
  /** Half of the vision cone's angle, in radians. */
  viewHalfAngle: 0.62,
  /** Seconds a guard pauses at each patrol waypoint, looking around. */
  waypointPause: 1.4,
  /** Seconds a guard searches the last seen spot after losing the player. */
  searchTime: 3.2,
  /** How fast a guard turns, radians per second. */
  turnRate: 3.4,
};

export const DETECTION = {
  /** Alertness gained per second while a guard sees the player at point blank. */
  baseRate: 46,
  /** Alertness gained per second at the far edge of a cone. */
  farRate: 16,
  /** Multiplier while the player runs. */
  runMultiplier: 1.7,
  /** Multiplier while the player sneaks. */
  sneakMultiplier: 0.55,
  /** Alertness lost per second while nobody sees the player. */
  decayRate: 13,
  /** Alertness at which the alarm trips and every guard chases. */
  alarmAt: 100,
  /** Alertness below which the alarm stands down. */
  alarmEndsBelow: 38,
};

export const PEBBLE = {
  count: 3,
  speed: 420,
  /** Guards inside this radius of the landing spot come to look. */
  noiseRadius: 170,
};

export const PETAL_POINTS = 100;
export const LEVEL_TIME_BONUS = 400;
export const GHOST_BONUS = 250;
export const LIVES = 3;

export const PALETTE = {
  backdrop: '#05070d',
  night: '#0a1210',
  floorA: '#263b2e',
  floorB: '#203327',
  floorPath: '#36432c',
  grout: '#16221a',
  wall: '#484f57',
  wallTop: '#6d7780',
  wallDark: '#23272c',
  crate: '#6b4e2e',
  crateDark: '#4a341f',
  crateLight: '#8a6a3e',
  statue: '#7d838a',
  statueDark: '#565c63',
  bush: '#1e4d2a',
  bushLight: '#2f6b3a',
  bushDark: '#122f1a',
  water: '#16384a',
  waterLight: '#1f4d66',
  petal: '#7df9e8',
  petalCore: '#e8fff9',
  petalPink: '#ff9ecf',
  exitOpen: '#8dff6a',
  exitLocked: '#ff5d5d',
  guardCoat: '#c9a227',
  guardHat: '#7a5c14',
  guardSkin: '#e8b98a',
  lantern: '#ffb347',
  coneCalm: 'rgba(255, 196, 90, 0.27)',
  coneCalmEdge: 'rgba(255, 196, 90, 0.14)',
  coneSuspicious: 'rgba(255, 150, 60, 0.37)',
  coneAlert: 'rgba(255, 70, 60, 0.42)',
  player: '#2ec4b6',
  playerDark: '#17756d',
  playerCloak: '#0f3d3a',
  hudPanel: 'rgba(6, 12, 10, 0.72)',
  text: '#eef6ee',
  muted: '#9db3a4',
  gold: '#f2c94c',
  danger: '#ff6b5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'verdant.best';
