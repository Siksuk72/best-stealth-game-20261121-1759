// The game's rules and state, with no drawing and no browser in it: Wren the
// thief, the patrolling gardeners, lantern vision cones, noise, pebbles,
// Moonpetals, the gate, detection and the alarm. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound.
import { DETECTION, FIELD, GUARD, LIVES, PEBBLE, PLAYER, PETAL_POINTS, GHOST_BONUS, LEVEL_TIME_BONUS } from './config.js';
import { LEVELS, parseLevel } from './levels.js';

export const EVENT_PETAL = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LEVEL_CLEAR = 4;
export const EVENT_WIN = 8;
export const EVENT_GAME_OVER = 16;
export const EVENT_ALARM = 32;
export const EVENT_PEBBLE_LAND = 64;
export const EVENT_SPOTTED = 128;

const BLOCKS_MOVE = new Set(['#', 'C', 'S', '~']);
const BLOCKS_VISION = new Set(['#', 'C', 'S', 'B']);

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(angle, target, maxStep) {
  const d = angleDiff(target, angle);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

export function createWorld(random) {
  const state = {
    phase: 'play',
    levelIndex: 0,
    levelName: '',
    levelSubtitle: '',
    tiles: [],
    start: { x: 0, y: 0 },
    exit: { x: 0, y: 0, open: false },
    petals: [],
    petalsCollected: 0,
    petalsNeeded: 0,
    player: { x: 0, y: 0, angle: -Math.PI / 2, sneaking: false, moving: false, hidden: false, noiseRadius: 0, pebbles: PEBBLE.count },
    guards: [],
    pebbles: [],
    lanterns: [],
    alertness: 0,
    alarm: false,
    lastSeen: { x: 0, y: 0 },
    lives: LIVES,
    score: 0,
    levelTime: 0,
    totalTime: 0,
    ghost: true,
    levelBonus: 0,
    noisePulse: 0,
    ambient: false,
  };

  function tileAt(col, row) {
    if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return '#';
    return state.tiles[row][col];
  }

  function blocksMoveAt(col, row) {
    return BLOCKS_MOVE.has(tileAt(col, row));
  }

  function blocksVisionAt(col, row) {
    return BLOCKS_VISION.has(tileAt(col, row));
  }

  /** True when a straight line between two points crosses no sight-blocking tile. */
  function hasLineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const col = Math.floor((x0 + dx * t) / FIELD.tile);
      const row = Math.floor((y0 + dy * t) / FIELD.tile);
      if (blocksVisionAt(col, row)) return false;
    }
    return true;
  }

  /** Would `guard` see a point (x, y)? Bushes hide it unless the guard is close. */
  function guardSeesPoint(guard, x, y) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.viewRange) return false;
    const angle = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(angle, guard.angle)) > GUARD.viewHalfAngle) return false;
    if (!hasLineOfSight(guard.x, guard.y, x, y)) return false;
    const col = Math.floor(x / FIELD.tile);
    const row = Math.floor(y / FIELD.tile);
    if (tileAt(col, row) === 'B' && dist > PLAYER.bushSpotRange) return false;
    return true;
  }

  function guardSeesPlayer(guard) {
    return guardSeesPoint(guard, state.player.x, state.player.y);
  }

  /** Move a circle (x, y, radius) with axis separation against solid tiles. */
  function moveCircle(body, dx, dy) {
    const r = body.radius;
    let nx = body.x + dx;
    const top = Math.floor((body.y - r) / FIELD.tile);
    const bottom = Math.floor((body.y + r) / FIELD.tile);
    const left = Math.floor((nx - r) / FIELD.tile);
    const right = Math.floor((nx + r) / FIELD.tile);
    let blocked = false;
    for (let row = top; row <= bottom && !blocked; row += 1) {
      for (let col = left; col <= right; col += 1) {
        if (blocksMoveAt(col, row)) { blocked = true; break; }
      }
    }
    if (!blocked) body.x = nx;
    let ny = body.y + dy;
    const top2 = Math.floor((ny - r) / FIELD.tile);
    const bottom2 = Math.floor((ny + r) / FIELD.tile);
    const left2 = Math.floor((body.x - r) / FIELD.tile);
    const right2 = Math.floor((body.x + r) / FIELD.tile);
    blocked = false;
    for (let row = top2; row <= bottom2 && !blocked; row += 1) {
      for (let col = left2; col <= right2; col += 1) {
        if (blocksMoveAt(col, row)) { blocked = true; break; }
      }
    }
    if (!blocked) body.y = ny;
  }

  function makeGuard(def, index) {
    const first = def.waypoints[0];
    const second = def.waypoints[1 % def.waypoints.length];
    return {
      index,
      x: first.x,
      y: first.y,
      angle: Math.atan2(second.y - first.y, second.x - first.x),
      radius: GUARD.radius,
      waypoints: def.waypoints,
      waypointIndex: 1 % def.waypoints.length,
      pauseTimer: 0,
      scanDir: 1,
      scanBase: 0,
      state: 'patrol',
      targetX: 0,
      targetY: 0,
      searchTimer: 0,
      seesPlayer: false,
    };
  }

  function loadLevel(index) {
    const def = LEVELS[index];
    const parsed = parseLevel(def);
    state.levelIndex = index;
    state.levelName = def.name;
    state.levelSubtitle = def.subtitle;
    state.tiles = parsed.tiles;
    state.start = parsed.start;
    state.exit = { x: parsed.exit.x, y: parsed.exit.y, open: false };
    state.petals = parsed.petals.map((petal) => ({ ...petal }));
    state.petalsCollected = 0;
    state.petalsNeeded = def.petalsNeeded;
    state.lanterns = parsed.lanterns;
    state.player.x = parsed.start.x;
    state.player.y = parsed.start.y;
    state.player.angle = -Math.PI / 2;
    state.player.pebbles = PEBBLE.count;
    state.player.hidden = false;
    state.player.moving = false;
    state.player.sneaking = false;
    state.player.noiseRadius = 0;
    state.guards = parsed.guards.map((guard, i) => makeGuard(guard, i));
    state.pebbles = [];
    state.alertness = 0;
    state.alarm = false;
    state.ghost = true;
    state.levelTime = 0;
    state.levelBonus = 0;
    state.phase = 'play';
  }

  function reset() {
    state.lives = LIVES;
    state.score = 0;
    state.totalTime = 0;
    loadLevel(0);
  }

  function respawnAfterCaught() {
    state.player.x = state.start.x;
    state.player.y = state.start.y;
    state.player.angle = -Math.PI / 2;
    state.player.pebbles = PEBBLE.count;
    state.alertness = 0;
    state.alarm = false;
    state.pebbles = [];
    for (const guard of state.guards) {
      const def = LEVELS[state.levelIndex].guards[guard.index];
      const fresh = makeGuard({ waypoints: def.waypoints.map(([col, row]) => ({ x: (col + 0.5) * FIELD.tile, y: (row + 0.5) * FIELD.tile })) }, guard.index);
      Object.assign(guard, fresh);
    }
    state.phase = 'play';
  }

  /** Send guards that can hear it to look at (x, y). */
  function noiseAt(x, y, radius) {
    for (const guard of state.guards) {
      if (guard.state === 'chase') continue;
      const dist = Math.hypot(guard.x - x, guard.y - y);
      if (dist <= radius) {
        guard.state = 'investigate';
        guard.targetX = x + (random() - 0.5) * 24;
        guard.targetY = y + (random() - 0.5) * 24;
        guard.searchTimer = 0;
      }
    }
  }

  function throwPebble(tx, ty) {
    if (state.phase !== 'play' || state.player.pebbles <= 0) return false;
    const dx = tx - state.player.x;
    const dy = ty - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return false;
    const range = Math.min(dist, 300);
    state.player.pebbles -= 1;
    state.pebbles.push({
      x: state.player.x,
      y: state.player.y,
      tx: state.player.x + (dx / dist) * range,
      ty: state.player.y + (dy / dist) * range,
      speed: PEBBLE.speed,
    });
    return true;
  }

  function updatePlayer(dt, input) {
    const player = state.player;
    const mx = input.mx || 0;
    const my = input.my || 0;
    const len = Math.hypot(mx, my);
    player.moving = len > 0.1;
    player.sneaking = !!input.sneak;
    if (player.moving) {
      const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const nx = mx / Math.max(1, len);
      const ny = my / Math.max(1, len);
      moveCircle(player, nx * speed * dt, ny * speed * dt);
      player.angle = turnToward(player.angle, Math.atan2(ny, nx), 10 * dt);
      player.noiseRadius = player.sneaking ? PLAYER.sneakNoise : PLAYER.walkNoise;
      state.noisePulse -= dt;
      if (state.noisePulse <= 0) {
        state.noisePulse = 0.5;
        if (!player.sneaking) noiseAt(player.x, player.y, player.noiseRadius);
      }
    } else {
      player.noiseRadius = 0;
    }
    const col = Math.floor(player.x / FIELD.tile);
    const row = Math.floor(player.y / FIELD.tile);
    player.hidden = tileAt(col, row) === 'B';
  }

  function updateGuard(dt, guard) {
    const player = state.player;
    if (guard.state === 'patrol') {
      const target = guard.waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        // Scan the surroundings while waiting at a waypoint.
        guard.scanBase += guard.scanDir * 1.1 * dt;
        if (Math.abs(guard.scanBase) > 0.9) guard.scanDir *= -1;
        const baseAngle = Math.atan2(
          guard.waypoints[(guard.waypointIndex + 1) % guard.waypoints.length].y - target.y,
          guard.waypoints[(guard.waypointIndex + 1) % guard.waypoints.length].x - target.x,
        );
        guard.angle = turnToward(guard.angle, baseAngle + guard.scanBase, GUARD.turnRate * dt);
        return;
      }
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = GUARD.waypointPause;
        guard.scanBase = 0;
        guard.scanDir = random() < 0.5 ? -1 : 1;
        return;
      }
      const step = (GUARD.patrolSpeed * dt) / dist;
      moveCircle(guard, dx * step, dy * step);
      guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), GUARD.turnRate * dt);
      return;
    }
    if (guard.state === 'investigate' || guard.state === 'return') {
      const tx = guard.state === 'return' ? guard.waypoints[guard.waypointIndex].x : guard.targetX;
      const ty = guard.state === 'return' ? guard.waypoints[guard.waypointIndex].y : guard.targetY;
      const dx = tx - guard.x;
      const dy = ty - guard.y;
      const dist = Math.hypot(dx, dy);
      const speed = guard.state === 'return' ? GUARD.patrolSpeed : GUARD.investigateSpeed;
      if (dist < 8) {
        if (guard.state === 'investigate') {
          guard.state = 'search';
          guard.searchTimer = GUARD.searchTime * 0.6;
        } else {
          guard.state = 'patrol';
          guard.pauseTimer = 0.4;
        }
        return;
      }
      const step = (speed * dt) / dist;
      moveCircle(guard, dx * step, dy * step);
      guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), GUARD.turnRate * dt);
      return;
    }
    if (guard.state === 'chase') {
      const tx = state.lastSeen.x;
      const ty = state.lastSeen.y;
      const dx = tx - guard.x;
      const dy = ty - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        const step = (GUARD.chaseSpeed * dt) / dist;
        moveCircle(guard, dx * step, dy * step);
        guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), GUARD.turnRate * dt);
      }
      return;
    }
    if (guard.state === 'search') {
      guard.searchTimer -= dt;
      guard.angle += 1.6 * dt;
      if (guard.searchTimer <= 0) {
        guard.state = 'return';
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < guard.waypoints.length; i += 1) {
          const d = Math.hypot(guard.waypoints[i].x - guard.x, guard.waypoints[i].y - guard.y);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        guard.waypointIndex = best;
      }
    }
  }

  /**
   * One fixed step. `input` is {mx, my, sneak}. With `ambient` set the
   * gardeners patrol and nothing can be seen or caught (the title screen's
   * backdrop). Returns bit flags of what happened.
   */
  function step(dt, input, ambient) {
    let events = 0;
    if (state.phase !== 'play') return events;
    state.levelTime += dt;
    state.totalTime += dt;

    if (!ambient) updatePlayer(dt, input || { mx: 0, my: 0, sneak: false });
    else {
      state.player.moving = false;
      state.player.noiseRadius = 0;
    }

    // Pebbles fly, then clatter: every gardener in earshot comes to look.
    for (let i = state.pebbles.length - 1; i >= 0; i -= 1) {
      const pebble = state.pebbles[i];
      const dx = pebble.tx - pebble.x;
      const dy = pebble.ty - pebble.y;
      const dist = Math.hypot(dx, dy);
      const move = pebble.speed * dt;
      if (dist <= move) {
        state.pebbles.splice(i, 1);
        if (!ambient) noiseAt(pebble.tx, pebble.ty, PEBBLE.noiseRadius);
        events |= EVENT_PEBBLE_LAND;
      } else {
        pebble.x += (dx / dist) * move;
        pebble.y += (dy / dist) * move;
      }
    }

    // Vision: any gardener with eyes on Wren raises the alarm meter.
    let seen = false;
    let nearestSeen = Infinity;
    for (const guard of state.guards) {
      guard.seesPlayer = !ambient && guardSeesPlayer(guard);
      if (guard.seesPlayer) {
        seen = true;
        const dist = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
        nearestSeen = Math.min(nearestSeen, dist);
        state.lastSeen.x = state.player.x;
        state.lastSeen.y = state.player.y;
      }
    }
    if (seen) {
      const closeness = 1 - nearestSeen / GUARD.viewRange;
      let rate = DETECTION.farRate + (DETECTION.baseRate - DETECTION.farRate) * closeness;
      if (state.player.moving && !state.player.sneaking) rate *= DETECTION.runMultiplier;
      else if (state.player.sneaking) rate *= DETECTION.sneakMultiplier;
      const before = state.alertness;
      state.alertness = Math.min(100, state.alertness + rate * dt);
      if (before < 30 && state.alertness >= 30) events |= EVENT_SPOTTED;
      if (state.alertness >= DETECTION.alarmAt && !state.alarm) {
        state.alarm = true;
        state.ghost = false;
        events |= EVENT_ALARM;
        for (const guard of state.guards) {
          if (guard.state !== 'chase') {
            guard.state = 'chase';
            guard.searchTimer = 0;
          }
        }
      }
    } else {
      state.alertness = Math.max(0, state.alertness - DETECTION.decayRate * dt);
      if (state.alarm && state.alertness < DETECTION.alarmEndsBelow) {
        state.alarm = false;
        for (const guard of state.guards) {
          if (guard.state === 'chase') {
            guard.state = 'search';
            guard.searchTimer = GUARD.searchTime;
          }
        }
      }
    }

    for (const guard of state.guards) {
      if (ambient) {
        const saved = guard.state;
        guard.state = 'patrol';
        updateGuard(dt, guard);
        guard.state = saved;
      } else {
        updateGuard(dt, guard);
      }
    }

    if (!ambient) {
      // Caught: a chasing gardener lays a hand on Wren.
      if (state.alarm) {
        for (const guard of state.guards) {
          const dist = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
          if (dist < guard.radius + PLAYER.radius + 2) {
            state.lives -= 1;
            state.phase = state.lives <= 0 ? 'over' : 'caught';
            events |= EVENT_CAUGHT;
            if (state.lives <= 0) events |= EVENT_GAME_OVER;
            return events;
          }
        }
      }

      // Moonpetals.
      for (const petal of state.petals) {
        if (petal.taken) continue;
        const dist = Math.hypot(petal.x - state.player.x, petal.y - state.player.y);
        if (dist < 26) {
          petal.taken = true;
          state.petalsCollected += 1;
          state.score += PETAL_POINTS;
          events |= EVENT_PETAL;
          if (state.petalsCollected >= state.petalsNeeded) state.exit.open = true;
        }
      }

      // The gate, once every petal is stolen.
      if (state.exit.open) {
        const dist = Math.hypot(state.exit.x - state.player.x, state.exit.y - state.player.y);
        if (dist < 32) {
          const timeBonus = Math.max(0, LEVEL_TIME_BONUS - Math.floor(state.levelTime) * 2);
          const ghostBonus = state.ghost ? GHOST_BONUS : 0;
          state.levelBonus = timeBonus + ghostBonus;
          state.score += state.levelBonus;
          if (state.levelIndex + 1 >= LEVELS.length) {
            state.phase = 'win';
            events |= EVENT_WIN;
          } else {
            state.phase = 'clear';
            events |= EVENT_LEVEL_CLEAR;
          }
          return events;
        }
      }
    }
    return events;
  }

  function advanceLevel() {
    loadLevel(state.levelIndex + 1);
  }

  reset();
  return {
    state, reset, loadLevel, step, throwPebble, respawnAfterCaught, advanceLevel,
    guardSeesPoint, hasLineOfSight, tileAt,
  };
}
