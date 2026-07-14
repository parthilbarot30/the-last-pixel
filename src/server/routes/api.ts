import { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import { generateDailyArt, todayDateStr } from './pixelart';

const LAST_RESET_KEY = 'last_reset_date';

async function resetIfNewDay() {
  const today = todayDateStr();
  const lastReset = await redis.get(LAST_RESET_KEY);
  if (lastReset === today) return; // already reset today

  // New day — wipe the board
  const raw = await redis.get(REVEALED_INDEX);
  const index: string[] = raw ? JSON.parse(raw) : [];

  for (const entry of index) {
    const [r, c] = entry.split(':').map(Number);
    await redis.del(cellKey(r, c));
  }

  await redis.del(REVEALED_INDEX);
  await redis.del(GUESSES_KEY);
  await redis.set(LAST_RESET_KEY, today);
  console.log(`Board reset for ${today}. Cleared ${index.length} cells.`);
}

type CellData = {
  revealedBy: string;
  color: string;       // actual image color at this position
  revealedAt: number;  // timestamp ms
};

type GuessData = {
  username: string;
  guess: string;
  submittedAt: number;
};

type ErrorResponse = { status: 'error'; message: string };

export const api = new Hono();

// ── Keys ──────────────────────────────────────────────────
const REVEALED_INDEX = 'revealed_index';
const GUESSES_KEY    = 'guesses';

function cellKey(row: number, col: number) {
  return `cell:${row}:${col}`;
}

function userKey(username: string) {
  return `user:${username}`;
}

// ── Index helpers ─────────────────────────────────────────
async function getRevealedIndex(): Promise<string[]> {
  const raw = await redis.get(REVEALED_INDEX);
  return raw ? JSON.parse(raw) : [];
}

async function addToRevealedIndex(row: number, col: number) {
  const index = await getRevealedIndex();
  const entry = `${row}:${col}`;
  if (!index.includes(entry)) {
    index.push(entry);
    await redis.set(REVEALED_INDEX, JSON.stringify(index));
  }
}

async function getGuesses(): Promise<GuessData[]> {
  const raw = await redis.get(GUESSES_KEY);
  return raw ? JSON.parse(raw) : [];
}

// ── GET /api/init ─────────────────────────────────────────
api.get('/init', async (c) => {
  try {
    await resetIfNewDay();
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const today = todayDateStr();

    // Load user state
    const userRaw = await redis.get(userKey(username));
    const userData = userRaw
      ? JSON.parse(userRaw)
      : { lastRevealed: '', hasGuessed: false };

    const hasRevealedToday = userData.lastRevealed === today;
    const hasGuessed = userData.hasGuessed === true && 
                   userData.hasGuessedDate === today;

    // Load revealed cells
    const index = await getRevealedIndex();
    const cells: { row: number; col: number; cell: CellData }[] = [];

    for (const entry of index) {
      const [r, c] = entry.split(':').map(Number);
      const raw = await redis.get(cellKey(r, c));
      if (!raw) continue;
      cells.push({ row: r, col: c, cell: JSON.parse(raw) });
    }

    const revealedCount = cells.length;
    const totalCells = 64 * 64; // 4096
    const revealPercent = (revealedCount / totalCells) * 100;

    // Guessing is open between 20% and 40%
    const guessingOpen = revealPercent >= 20 && revealPercent < 40;

    // Load guesses
    const guesses = await getGuesses();

    // Generate today's art metadata (not sending all pixels — too large)
    const art = generateDailyArt(today);
    
    return c.json({
      username,
      hasRevealedToday,
      hasGuessed,
      cells,
      revealedCount,
      totalCells,
      revealPercent: Math.round(revealPercent * 10) / 10,
      guessingOpen,
      guesses,
      theme: art.theme,
      // Only reveal label after midnight (full reveal)
      label: revealPercent >= 100 ? art.label : null,
    });
  } catch (e) {
    console.error('init error', e);
    return c.json<ErrorResponse>({ status: 'error', message: 'init failed' }, 500);
  }
});

// ── POST /api/reveal ──────────────────────────────────────
api.post('/reveal', async (c) => {
  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const today = todayDateStr();
    const { row, col } = await c.req.json();

    if (row < 0 || row >= 64 || col < 0 || col >= 64) {
      return c.json<ErrorResponse>({ status: 'error', message: 'out of bounds' }, 400);
    }

    // Check already revealed today
    const userRaw = await redis.get(userKey(username));
    const userData = userRaw
      ? JSON.parse(userRaw)
      : { lastRevealed: '', hasGuessed: false };

    if (userData.lastRevealed === today) {
      return c.json<ErrorResponse>({ status: 'error', message: 'already revealed today' }, 400);
    }

    // Check cell not already revealed
    const existing = await redis.get(cellKey(row, col));
    if (existing) {
      return c.json<ErrorResponse>({ status: 'error', message: 'already revealed' }, 400);
    }

    // Get the actual color from today's art
    const art = generateDailyArt(today);
    const color = art.pixels[row * 64 + col];

    const cell: CellData = {
      revealedBy: username,
      color,
      revealedAt: Date.now(),
    };

    await redis.set(cellKey(row, col), JSON.stringify(cell));
    await redis.set(userKey(username), JSON.stringify({
      ...userData,
      lastRevealed: today,
    }));
    await addToRevealedIndex(row, col);

    // Check new reveal percent
    const index = await getRevealedIndex();
    const revealPercent = (index.length / (64 * 64)) * 100;
    const guessingOpen = revealPercent >= 20 && revealPercent < 40;

    return c.json({
      cell,
      revealPercent: Math.round(revealPercent * 10) / 10,
      guessingOpen,
    });
  } catch (e) {
    console.error('reveal error', e);
    return c.json<ErrorResponse>({ status: 'error', message: 'reveal failed' }, 500);
  }
});

// ── POST /api/guess ───────────────────────────────────────
api.post('/guess', async (c) => {
  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const today = todayDateStr(); // ADD THIS LINE
    const { guess } = await c.req.json();

    if (!guess || guess.trim().length < 2) {
      return c.json<ErrorResponse>({ status: 'error', message: 'guess too short' }, 400);
    }

    // Always read fresh from Redis
    const userRaw = await redis.get(userKey(username));
    const userData = userRaw
      ? JSON.parse(userRaw)
      : { lastRevealed: '', hasGuessed: false };

    const alreadyGuessedToday = userData.hasGuessed === true && 
  (userData.hasGuessedDate === today || !userData.hasGuessedDate);
if (alreadyGuessedToday) {
  return c.json<ErrorResponse>({ status: 'error', message: 'already guessed' }, 400);
}

    // Check guessing window
    const index = await getRevealedIndex();
    const revealPercent = (index.length / (64 * 64)) * 100;
    if (revealPercent < 20 || revealPercent >= 40) {
      return c.json<ErrorResponse>({ status: 'error', message: 'guessing window closed' }, 400);
    }

    const guessData: GuessData = {
      username,
      guess: guess.trim().slice(0, 50),
      submittedAt: Date.now(),
    };

    const guesses = await getGuesses();
    guesses.push(guessData);
    await redis.set(GUESSES_KEY, JSON.stringify(guesses));

    // Save hasGuessed as explicit boolean
    await redis.set(userKey(username), JSON.stringify({
      ...userData,
      hasGuessed: true,
      hasGuessedDate: todayDateStr(), // tie guess to date
    }));

    return c.json({ ok: true, guess: guessData, guesses });
  } catch (e) {
    console.error('guess error', e);
    return c.json<ErrorResponse>({ status: 'error', message: 'guess failed' }, 500);
  }
});