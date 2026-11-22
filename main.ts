// VERDANT — Stealth in the Moonlit Glasshouse: a make.fun program/v1 entry
// (Node 22, standard library only). The game is this directory's game/
// folder, plain static files a desktop browser loads offline (game/index.html
// and its ES modules, no library and no network request), and the program
// hands it in: it copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with
// the vendored make.fun library.
//
// The game: Wren the thief has one night to steal the Moonpetals back from
// Master Bramble's glasshouse. Three wings, gardeners with lantern vision
// cones, bushes to hide in, pebbles to throw, a gate to reach unseen.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Leave every output readable by every user: the grader collects /output as another user. */
function makeReadable(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      // Best-effort: an entry this process did not create may belong to
      // someone else (see the note at the chmodSync(out) call below).
      try { chmodSync(path, 0o755); } catch { /* not ours to chmod */ }
      makeReadable(path);
    } else {
      try { chmodSync(path, 0o644); } catch { /* not ours to chmod */ }
    }
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Best-effort: the grader mounts /output writable but owned by someone else
// (root), so chmod on the directory itself fails with EPERM when the program
// runs as uid 65534 — and an uncaught chmod throws the whole run (exit 1).
// The files the program just wrote are owned by this process and already
// world-readable, so skipping a refused chmod loses nothing.
try { chmodSync(out, 0o755); } catch { /* not ours to chmod */ }
makeReadable(out);
