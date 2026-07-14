import { context, requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button') as HTMLButtonElement;
const usernameEl = document.getElementById('title') as HTMLParagraphElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

if (context.username) {
  usernameEl.textContent = `welcome back, ${context.username}`;
}

// ── Animated preview canvas ───────────────────────────────
const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const COLS = 16;
const ROWS = 16;
const CELL = 10;

// Mini pixel art — a simple sunset landscape
const palette = [
  '#1a1a2e', '#16213e', '#0f3460',
  '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#1abc9c', '#3498db',
  '#9b59b6', '#e91e63', '#ff5722',
];

// Generate a mini image seeded by today's date
function miniSeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function mulberry32(seed: number) {
  return function() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(miniSeed());

// Generate mini landscape
const miniPixels: string[] = [];
const horizon = 8 + Math.floor(rng() * 4);
const skyColor1 = `hsl(${200 + rng() * 40}, 60%, ${20 + rng() * 20}%)`;
const skyColor2 = `hsl(${20 + rng() * 30}, 80%, ${50 + rng() * 20}%)`;
const groundColor = `hsl(${120 + rng() * 40}, 40%, ${15 + rng() * 10}%)`;
const sunCol = Math.floor(rng() * COLS);
const sunRow = Math.floor(rng() * (horizon - 2)) + 1;

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const distSun = Math.sqrt((r - sunRow) ** 2 + (c - sunCol) ** 2);
    if (distSun < 2) {
      miniPixels.push('#ffd700');
    } else if (r < horizon) {
      const t = r / horizon;
      miniPixels.push(t < 0.5 ? skyColor1 : skyColor2);
    } else {
      const noise = rng() * 0.1;
      miniPixels.push(r === horizon ? '#2ecc71' : groundColor);
    }
  }
}

// Draw all cells as covered initially
ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, canvas.width, canvas.height);

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
  }
}

// Reveal cells one by one with animation
const order = Array.from({ length: ROWS * COLS }, (_, i) => i);
// Shuffle
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}

let revealed = 0;
const totalCells = ROWS * COLS;

function revealNext() {
  if (revealed >= totalCells) {
    // All revealed — pause then restart
    setTimeout(() => {
      // Cover all again
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
        }
      }
      revealed = 0;
      // Reshuffle
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      setTimeout(revealNext, 300);
    }, 2000);
    return;
  }

  const idx = order[revealed];
  const r = Math.floor(idx / COLS);
  const c = idx % COLS;
  const color = miniPixels[idx];

  // Draw cell with ripple effect
  ctx.fillStyle = color;
  ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);

  // Subtle glow
  ctx.fillStyle = color + '44';
  ctx.fillRect(c * CELL - 1, r * CELL - 1, CELL + 1, CELL + 1);
  setTimeout(() => {
    ctx.fillStyle = color;
    ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
  }, 100);

  revealed++;
  // Speed up as more cells are revealed
  const delay = revealed < 20 ? 80 : revealed < 80 ? 40 : 20;
  setTimeout(revealNext, delay);
}

// Start animation after short delay
setTimeout(revealNext, 500);