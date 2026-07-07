// Procedural pixel art generator
// Same seed = same image, always. Seed is based on the date.

export type PixelArt = {
  pixels: string[];   // flat array of 4096 hex colors, row-major
  theme: string;      // "landscape" | "animal" | "space" | "geometric"
  label: string;      // human readable hint shown after full reveal
};

// Seeded random number generator (mulberry32)
function createRng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert date string to numeric seed
function dateSeed(dateStr: string): number {
  return dateStr.split('-').reduce((acc, part) => acc * 1000 + parseInt(part), 0);
}

function hexColor(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');
}

// ── Theme generators ──────────────────────────────────────

function generateLandscape(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);
  const horizonRow = 28 + Math.floor(rng() * 8); // 28-35

  // Sky gradient
  const skyTop = { r: 20 + rng() * 40, g: 40 + rng() * 60, b: 120 + rng() * 80 };
  const skyBot = { r: 80 + rng() * 60, g: 120 + rng() * 60, b: 160 + rng() * 60 };

  // Ground colors
  const groundDark = { r: 20 + rng() * 30, g: 60 + rng() * 40, b: 20 + rng() * 20 };
  const groundLight = { r: 40 + rng() * 40, g: 100 + rng() * 50, b: 30 + rng() * 30 };

  // Sun position
  const sunCol = 8 + Math.floor(rng() * 48);
  const sunRow = 6 + Math.floor(rng() * 12);
  const sunColor = hexColor(255, 220 + rng() * 35, 50 + rng() * 80);

  // Mountain peaks
  const peaks: number[] = [];
  for (let i = 0; i < 5; i++) {
    peaks.push(Math.floor(rng() * 64));
  }
  const mountainHeight = 8 + rng() * 10;

  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const idx = row * 64 + col;

      // Sun
      const distSun = Math.sqrt((row - sunRow) ** 2 + (col - sunCol) ** 2);
      if (distSun < 5) {
        pixels[idx] = sunColor;
        continue;
      }

      if (row < horizonRow) {
        // Sky
        const t = row / horizonRow;
        pixels[idx] = hexColor(
          skyTop.r + (skyBot.r - skyTop.r) * t,
          skyTop.g + (skyBot.g - skyTop.g) * t,
          skyTop.b + (skyBot.b - skyTop.b) * t
        );

        // Mountains
        const peakDist = Math.min(...peaks.map(p => Math.abs(col - p)));
        const mountainTop = horizonRow - mountainHeight + peakDist * 0.4;
        if (row > mountainTop) {
          pixels[idx] = hexColor(50 + rng() * 20, 70 + rng() * 20, 90 + rng() * 20);
        }
      } else {
        // Ground
        const t = (row - horizonRow) / (64 - horizonRow);
        const noise = rng() * 15;
        pixels[idx] = hexColor(
          groundDark.r + (groundLight.r - groundDark.r) * t + noise,
          groundDark.g + (groundLight.g - groundDark.g) * t + noise,
          groundDark.b + (groundLight.b - groundDark.b) * t + noise
        );
      }
    }
  }
  return pixels;
}

function generateSpace(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64).fill('#050510');

  // Stars
  for (let i = 0; i < 200; i++) {
    const row = Math.floor(rng() * 64);
    const col = Math.floor(rng() * 64);
    const brightness = 150 + Math.floor(rng() * 105);
    pixels[row * 64 + col] = hexColor(brightness, brightness, brightness);
  }

  // Planet
  const planetRow = 20 + Math.floor(rng() * 24);
  const planetCol = 20 + Math.floor(rng() * 24);
  const planetR = 8 + Math.floor(rng() * 8);
  const pr = Math.floor(rng() * 200);
  const pg = Math.floor(rng() * 150);
  const pb = Math.floor(rng() * 255);

  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const dist = Math.sqrt((row - planetRow) ** 2 + (col - planetCol) ** 2);
      if (dist < planetR) {
        const t = dist / planetR;
        pixels[row * 64 + col] = hexColor(
          pr * (1 - t * 0.5),
          pg * (1 - t * 0.3),
          pb * (1 - t * 0.4)
        );
      }
      // Ring
      if (dist > planetR + 2 && dist < planetR + 5 && Math.abs(row - planetRow) < 3) {
        pixels[row * 64 + col] = hexColor(pr * 0.8, pg * 0.8, pb * 0.6);
      }
    }
  }

  // Nebula cloud
  const nebRow = Math.floor(rng() * 40);
  const nebCol = Math.floor(rng() * 40);
  const nr = Math.floor(rng() * 255);
  const ng = Math.floor(rng() * 100);
  const nb = Math.floor(rng() * 255);
  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const dist = Math.sqrt((row - nebRow) ** 2 + (col - nebCol) ** 2);
      if (dist < 15 && rng() > 0.6) {
        const alpha = (1 - dist / 15) * 0.4;
        const idx = row * 64 + col;
        pixels[idx] = hexColor(nr * alpha + 5, ng * alpha + 5, nb * alpha + 10);
      }
    }
  }

  return pixels;
}

