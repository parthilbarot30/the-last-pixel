// Procedural pixel art generator
// Same seed = same image, always. Seed is based on the date.

export type PixelArt = {
  pixels: string[];
  theme: string;
  label: string;
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

function dateSeed(dateStr: string): number {
  return dateStr.split('-').reduce((acc, part) => acc * 1000 + parseInt(part), 0);
}

function hexColor(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');
}

// ── Existing themes ───────────────────────────────────────

function generateLandscape(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);
  const horizonRow = 28 + Math.floor(rng() * 8);

  const skyTop = { r: 20 + rng() * 40, g: 40 + rng() * 60, b: 120 + rng() * 80 };
  const skyBot = { r: 80 + rng() * 60, g: 120 + rng() * 60, b: 160 + rng() * 60 };
  const groundDark = { r: 20 + rng() * 30, g: 60 + rng() * 40, b: 20 + rng() * 20 };
  const groundLight = { r: 40 + rng() * 40, g: 100 + rng() * 50, b: 30 + rng() * 30 };

  const sunCol = 8 + Math.floor(rng() * 48);
  const sunRow = 6 + Math.floor(rng() * 12);
  const sunColor = hexColor(255, 220 + rng() * 35, 50 + rng() * 80);

  const peaks: number[] = [];
  for (let i = 0; i < 5; i++) peaks.push(Math.floor(rng() * 64));
  const mountainHeight = 8 + rng() * 10;

  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const idx = row * 64 + col;
      const distSun = Math.sqrt((row - sunRow) ** 2 + (col - sunCol) ** 2);
      if (distSun < 5) { pixels[idx] = sunColor; continue; }

      if (row < horizonRow) {
        const t = row / horizonRow;
        pixels[idx] = hexColor(
          skyTop.r + (skyBot.r - skyTop.r) * t,
          skyTop.g + (skyBot.g - skyTop.g) * t,
          skyTop.b + (skyBot.b - skyTop.b) * t
        );
        const peakDist = Math.min(...peaks.map(p => Math.abs(col - p)));
        const mountainTop = horizonRow - mountainHeight + peakDist * 0.4;
        if (row > mountainTop) {
          pixels[idx] = hexColor(50 + rng() * 20, 70 + rng() * 20, 90 + rng() * 20);
        }
      } else {
        const t = (row - horizonRow) / (64 - horizonRow);
        const n = rng() * 15;
        pixels[idx] = hexColor(
          groundDark.r + (groundLight.r - groundDark.r) * t + n,
          groundDark.g + (groundLight.g - groundDark.g) * t + n,
          groundDark.b + (groundLight.b - groundDark.b) * t + n
        );
      }
    }
  }
  return pixels;
}

function generateSpace(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64).fill('#050510');

  for (let i = 0; i < 200; i++) {
    const row = Math.floor(rng() * 64);
    const col = Math.floor(rng() * 64);
    const brightness = 150 + Math.floor(rng() * 105);
    pixels[row * 64 + col] = hexColor(brightness, brightness, brightness);
  }

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
        pixels[row * 64 + col] = hexColor(pr * (1 - t * 0.5), pg * (1 - t * 0.3), pb * (1 - t * 0.4));
      }
      if (dist > planetR + 2 && dist < planetR + 5 && Math.abs(row - planetRow) < 3) {
        pixels[row * 64 + col] = hexColor(pr * 0.8, pg * 0.8, pb * 0.6);
      }
    }
  }

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
        pixels[row * 64 + col] = hexColor(nr * alpha + 5, ng * alpha + 5, nb * alpha + 10);
      }
    }
  }
  return pixels;
}

function generateGeometric(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);
  const cx = 32, cy = 32;
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
        const ring = Math.floor(dist / 4) % 3;
        const colors = [hslToHex(hue1, 70, 50), hslToHex(hue2, 70, 50), hslToHex(hue3, 70, 50)];
        pixels[idx] = colors[ring];
      } else if (pattern === 1) {
        const spiral = (dist + angle * 3) % 12;
        pixels[idx] = spiral < 6 ? hslToHex(hue1, 80, 40 + dist * 0.3) : hslToHex(hue2, 80, 40 + dist * 0.3);
      } else {
        const petals = 8;
        const petal = Math.abs(Math.sin(angle * petals / 2 + dist * 0.2));
        pixels[idx] = petal > 0.5 ? hslToHex(hue1, 90, 30 + petal * 40) : hslToHex(hue3, 70, 20 + petal * 30);
      }
    }
  }
  return pixels;
}

