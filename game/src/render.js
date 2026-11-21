// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Canvas 2D throughout: tiled mossy floor,
// stone walls, crates, statues, bushes, ponds, glowing Moonpetals, lantern
// light pools, raycast vision cones, a darkness overlay with light cut out
// around the player and the lanterns, and the HUD and panels.
import { FIELD, FONT, GUARD, PALETTE } from './config.js';
import { createRandom, hash2 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CONE_RAYS = 26;
const TILE = FIELD.tile;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const light = document.createElement('canvas');
  light.width = FIELD.width;
  light.height = FIELD.height;
  const lightCtx = light.getContext('2d');
  const scoreLabel = cachedLabel('SCORE ');
  const timeLabel = cachedLabel('');
  const petalsLabel = cachedLabel('');
  const bestLabel = cachedLabel('BEST ');
  const finalLabel = cachedLabel('SCORE ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function tileChar(state, col, row) {
    if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return '#';
    return state.tiles[row][col];
  }

  function blocksVision(state, col, row) {
    const ch = tileChar(state, col, row);
    return ch === '#' || ch === 'C' || ch === 'S' || ch === 'B';
  }

  /** The vision cone as a polygon: rays march out until a wall, crate, statue or bush stops them. */
  function conePolygon(state, guard) {
    const points = [{ x: guard.x, y: guard.y }];
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.angle - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / CONE_RAYS;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let reach = GUARD.viewRange;
      for (let d = 8; d <= GUARD.viewRange; d += 8) {
        const col = Math.floor((guard.x + dx * d) / TILE);
        const row = Math.floor((guard.y + dy * d) / TILE);
        if (blocksVision(state, col, row)) {
          reach = d - 8;
          break;
        }
      }
      points.push({ x: guard.x + dx * Math.max(0, reach), y: guard.y + dy * Math.max(0, reach) });
    }
    return points;
  }

  function drawFloor(state, time) {
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const ch = state.tiles[row][col];
        const x = col * TILE;
        const y = row * TILE;
        const h = hash2(col, row);
        if (ch === '#') {
          context.fillStyle = h < 0.5 ? PALETTE.wall : PALETTE.wallDark;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, TILE, 5);
          context.fillStyle = 'rgba(255,255,255,0.05)';
          context.fillRect(x, y + 5, TILE, 2);
          continue;
        }
        context.fillStyle = h < 0.33 ? PALETTE.floorA : h < 0.66 ? PALETTE.floorB : PALETTE.floorPath;
        context.fillRect(x, y, TILE, TILE);
        context.fillStyle = PALETTE.grout;
        context.fillRect(x, y + TILE - 1, TILE, 1);
        context.fillRect(x + TILE - 1, y, 1, TILE);
        if (h > 0.82) {
          context.fillStyle = 'rgba(120,180,110,0.10)';
          context.beginPath();
          context.arc(x + 10 + h * 20, y + 12 + (h * 37 % 16), 5, 0, Math.PI * 2);
          context.fill();
        }
        if (ch === '~') {
          context.fillStyle = PALETTE.water;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.waterLight;
          const wob = Math.sin(time * 1.4 + col * 1.7 + row * 2.3) * 3;
          context.fillRect(x + 6, y + 10 + wob, TILE - 12, 2);
          context.fillRect(x + 8, y + 24 - wob, TILE - 16, 2);
        }
      }
    }
  }

  function drawCover(state) {
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const ch = state.tiles[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === 'C') {
          context.fillStyle = PALETTE.crateDark;
          context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.fillStyle = PALETTE.crate;
          context.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
          context.strokeStyle = PALETTE.crateLight;
          context.lineWidth = 2;
          context.strokeRect(x + 8, y + 8, TILE - 16, TILE - 16);
          context.beginPath();
          context.moveTo(x + 5, y + 5);
          context.lineTo(x + TILE - 5, y + TILE - 5);
          context.moveTo(x + TILE - 5, y + 5);
          context.lineTo(x + 5, y + TILE - 5);
          context.stroke();
        } else if (ch === 'S') {
          context.fillStyle = 'rgba(0,0,0,0.35)';
          context.beginPath();
          context.ellipse(x + TILE / 2 + 4, y + TILE - 6, 16, 6, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = PALETTE.statueDark;
          context.fillRect(x + 8, y + TILE - 12, TILE - 16, 10);
          context.fillStyle = PALETTE.statue;
          context.beginPath();
          context.arc(x + TILE / 2, y + TILE / 2 - 2, 11, 0, Math.PI * 2);
          context.fill();
          context.fillRect(x + TILE / 2 - 7, y + TILE / 2 + 4, 14, 12);
        } else if (ch === 'B') {
          const h = hash2(col, row);
          context.fillStyle = PALETTE.bushDark;
          context.beginPath();
          context.arc(x + 12, y + 24, 13, 0, Math.PI * 2);
          context.arc(x + 28, y + 26, 12, 0, Math.PI * 2);
          context.arc(x + 20, y + 14, 12, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = PALETTE.bush;
          context.beginPath();
          context.arc(x + 11, y + 22, 10, 0, Math.PI * 2);
          context.arc(x + 27, y + 24, 9, 0, Math.PI * 2);
          context.arc(x + 19, y + 13, 9, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = PALETTE.bushLight;
          context.beginPath();
          context.arc(x + 12 + h * 6, y + 14, 4, 0, Math.PI * 2);
          context.arc(x + 26, y + 18 + h * 5, 3, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  function drawPatrolPaths(state) {
    context.strokeStyle = 'rgba(238,246,238,0.13)';
    context.lineWidth = 2;
    context.setLineDash([2, 10]);
    context.lineCap = 'round';
    for (const guard of state.guards) {
      context.beginPath();
      const wps = guard.waypoints;
      context.moveTo(wps[0].x, wps[0].y);
      for (let i = 1; i < wps.length; i += 1) context.lineTo(wps[i].x, wps[i].y);
      context.closePath();
      context.stroke();
    }
    context.setLineDash([]);
  }

  function drawPetals(state, time) {
    for (const petal of state.petals) {
      if (petal.taken) continue;
      const pulse = 0.75 + 0.25 * Math.sin(time * 3 + petal.x * 0.01);
      const glow = context.createRadialGradient(petal.x, petal.y, 2, petal.x, petal.y, 34);
      glow.addColorStop(0, `rgba(125,249,232,${0.5 * pulse})`);
      glow.addColorStop(1, 'rgba(125,249,232,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(petal.x, petal.y, 34, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.petalPink;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + time * 0.4;
        context.beginPath();
        context.ellipse(petal.x + Math.cos(a) * 8, petal.y + Math.sin(a) * 8, 6, 3.5, a, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = PALETTE.petalCore;
      context.beginPath();
      context.arc(petal.x, petal.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawExit(state, time) {
    const exit = state.exit;
    const open = exit.open;
    const pulse = open ? 0.8 + 0.2 * Math.sin(time * 4) : 0.45;
    const glow = context.createRadialGradient(exit.x, exit.y, 4, exit.x, exit.y, 66);
    glow.addColorStop(0, open ? `rgba(141,255,106,${0.5 * pulse})` : 'rgba(255,93,93,0.25)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(exit.x, exit.y, 66, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = open ? PALETTE.exitOpen : PALETTE.exitLocked;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(exit.x, exit.y, 22, Math.PI, 0);
    context.moveTo(exit.x - 22, exit.y);
    context.lineTo(exit.x - 22, exit.y + 16);
    context.moveTo(exit.x + 22, exit.y);
    context.lineTo(exit.x + 22, exit.y + 16);
    context.stroke();
    context.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitLocked;
    context.beginPath();
    context.arc(exit.x, exit.y + 4, 5, 0, Math.PI * 2);
    context.fill();
    text('GATE', exit.x, exit.y - 32, 12, open ? PALETTE.exitOpen : PALETTE.muted, 'center', 'bold ');
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const polygon = conePolygon(state, guard);
      let fill = PALETTE.coneCalm;
      if (guard.state === 'chase') fill = PALETTE.coneAlert;
      else if (guard.state === 'investigate' || guard.state === 'search') fill = PALETTE.coneSuspicious;
      else if (guard.seesPlayer) fill = PALETTE.coneSuspicious;
      context.fillStyle = fill;
      context.beginPath();
      context.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i += 1) context.lineTo(polygon[i].x, polygon[i].y);
      context.closePath();
      context.fill();
      context.strokeStyle = PALETTE.coneCalmEdge;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function drawGuards(state, time) {
    for (const guard of state.guards) {
      const glow = context.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, 46);
      glow.addColorStop(0, 'rgba(255,179,71,0.30)');
      glow.addColorStop(1, 'rgba(255,179,71,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(guard.x, guard.y, 46, 0, Math.PI * 2);
      context.fill();
      // Body: a gardener in a mustard coat and wide hat, lantern in hand.
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(guard.x + 3, guard.y + 12, 14, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardCoat;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardSkin;
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 4, guard.y + Math.sin(guard.angle) * 4, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardHat;
      context.beginPath();
      context.ellipse(guard.x, guard.y - 2, 15, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardHat;
      context.beginPath();
      context.arc(guard.x, guard.y - 3, 7, 0, Math.PI * 2);
      context.fill();
      // Lantern swinging ahead of the guard.
      const lx = guard.x + Math.cos(guard.angle) * 20;
      const ly = guard.y + Math.sin(guard.angle) * 20 + Math.sin(time * 2 + guard.index) * 1.5;
      context.fillStyle = PALETTE.lantern;
      context.beginPath();
      context.arc(lx, ly, 4.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.arc(lx, ly, 2, 0, Math.PI * 2);
      context.fill();
      // "?" while suspicious, "!" while chasing.
      if (guard.state === 'chase') {
        text('!', guard.x, guard.y - 26, 26, PALETTE.danger, 'center', 'bold ');
      } else if (guard.state === 'investigate' || guard.state === 'search' || guard.seesPlayer) {
        text('?', guard.x, guard.y - 26, 24, PALETTE.gold, 'center', 'bold ');
      }
    }
  }

  function drawPebbles(state) {
    for (const pebble of state.pebbles) {
      context.fillStyle = '#cfd6cf';
      context.beginPath();
      context.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    const glow = context.createRadialGradient(player.x, player.y, 4, player.x, player.y, 34);
    glow.addColorStop(0, 'rgba(46,196,182,0.30)');
    glow.addColorStop(1, 'rgba(46,196,182,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(player.x, player.y, 34, 0, Math.PI * 2);
    context.fill();
    if (player.hidden) {
      context.strokeStyle = 'rgba(125,249,232,0.5)';
      context.lineWidth = 2;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.arc(player.x, player.y, 18, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    if (player.moving && !player.sneaking) {
      const ring = (time * 60) % 30;
      context.strokeStyle = `rgba(238,246,238,${0.25 * (1 - ring / 30)})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, 18 + ring, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.beginPath();
    context.ellipse(player.x + 2, player.y + 11, 13, 5, 0, 0, Math.PI * 2);
    context.fill();
    const crouch = player.sneaking ? 0.8 : 1;
    // Hooded cloak: a triangle pointing where Wren faces, hood at the front.
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    const a = player.angle;
    const tipX = player.x + Math.cos(a) * 16;
    const tipY = player.y + Math.sin(a) * 16;
    const leftX = player.x + Math.cos(a + 2.4) * 12 * crouch;
    const leftY = player.y + Math.sin(a + 2.4) * 12 * crouch;
    const rightX = player.x + Math.cos(a - 2.4) * 12 * crouch;
    const rightY = player.y + Math.sin(a - 2.4) * 12 * crouch;
    context.moveTo(tipX, tipY);
    context.lineTo(leftX, leftY);
    context.lineTo(rightX, rightY);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 9 * crouch + 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.arc(player.x + Math.cos(a) * 4, player.y + Math.sin(a) * 4, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawFireflies(state, time) {
    const random = createRandom(state.levelIndex * 1000 + 7);
    const spots = [];
    for (let i = 0; i < 22; i += 1) spots.push({ x: 40 + random() * (FIELD.width - 80), y: 60 + random() * (FIELD.height - 120) });
    for (let i = 0; i < spots.length; i += 1) {
      const spot = spots[i];
      const fx = spot.x + Math.sin(time * 0.7 + i * 2.1) * 14;
      const fy = spot.y + Math.cos(time * 0.5 + i * 1.3) * 10;
      const alpha = 0.25 + 0.35 * Math.abs(Math.sin(time * 1.8 + i));
      context.fillStyle = `rgba(190,255,140,${alpha})`;
      context.beginPath();
      context.arc(fx, fy, 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLanternLight(state, time) {
    for (const lantern of state.lanterns || []) {
      const flicker = 0.85 + 0.15 * Math.sin(time * 5 + lantern.x);
      const glow = context.createRadialGradient(lantern.x, lantern.y, 2, lantern.x, lantern.y, 52);
      glow.addColorStop(0, `rgba(255,179,71,${0.28 * flicker})`);
      glow.addColorStop(1, 'rgba(255,179,71,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(lantern.x, lantern.y, 52, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3a2c14';
      context.fillRect(lantern.x - 2, lantern.y - 2, 4, 12);
      context.fillStyle = PALETTE.lantern;
      context.beginPath();
      context.arc(lantern.x, lantern.y - 4, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function punchLight(ctx, x, y, radius, strength) {
    const gradient = ctx.createRadialGradient(x, y, 4, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(0.7, `rgba(0,0,0,${strength * 0.55})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Night falls over the glasshouse, then light is cut out around the player, the lanterns and the petals. */
  function drawLighting(state) {
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.clearRect(0, 0, FIELD.width, FIELD.height);
    lightCtx.fillStyle = 'rgba(4,9,16,0.45)';
    lightCtx.fillRect(0, 0, FIELD.width, FIELD.height);
    lightCtx.globalCompositeOperation = 'destination-out';
    punchLight(lightCtx, state.player.x, state.player.y, 220, 0.9);
    for (const guard of state.guards) punchLight(lightCtx, guard.x, guard.y, 130, 0.75);
    for (const lantern of state.lanterns || []) punchLight(lightCtx, lantern.x, lantern.y, 110, 0.6);
    for (const petal of state.petals) {
      if (!petal.taken) punchLight(lightCtx, petal.x, petal.y, 70, 0.6);
    }
    punchLight(lightCtx, state.exit.x, state.exit.y, 110, 0.55);
    context.drawImage(light, 0, 0);
  }

  function drawHud(state, screen, best, opts) {
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(0, 0, FIELD.width, 48);
    context.fillStyle = 'rgba(255,255,255,0.08)';
    context.fillRect(0, 48, FIELD.width, 1);
    text(`LEVEL ${state.levelIndex + 1} · ${state.levelName.toUpperCase()}`, 18, 30, 19, PALETTE.text, 'left', 'bold ');
    text(petalsLabel(`${state.petalsCollected}/${state.petalsNeeded} MOONPETALS`), FIELD.width / 2, 30, 17, PALETTE.petal, 'center');
    text(scoreLabel(state.score), FIELD.width - 18, 30, 19, PALETTE.text, 'right', 'bold ');
    const mm = Math.floor(state.levelTime / 60);
    const ss = String(Math.floor(state.levelTime % 60)).padStart(2, '0');
    text(timeLabel(`${mm}:${ss}`), FIELD.width - 140, 30, 17, PALETTE.muted, 'right');
    // Lives as hearts, pebbles as dots, under the score.
    for (let i = 0; i < 3; i += 1) {
      const hx = FIELD.width - 268 + i * 22;
      context.fillStyle = i < state.lives ? '#ff7d9c' : 'rgba(255,255,255,0.15)';
      context.beginPath();
      context.arc(hx, 20, 5, 0, Math.PI * 2);
      context.arc(hx + 9, 20, 5, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(hx - 4, 22);
      context.lineTo(hx + 13, 22);
      context.lineTo(hx + 4.5, 31);
      context.closePath();
      context.fill();
    }
    text(`PEBBLES ${state.player.pebbles}`, FIELD.width - 300, 30, 14, PALETTE.muted, 'right');
    // Detection meter, under the top bar.
    if (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT) {
      const w = 280;
      const x = (FIELD.width - w) / 2;
      const y = 60;
      context.fillStyle = 'rgba(6,12,10,0.72)';
      context.fillRect(x - 10, y - 4, w + 20, 26);
      const alert = state.alertness;
      const fillColor = state.alarm ? PALETTE.danger : alert > 55 ? PALETTE.gold : '#c9a227';
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(x, y, w, 12);
      context.fillStyle = fillColor;
      context.fillRect(x, y, Math.round((w * alert) / 100), 12);
      const label = state.alarm ? 'SPOTTED — RUN!' : alert > 55 ? 'SUSPICIOUS…' : alert > 5 ? 'HEARD SOMETHING…' : state.player.hidden ? 'HIDDEN IN THE BUSHES' : 'UNSEEN';
      text(label, FIELD.width / 2, y + 34, 13, state.alarm ? PALETTE.danger : PALETTE.muted, 'center', 'bold ');
    }
    // Objective line at the bottom.
    const objective = state.exit.open
      ? 'All Moonpetals stolen — reach the glowing gate!'
      : `Steal ${state.petalsNeeded - state.petalsCollected} more Moonpetal${state.petalsNeeded - state.petalsCollected === 1 ? '' : 's'}, then reach the gate.`;
    text(objective, 18, FIELD.height - 14, 15, PALETTE.muted, 'left');
    text('WASD move · Shift sneak · Space / click pebble · P pause · H help', FIELD.width - 18, FIELD.height - 14, 15, PALETTE.muted, 'right');
    if (opts.muted) text('MUTED', 18, 76, 13, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineHeight = 30;
    const height = 150 + lines.length * lineHeight + 64;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(4,8,7,0.82)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || 'rgba(125,249,232,0.5)';
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 66, 44, PALETTE.text, 'center', 'bold ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 118 + i * lineHeight, 19, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 20, PALETTE.petal, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, opts, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state, time);
    drawPatrolPaths(state);
    drawPetals(state, time);
    drawExit(state, time);
    drawLanternLight(state, time);
    drawCones(state);
    drawPebbles(state);
    drawGuards(state, time);
    drawPlayer(state, time);
    drawFireflies(state, time);
    drawLighting(state);
    drawHud(state, screen, best, opts || {});
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(4,8,7,0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      const lines = [
        'Wren the thief has one night to steal back the Moonpetals',
        'from Master Bramble\u2019s glasshouse — and slip out unseen.',
        'Stay out of the lantern light. Hide in the bushes.',
        'Sneak with Shift, toss a pebble with Space or a click.',
        best > 0 ? bestLabel(best) : 'Three wings. Five gardeners at most. No second chances.',
      ];
      drawPanel('VERDANT', lines, 'Press Enter or click to begin', 'rgba(125,249,232,0.6)');
      text('STEALTH IN THE MOONLIT GLASSHOUSE', FIELD.width / 2, (FIELD.height - 150 - lines.length * 30 - 64) / 2 + 96, 15, PALETTE.petal, 'center');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The gardeners wait. The moon does not.'], 'Press P to keep sneaking');
    } else if (screen === SCREEN_CLEAR) {
      const lines = [
        `${state.levelName} cleared.`,
        `Time bonus + ghost bonus: ${state.levelBonus} points.`,
        `Score: ${state.score}.`,
      ];
      drawPanel('Wing Cleared', lines, 'Press Enter for the next wing');
    } else if (screen === SCREEN_CAUGHT) {
      const lines = [
        'A gardener caught you in the lantern light.',
        state.lives > 0 ? `${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left — back to the start of the wing.` : '',
      ];
      drawPanel('Spotted!', lines, 'Hold still…');
    } else if (screen === SCREEN_OVER) {
      const lines = [
        'The gardeners caught Wren one time too many.',
        finalLabel(state.score),
        bestLabel(best),
      ];
      drawPanel('Caught in the Glasshouse', lines, 'Press Enter to try again');
    } else if (screen === SCREEN_WIN) {
      const lines = [
        'Every Moonpetal is back where it belongs — with Wren.',
        `Final score: ${state.score}.`,
        bestLabel(best),
      ];
      drawPanel('The Glasshouse is Yours', lines, 'Press Enter to play again');
    }
    if (opts && opts.help && screen === SCREEN_PLAY) {
      const lines = [
        'WASD / arrows — move.  Shift — sneak (slow, quiet, hard to spot).',
        'Space or left-click — toss a pebble: gardeners come to look.',
        'Lantern cones are sight: bushes hide you, crates and statues block it.',
        'Running is loud — gardeners hear it and come to look.',
        'Steal every Moonpetal, then reach the glowing gate.',
        'P — pause.  M — mute.  R — restart the wing.',
      ];
      drawPanel('How to sneak', lines, 'Press H to close');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
