// The screenshot scenes behind ?shot=title|patrol|alarm|victory. Each one
// plays the real rules forward from a fresh world for a fixed time, steered
// by a simple autopilot (sneak toward the nearest Moonpetal, then the gate;
// wait when a lantern cone covers the way; run when stuck), so the frame is
// what a short game really looks like and the same seed always gives the
// same frame.
import { GUARD, STEP } from './config.js';
import { EVENT_ALARM, EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;
const DIRS = [
  [0, 0],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, 0.7071], [-0.7071, -0.7071],
];

function inCone(world, guard, x, y) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.viewRange) return false;
  const angle = Math.atan2(dy, dx);
  let diff = angle - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD.viewHalfAngle) return false;
  return world.hasLineOfSight(guard.x, guard.y, x, y);
}

function dangerAt(world, x, y) {
  let danger = 0;
  for (const guard of world.state.guards) {
    if (world.guardSeesPoint(guard, x, y)) danger += 1000;
    else if (inCone(world, guard, x, y)) danger += 300;
  }
  return danger;
}

/** The nearest bush tile's centre: somewhere to hide while the alarm dies down. */
function nearestBush(world) {
  const s = world.state;
  let best = null;
  let bestDist = Infinity;
  for (let row = 0; row < s.tiles.length; row += 1) {
    for (let col = 0; col < s.tiles[row].length; col += 1) {
      if (s.tiles[row][col] !== 'B') continue;
      const x = (col + 0.5) * 40;
      const y = (row + 0.5) * 40;
      const d = Math.hypot(x - s.player.x, y - s.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y, dist: d };
      }
    }
  }
  return best;
}

/** A pilot that sneaks toward the next goal and waits out the lantern light. */
function createPilot(world, reckless) {
  let boldUntil = 0;
  let lastProgress = 0;
  let lastDist = Infinity;
  let detourUntil = 0;
  let detourDir = 0;
  let lastX = 0;
  let lastY = 0;
  let stuckTimer = 0;

  function target() {
    const s = world.state;
    let best = null;
    let bestDist = Infinity;
    for (const petal of s.petals) {
      if (petal.taken) continue;
      const d = Math.hypot(petal.x - s.player.x, petal.y - s.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = petal;
      }
    }
    if (best) return { x: best.x, y: best.y, dist: bestDist };
    return { x: s.exit.x, y: s.exit.y, dist: Math.hypot(s.exit.x - s.player.x, s.exit.y - s.player.y) };
  }

  return function pilot(now) {
    const s = world.state;
    const p = s.player;
    // Alarmed: slip into the nearest bush and wait the alarm out.
    if (s.alarm && !reckless) {
      const bush = nearestBush(world);
      if (bush && bush.dist > 12) {
        const len = Math.max(1, bush.dist);
        return { mx: (bush.x - p.x) / len, my: (bush.y - p.y) / len, sneak: true };
      }
      return { mx: 0, my: 0, sneak: true };
    }
    const goal = target();
    const bold = reckless || (now < boldUntil && s.alertness < 40);
    // No progress toward the goal for a while: run at it boldly for a bit.
    if (goal.dist < lastDist - 6) {
      lastDist = goal.dist;
      lastProgress = now;
    } else if (now - lastProgress > 6 && !reckless) {
      boldUntil = now + 1.2;
      lastProgress = now;
      lastDist = goal.dist;
    }
    // Stuck against a wall: sidestep for a moment.
    const moved = Math.hypot(p.x - lastX, p.y - lastY);
    if (moved < 0.05 && (Math.abs(p.x) > 0 || Math.abs(p.y) > 0)) stuckTimer += SAMPLE;
    else stuckTimer = 0;
    lastX = p.x;
    lastY = p.y;
    if (stuckTimer > 1 && now >= detourUntil) {
      detourUntil = now + 0.9;
      detourDir = (detourDir + 1) % 4;
      stuckTimer = 0;
    }
    if (now < detourUntil) {
      const perp = [
        [0, -1], [0, 1], [-1, 0], [1, 0],
      ][detourDir];
      return { mx: perp[0], my: perp[1], sneak: false };
    }
    if (reckless) {
      const len = Math.max(1, goal.dist);
      return { mx: (goal.x - p.x) / len, my: (goal.y - p.y) / len, sneak: false };
    }
    let bestDir = DIRS[0];
    let bestScore = Infinity;
    for (const [dx, dy] of DIRS) {
      const nx = p.x + dx * 68 * 0.3;
      const ny = p.y + dy * 68 * 0.3;
      const dist = Math.hypot(goal.x - nx, goal.y - ny);
      const danger = dangerAt(world, nx, ny);
      const score = dist + danger * (bold ? 0.02 : 1);
      if (score < bestScore) {
        bestScore = score;
        bestDir = [dx, dy];
      }
    }
    return { mx: bestDir[0], my: bestDir[1], sneak: !bold };
  };
}

/** Play the world forward with `pilot` until `stop` says so; returns the events seen. */
function simulate(world, pilot, maxSeconds, stop) {
  let events = 0;
  let now = 0;
  const steps = Math.floor(maxSeconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    events |= world.step(SAMPLE, pilot(now));
    now += SAMPLE;
    if (stop && stop(events, now)) break;
    if (world.state.phase !== 'play') break;
  }
  return { events, now };
}

function info(world, screen) {
  const s = world.state;
  return {
    screen,
    level: s.levelIndex + 1,
    levelName: s.levelName,
    petals: `${s.petalsCollected}/${s.petalsNeeded}`,
    alertness: Math.round(s.alertness),
    alarm: s.alarm,
    lives: s.lives,
    score: s.score,
    phase: s.phase,
    player: { x: Math.round(s.player.x), y: Math.round(s.player.y) },
  };
}

/**
 * Set `world` to the named scene (title, patrol, alarm or victory) and return
 * the screen to draw over it plus a summary of the staged state.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'alarm') {
    world.loadLevel(1);
    const pilot = createPilot(world, true);
    simulate(world, pilot, 120, (events) => (events & EVENT_ALARM) !== 0);
    if (world.state.alarm) simulate(world, createPilot(world, true), 0.9);
    return { screen: SCREEN_PLAY, info: info(world, SCREEN_PLAY) };
  }
  if (name === 'victory') {
    world.loadLevel(0);
    const pilot = createPilot(world, false);
    const { events } = simulate(world, pilot, 240, (ev) => (ev & (EVENT_LEVEL_CLEAR | EVENT_WIN | EVENT_CAUGHT)) !== 0);
    if (events & EVENT_WIN) return { screen: SCREEN_CLEAR, info: info(world, SCREEN_CLEAR) };
    if (events & EVENT_LEVEL_CLEAR) return { screen: SCREEN_CLEAR, info: info(world, SCREEN_CLEAR) };
    return { screen: SCREEN_PLAY, info: info(world, SCREEN_PLAY) };
  }
  if (name === 'patrol') {
    world.loadLevel(1);
    const pilot = createPilot(world, false);
    simulate(world, pilot, 32);
    return { screen: SCREEN_PLAY, info: info(world, SCREEN_PLAY) };
  }
  // title (and anything else): the gardeners patrol behind the title panel.
  world.loadLevel(0);
  for (let i = 0; i < 5 / SAMPLE; i += 1) world.step(SAMPLE, { mx: 0, my: 0 }, true);
  return { screen: SCREEN_TITLE, info: info(world, SCREEN_TITLE) };
}