function generateAnimal(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);
  const bg = hexColor(20 + rng() * 20, 30 + rng() * 20, 50 + rng() * 20);
  pixels.fill(bg);

  const bodyColor = hexColor(80 + rng() * 60, 60 + rng() * 40, 20 + rng() * 30);
  const beakColor = hexColor(200 + rng() * 55, 150 + rng() * 50, 0);

  const bRow = 32, bCol = 32, bRw = 18, bRh = 22;
  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const dx = (col - bCol) / bRw;
      const dy = (row - bRow) / bRh;
      if (dx * dx + dy * dy < 1) pixels[row * 64 + col] = bodyColor;
    }
  }

  const eyePositions = [[26, 24], [26, 40]];
  for (const [er, ec] of eyePositions) {
    for (let row = 0; row < 64; row++) {
      for (let col = 0; col < 64; col++) {
        const dist = Math.sqrt((row - er) ** 2 + (col - ec) ** 2);
        if (dist < 7) pixels[row * 64 + col] = '#f0f0f0';
        if (dist < 4) pixels[row * 64 + col] = hexColor(50 + rng() * 100, 100 + rng() * 100, 20 + rng() * 80);
        if (dist < 2) pixels[row * 64 + col] = '#111111';
      }
    }
  }

  for (let row = 30; row < 36; row++) {
    for (let col = 29; col < 36; col++) {
      const dy = row - 30, dx = Math.abs(col - 32);
      if (dx + dy < 5) pixels[row * 64 + col] = beakColor;
    }
  }

  for (let i = 0; i < 6; i++) {
    pixels[(14 + i) * 64 + (22 - i)] = bodyColor;
    pixels[(14 + i) * 64 + (42 + i)] = bodyColor;
  }
  return pixels;
}

// ── NEW HARDER THEMES ─────────────────────────────────────

function generateCityscape(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);

  // Night sky gradient
  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const t = row / 64;
      pixels[row * 64 + col] = hexColor(5 + t * 15, 5 + t * 10, 20 + t * 30);
    }
  }

  // Stars
  for (let i = 0; i < 80; i++) {
    const r = Math.floor(rng() * 30);
    const c = Math.floor(rng() * 64);
    const b = 150 + Math.floor(rng() * 105);
    pixels[r * 64 + c] = hexColor(b, b, b);
  }

  // Moon
  const moonCol = 8 + Math.floor(rng() * 48);
  const moonRow = 5 + Math.floor(rng() * 12);
  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const dist = Math.sqrt((row - moonRow) ** 2 + (col - moonCol) ** 2);
      if (dist < 4) pixels[row * 64 + col] = hexColor(220, 220, 180);
    }
  }

  // Buildings — irregular widths and heights
  const numBuildings = 8 + Math.floor(rng() * 6);
  const groundLine = 50;

  for (let b = 0; b < numBuildings; b++) {
    const bLeft = Math.floor(rng() * 56);
    const bWidth = 4 + Math.floor(rng() * 8);
    const bHeight = 10 + Math.floor(rng() * 30);
    const bTop = groundLine - bHeight;
    const bR = Math.floor(rng() * 60);
    const bG = Math.floor(rng() * 60);
    const bB = 60 + Math.floor(rng() * 80);

    for (let row = bTop; row < groundLine; row++) {
      for (let col = bLeft; col < Math.min(bLeft + bWidth, 64); col++) {
        if (row < 0 || row >= 64) continue;
        pixels[row * 64 + col] = hexColor(bR, bG, bB);
      }
    }

    // Windows — random lit/unlit
    for (let wr = bTop + 2; wr < groundLine - 2; wr += 3) {
      for (let wc = bLeft + 1; wc < bLeft + bWidth - 1; wc += 2) {
        if (wc >= 64) continue;
        if (rng() > 0.4) {
          pixels[wr * 64 + wc] = hexColor(
            200 + rng() * 55,
            180 + rng() * 55,
            100 + rng() * 80
          );
        }
      }
    }
  }

  // Ground/road
  for (let col = 0; col < 64; col++) {
    pixels[groundLine * 64 + col] = hexColor(30, 30, 35);
    if (groundLine + 1 < 64) pixels[(groundLine + 1) * 64 + col] = hexColor(25, 25, 30);
  }

  // Reflections in road
  for (let col = 0; col < 64; col++) {
    for (let row = groundLine + 2; row < Math.min(groundLine + 8, 64); row++) {
      if (rng() > 0.85) {
        const b2 = 80 + Math.floor(rng() * 120);
        pixels[row * 64 + col] = hexColor(b2 * 0.3, b2 * 0.3, b2 * 0.6);
      }
    }
  }

  return pixels;
}