function generateGeometric(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);
  const cx = 32, cy = 32;

  // Color palette
  const hue1 = rng() * 360;
  const hue2 = (hue1 + 120 + rng() * 60) % 360;
  const hue3 = (hue1 + 240 + rng() * 60) % 360;

  function hslToHex(h: number, s: number, l: number): string {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return hexColor(r * 255, g * 255, b * 255);
  }

  const pattern = Math.floor(rng() * 3);

  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const dx = col - cx, dy = row - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const idx = row * 64 + col;

      if (pattern === 0) {
        // Concentric rings
        const ring = Math.floor(dist / 4) % 3;
        const colors = [hslToHex(hue1, 70, 50), hslToHex(hue2, 70, 50), hslToHex(hue3, 70, 50)];
        pixels[idx] = colors[ring];
      } else if (pattern === 1) {
        // Spiral
        const spiral = (dist + angle * 3) % 12;
        pixels[idx] = spiral < 6
          ? hslToHex(hue1, 80, 40 + dist * 0.3)
          : hslToHex(hue2, 80, 40 + dist * 0.3);
      } else {
        // Mandala petals
        const petals = 8;
        const petal = Math.abs(Math.sin(angle * petals / 2 + dist * 0.2));
        pixels[idx] = petal > 0.5
          ? hslToHex(hue1, 90, 30 + petal * 40)
          : hslToHex(hue3, 70, 20 + petal * 30);
      }
    }
  }
  return pixels;
}

function generateAnimal(rng: () => number): string[] {
  // Simple pixel art animal — owl face (symmetric, recognizable at 64x64)
  const pixels: string[] = new Array(64 * 64);
  const bg = hexColor(20 + rng() * 20, 30 + rng() * 20, 50 + rng() * 20);
  pixels.fill(bg);

  const bodyColor = hexColor(80 + rng() * 60, 60 + rng() * 40, 20 + rng() * 30);
  const eyeWhite = '#f0f0f0';
  const eyePupil = '#111111';
  const beakColor = hexColor(200 + rng() * 55, 150 + rng() * 50, 0);

  // Body (symmetric oval)
  const bRow = 32, bCol = 32, bRw = 18, bRh = 22;
  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const dx = (col - bCol) / bRw;
      const dy = (row - bRow) / bRh;
      if (dx * dx + dy * dy < 1) {
        pixels[row * 64 + col] = bodyColor;
      }
    }
  }

  // Eyes
  const eyePositions = [[26, 24], [26, 40]];
  for (const [er, ec] of eyePositions) {
    for (let row = 0; row < 64; row++) {
      for (let col = 0; col < 64; col++) {
        const dist = Math.sqrt((row - er) ** 2 + (col - ec) ** 2);
        if (dist < 7) pixels[row * 64 + col] = eyeWhite;
        if (dist < 4) pixels[row * 64 + col] = hexColor(
          50 + rng() * 100, 100 + rng() * 100, 20 + rng() * 80
        );
        if (dist < 2) pixels[row * 64 + col] = eyePupil;
      }
    }
  }

  // Beak
  for (let row = 30; row < 36; row++) {
    for (let col = 29; col < 36; col++) {
      const dy = row - 30, dx = Math.abs(col - 32);
      if (dx + dy < 5) pixels[row * 64 + col] = beakColor;
    }
  }

  // Ears (tufts)
  for (let i = 0; i < 6; i++) {
    pixels[(14 + i) * 64 + (22 - i)] = bodyColor;
    pixels[(14 + i) * 64 + (42 + i)] = bodyColor;
  }

  return pixels;
}

// ── Main export ───────────────────────────────────────────

const THEMES = ['landscape', 'space', 'geometric', 'animal'] as const;
const LABELS: Record<string, string[]> = {
  landscape: ['rolling hills', 'mountain valley', 'sunset plains', 'misty peaks'],
  space:     ['distant galaxy', 'ringed planet', 'nebula storm', 'cosmic void'],
  geometric: ['mandala bloom', 'spiral vortex', 'concentric rings', 'petal fractal'],
  animal:    ['wise owl', 'night owl', 'forest owl', 'moon owl'],
};

export function generateDailyArt(dateStr: string): PixelArt {
  const seed = dateSeed(dateStr);
  const rng = createRng(seed);

  const themeIndex = Math.floor(rng() * THEMES.length);
  const theme = THEMES[themeIndex];

  let pixels: string[];
  if (theme === 'landscape') pixels = generateLandscape(rng);
  else if (theme === 'space') pixels = generateSpace(rng);
  else if (theme === 'geometric') pixels = generateGeometric(rng);
  else pixels = generateAnimal(rng);

  const labels = LABELS[theme];
  const label = labels[Math.floor(rng() * labels.length)];

  return { pixels, theme, label };
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}