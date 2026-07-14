import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { createPost } from '../core/post';

export const triggers = new Hono();

const REVEALED_INDEX = 'revealed_index';
const GUESSES_KEY = 'guesses';

function cellKey(row: number, col: number) {
  return `cell:${row}:${col}`;
}

async function resetBoard() {
  try {
    // Load current index
    const raw = await redis.get(REVEALED_INDEX);
    const index: string[] = raw ? JSON.parse(raw) : [];

    // Delete all revealed cells
    for (const entry of index) {
      const [r, c] = entry.split(':').map(Number);
      await redis.del(cellKey(r, c));
    }

    // Clear index and guesses
    await redis.del(REVEALED_INDEX);
    await redis.del(GUESSES_KEY);

    console.log(`Board reset at midnight. Cleared ${index.length} cells.`);
  } catch (e) {
    console.error('Reset error:', e);
  }
}

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

// Midnight reset endpoint — called by Devvit cron
triggers.post('/on-cron', async (c) => {
  await resetBoard();
  return c.json<TriggerResponse>({ status: 'success', message: 'Board reset' });
});