function generateUnderwaterScene(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);

  // Water gradient — dark blue-green
  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const t = row / 64;
      const waviness = Math.sin(col * 0.3 + row * 0.1) * 5;
      pixels[row * 64 + col] = hexColor(
        0 + t * 20 + waviness,
        40 + t * 30 + waviness,
        80 + t * 40
      );
    }
  }

  // Light rays from surface
  const numRays = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < numRays; i++) {
    const rayCol = Math.floor(rng() * 64);
    const rayWidth = 2 + Math.floor(rng() * 4);
    for (let row = 0; row < 40; row++) {
      const spread = Math.floor(row * 0.15);
      for (let dc = -rayWidth - spread; dc <= rayWidth + spread; dc++) {
        const col = rayCol + dc;
        if (col < 0 || col >= 64) continue;
        const alpha = Math.max(0, 1 - Math.abs(dc) / (rayWidth + spread + 1));
        const idx = row * 64 + col;
        const existing = pixels[idx];
        const er = parseInt(existing.slice(1, 3), 16);
        const eg = parseInt(existing.slice(3, 5), 16);
        const eb = parseInt(existing.slice(5, 7), 16);
        pixels[idx] = hexColor(
          er + alpha * 30,
          eg + alpha * 40,
          eb + alpha * 20
        );
      }
    }
  }

  // Sandy floor
  for (let row = 54; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const n = rng() * 20;
      pixels[row * 64 + col] = hexColor(180 + n, 160 + n, 100 + n);
    }
  }

  // Coral
  const numCoral = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < numCoral; i++) {
    const cCol = Math.floor(rng() * 60) + 2;
    const cHeight = 5 + Math.floor(rng() * 12);
    const cR = 150 + Math.floor(rng() * 105);
    const cG = Math.floor(rng() * 100);
    const cB = Math.floor(rng() * 100);
    for (let row = 54 - cHeight; row < 54; row++) {
      const spread = Math.floor((54 - row) * 0.3);
      for (let dc = -spread; dc <= spread; dc++) {
        const col = cCol + dc;
        if (col < 0 || col >= 64) continue;
        if (rng() > 0.3) pixels[row * 64 + col] = hexColor(cR, cG, cB);
      }
    }
  }

  // Fish — small colored blobs
  const numFish = 5 + Math.floor(rng() * 8);
  for (let i = 0; i < numFish; i++) {
    const fRow = 5 + Math.floor(rng() * 45);
    const fCol = Math.floor(rng() * 60);
    const fR = Math.floor(rng() * 255);
    const fG = Math.floor(rng() * 255);
    const fB = Math.floor(rng() * 100);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        const row = fRow + dr;
        const col = fCol + dc;
        if (row < 0 || row >= 64 || col < 0 || col >= 64) continue;
        if (Math.abs(dr) + Math.abs(dc) * 0.6 < 2.5) {
          pixels[row * 64 + col] = hexColor(fR, fG, fB);
        }
      }
    }
    // Tail
    if (fCol + 4 < 64) pixels[fRow * 64 + fCol + 4] = hexColor(fR, fG, fB);
  }

  // Bubbles
  for (let i = 0; i < 20; i++) {
    const bRow = Math.floor(rng() * 50);
    const bCol = Math.floor(rng() * 64);
    if (bRow >= 0 && bRow < 64 && bCol >= 0 && bCol < 64) {
      pixels[bRow * 64 + bCol] = hexColor(150, 200, 230);
    }
  }

  return pixels;
}

