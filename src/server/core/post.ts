import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'The Last Pixel — uncover today\'s hidden art 🎨',
  });
};