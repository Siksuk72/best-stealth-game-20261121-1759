// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between seven screens:
// title, play, paused, wing cleared, caught, game over and victory.
//
// ?seed=N fixes the gardeners' whims. ?shot=title|patrol|alarm|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_GAME_OVER, EVENT_LEVEL_CLEAR, EVENT_PEBBLE_LAND, EVENT_PETAL, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_HELP, ACTION_MUTE, ACTION_PAUSE, ACTION_PEBBLE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds the "Spotted!" panel shows before Wren tries the wing again. */
const CAUGHT_PAUSE = 1.8;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0, { muted: false }, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__shotInfo = scene.info;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let help = false;
  let scoreAtLevelStart = 0;
  let caughtTimer = 0;
  let accumulator = 0;
  let last = performance.now();
  let stepTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each catch.
  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    world.reset();
    scoreAtLevelStart = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.levelName}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PETAL) audio.petal();
    if (events & EVENT_PEBBLE_LAND) audio.pebbleLand();
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_ALARM) audio.alarm();
    if (events & EVENT_CAUGHT) {
      audio.caught();
      caughtTimer = CAUGHT_PAUSE;
      screen = SCREEN_CAUGHT;
      announce(`Spotted! ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
    }
    if (events & EVENT_LEVEL_CLEAR) {
      audio.clear();
      screen = SCREEN_CLEAR;
      announce(`${world.state.levelName} cleared. Score ${world.state.score}.`);
    }
    if (events & EVENT_WIN) {
      audio.win();
      screen = SCREEN_WIN;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`You win! Final score ${world.state.score}.`);
    }
    if (events & EVENT_GAME_OVER) {
      screen = SCREEN_OVER;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Caught. Game over. Score ${world.state.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
    }
    if (actions & ACTION_HELP && screen === SCREEN_PLAY) {
      help = !help;
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      world.loadLevel(world.state.levelIndex);
      world.state.score = scoreAtLevelStart;
      screen = SCREEN_PLAY;
      help = false;
      announce(`Restarted ${world.state.levelName}.`);
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startRun();
      }
      return;
    }
    if (screen === SCREEN_CLEAR) {
      if (actions & ACTION_CONFIRM) {
        scoreAtLevelStart = world.state.score;
        world.advanceLevel();
        screen = SCREEN_PLAY;
        announce(`Playing. ${world.state.levelName}.`);
      }
      return;
    }
    if (screen === SCREEN_CAUGHT) return;
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_PEBBLE) {
      audio.unlock();
      const angle = world.state.player.angle;
      const thrown = world.throwPebble(
        world.state.player.x + Math.cos(angle) * 200,
        world.state.player.y + Math.sin(angle) * 200,
      );
      if (thrown) audio.pebble();
      return;
    }
    if (click) {
      audio.unlock();
      const thrown = world.throwPebble(click.x, click.y);
      if (thrown) audio.pebble();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0 }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const vector = input.vector();
    const events = world.step(STEP, vector);
    handleEvents(events);
    if (world.state.player.moving) {
      stepTimer -= STEP;
      if (stepTimer <= 0) {
        stepTimer = world.state.player.sneaking ? 0.55 : 0.38;
        audio.step();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    handleActions();
    if (screen === SCREEN_CAUGHT) {
      caughtTimer -= dt;
      if (caughtTimer <= 0) {
        if (world.state.lives <= 0) {
          screen = SCREEN_OVER;
        } else {
          world.respawnAfterCaught();
          screen = SCREEN_PLAY;
          announce('Back to the start of the wing. Stay out of the light.');
        }
      }
    }
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, best, { muted, help }, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting gardeners patrol unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Verdant. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