function generateForest(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);

  // Sky — could be dawn, day, or dusk
  const timeOfDay = Math.floor(rng() * 3);
  const skyR = timeOfDay === 0 ? 200 + rng() * 55 : timeOfDay === 1 ? 100 + rng() * 50 : 20 + rng() * 30;
  const skyG = timeOfDay === 0 ? 100 + rng() * 80 : timeOfDay === 1 ? 150 + rng() * 50 : 20 + rng() * 30;
  const skyB = timeOfDay === 0 ? 50 + rng() * 50 : timeOfDay === 1 ? 200 + rng() * 55 : 60 + rng() * 60;

  for (let row = 0; row < 30; row++) {
    for (let col = 0; col < 64; col++) {
      const t = row / 30;
      pixels[row * 64 + col] = hexColor(skyR * (1 - t * 0.3), skyG * (1 - t * 0.2), skyB * (1 - t * 0.1));
    }
  }

  // Ground
  for (let row = 54; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const n = rng() * 15;
      pixels[row * 64 + col] = hexColor(20 + n, 50 + n, 15 + n);
    }
  }

  // Trees — layers from back to front
  const numTrees = 10 + Math.floor(rng() * 10);
  for (let i = 0; i < numTrees; i++) {
    const tCol = Math.floor(rng() * 64);
    const tHeight = 20 + Math.floor(rng() * 25);
    const tBase = 54;
    const tTop = tBase - tHeight;
    const layer = i / numTrees; // 0 = back, 1 = front

    // Trunk
    const trunkW = 1 + Math.floor(layer * 2);
    const trunkColor = hexColor(60 + layer * 30, 35 + layer * 15, 15 + layer * 10);
    for (let row = tBase - 8; row < tBase; row++) {
      for (let dc = -trunkW; dc <= trunkW; dc++) {
        const col = tCol + dc;
        if (col < 0 || col >= 64 || row < 0) continue;
        pixels[row * 64 + col] = trunkColor;
      }
    }

    // Foliage — triangle shape
    const leafR = Math.floor(20 + rng() * 60 + layer * 40);
    const leafG = Math.floor(60 + rng() * 80 + layer * 20);
    const leafB = Math.floor(10 + rng() * 30);
    for (let row = tTop; row < tBase - 6; row++) {
      const spread = Math.floor((row - tTop) * 0.4) + 1;
      for (let dc = -spread; dc <= spread; dc++) {
        const col = tCol + dc;
        if (col < 0 || col >= 64 || row < 0) continue;
        if (rng() > 0.2) {
          pixels[row * 64 + col] = hexColor(
            leafR + rng() * 20 - 10,
            leafG + rng() * 20 - 10,
            leafB
          );
        }
      }
    }
  }

  // Foreground grass
  for (let col = 0; col < 64; col++) {
    const grassH = 2 + Math.floor(rng() * 4);
    for (let row = 54 - grassH; row < 54; row++) {
      if (rng() > 0.5) {
        pixels[row * 64 + col] = hexColor(30 + rng() * 40, 80 + rng() * 60, 20 + rng() * 20);
      }
    }
  }

  return pixels;
}

function generateFace(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);

  // Background
  const bgR = 20 + rng() * 40;
  const bgG = 20 + rng() * 40;
  const bgB = 30 + rng() * 60;
  pixels.fill(hexColor(bgR, bgG, bgB));

  const cx = 32, cy = 32;

  // Skin tone
  const skinR = 180 + rng() * 60;
  const skinG = 120 + rng() * 60;
  const skinB = 80 + rng() * 40;

  // Head shape
  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const dx = (col - cx) / 16;
      const dy = (row - cy) / 20;
      if (dx * dx + dy * dy < 1) {
        pixels[row * 64 + col] = hexColor(
          skinR + rng() * 10 - 5,
          skinG + rng() * 10 - 5,
          skinB + rng() * 10 - 5
        );
      }
    }
  }

  // Hair
  const hairR = Math.floor(rng() * 120);
  const hairG = Math.floor(rng() * 80);
  const hairB = Math.floor(rng() * 60);
  for (let row = 10; row < 26; row++) {
    for (let col = 0; col < 64; col++) {
      const dx = (col - cx) / 16;
      const dy = (row - cy) / 20;
      if (dx * dx + dy * dy < 1.1 && row < cy - 6) {
        pixels[row * 64 + col] = hexColor(hairR + rng() * 20, hairG + rng() * 15, hairB + rng() * 10);
      }
    }
  }

  // Eyes
  const eyeY = cy - 4;
  const eyeOffsets = [-7, 7];
  for (const ex of eyeOffsets) {
    for (let row = 0; row < 64; row++) {
      for (let col = 0; col < 64; col++) {
        const dist = Math.sqrt((row - eyeY) ** 2 + (col - (cx + ex)) ** 2);
        if (dist < 4) pixels[row * 64 + col] = '#ffffff';
        if (dist < 2.5) pixels[row * 64 + col] = hexColor(
          Math.floor(rng() * 100),
          Math.floor(rng() * 150),
          Math.floor(rng() * 200)
        );
        if (dist < 1.2) pixels[row * 64 + col] = '#111111';
      }
    }
  }

  // Nose
  for (let row = cy; row < cy + 5; row++) {
    if (row >= 64) continue;
    pixels[row * 64 + cx] = hexColor(skinR - 30, skinG - 20, skinB - 15);
    if (cx - 2 >= 0) pixels[row * 64 + (cx - 2)] = hexColor(skinR - 20, skinG - 15, skinB - 10);
    if (cx + 2 < 64) pixels[row * 64 + (cx + 2)] = hexColor(skinR - 20, skinG - 15, skinB - 10);
  }

  // Mouth
  const mouthY = cy + 8;
  const smileType = rng() > 0.5 ? 1 : -1; // smile or neutral
  for (let dc = -6; dc <= 6; dc++) {
    const col = cx + dc;
    const row = mouthY + Math.floor(smileType * (dc * dc) * 0.08);
    if (row >= 0 && row < 64 && col >= 0 && col < 64) {
      pixels[row * 64 + col] = hexColor(150, 60, 60);
      if (row + 1 < 64) pixels[(row + 1) * 64 + col] = hexColor(200, 100, 100);
    }
  }

  return pixels;
}

function generateAbstractWaves(rng: () => number): string[] {
  const pixels: string[] = new Array(64 * 64);

  // Two dominant colors
  const r1 = Math.floor(rng() * 255);
  const g1 = Math.floor(rng() * 255);
  const b1 = Math.floor(rng() * 255);
  const r2 = Math.floor(rng() * 255);
  const g2 = Math.floor(rng() * 255);
  const b2 = Math.floor(rng() * 255);

  const freq1 = 0.1 + rng() * 0.3;
  const freq2 = 0.05 + rng() * 0.2;
  const freq3 = 0.15 + rng() * 0.25;
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;

  for (let row = 0; row < 64; row++) {
    for (let col = 0; col < 64; col++) {
      const w1 = Math.sin(col * freq1 + row * freq2 + phase1);
      const w2 = Math.cos(col * freq2 + row * freq3 + phase2);
      const w3 = Math.sin((col + row) * freq1 * 0.7 + phase1 * 0.5);
      const t = (w1 + w2 + w3) / 3 * 0.5 + 0.5;

      pixels[row * 64 + col] = hexColor(
        r1 * t + r2 * (1 - t),
        g1 * t + g2 * (1 - t),
        b1 * t + b2 * (1 - t)
      );
    }
  }

  return pixels;
}

// ── Main export ───────────────────────────────────────────

const THEMES = [
  'landscape', 'space', 'geometric', 'animal',
  'cityscape', 'underwater', 'forest', 'face', 'waves'
] as const;

const LABELS: Record<string, string[]> = {
  landscape:  ['rolling hills', 'mountain valley', 'sunset plains', 'misty peaks'],
  space:      ['distant galaxy', 'ringed planet', 'nebula storm', 'cosmic void'],
  geometric:  ['mandala bloom', 'spiral vortex', 'concentric rings', 'petal fractal'],
  animal:     ['wise owl', 'night owl', 'forest owl', 'moon owl'],
  cityscape:  ['city at night', 'urban skyline', 'downtown lights', 'night city'],
  underwater: ['coral reef', 'deep sea', 'ocean floor', 'underwater world'],
  forest:     ['dense forest', 'woodland', 'tree line', 'forest path'],
  face:       ['portrait', 'human face', 'close-up', 'someone watching'],
  waves:      ['abstract waves', 'flowing colors', 'liquid art', 'color tide'],
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
  else if (theme === 'animal') pixels = generateAnimal(rng);
  else if (theme === 'cityscape') pixels = generateCityscape(rng);
  else if (theme === 'underwater') pixels = generateUnderwaterScene(rng);
  else if (theme === 'forest') pixels = generateForest(rng);
  else if (theme === 'face') pixels = generateFace(rng);
  else pixels = generateAbstractWaves(rng);

  const labels = LABELS[theme];
  const label = labels[Math.floor(rng() * labels.length)];

  return { pixels, theme, label };
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}