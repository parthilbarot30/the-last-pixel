import { Game as MainGame } from './scenes/Game';
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#0d0d0d',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [MainGame],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

document.addEventListener('DOMContentLoaded', () => {
  const game = StartGame('game-container');
  const getScene = (): any => game.scene.getScene('Game');

  // ── Zoom buttons ──
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    const s = getScene();
    if (!s?.cam) return;
    s.cam.setZoom(Phaser.Math.Clamp(
      Math.round((s.cam.zoom + 0.5) * 10) / 10, 1, 4
    ));
    s.clampCamera();
  });

  document.getElementById('zoom-out')?.addEventListener('click', () => {
    const s = getScene();
    if (!s?.cam) return;
    const newZoom = Phaser.Math.Clamp(
      Math.round((s.cam.zoom - 0.5) * 10) / 10, 1, 4
    );
    s.cam.setZoom(newZoom);
    if (newZoom <= 1) s.cam.setScroll(0, 0);
    s.clampCamera();
  });

  // ── Guess button ──
  const guessBtn = document.getElementById('guess-btn')!;

  (window as any).updateGuessBtn = (revealPercent: number, hasGuessed: boolean) => {
    if (hasGuessed) {
      guessBtn.className = 'past';
      guessBtn.title = 'already guessed today';
      return;
    }
    if (revealPercent < 20) {
      guessBtn.className = '';
      guessBtn.title = `reveal more first (${revealPercent.toFixed(1)}% — need 20%)`;
    } else if (revealPercent >= 40) {
      guessBtn.className = 'past';
      guessBtn.title = 'guessing window closed (past 40%)';
    } else {
      guessBtn.className = 'active';
      guessBtn.title = `guess now! (${revealPercent.toFixed(1)}% revealed)`;
    }
  };

  guessBtn.addEventListener('click', () => {
    const s = getScene();
    const pct = s?.revealPercent ?? 0;
    const guessed = s?.hasGuessed ?? false;

    if (guessed) {
      alert('you already guessed today!');
      return;
    }
    if (pct < 20) {
      alert(`need 20% revealed to guess. currently at ${pct.toFixed(1)}%`);
      return;
    }
    if (pct >= 40) {
      alert('guessing window closed — more than 40% has been revealed');
      return;
    }
    (window as any).showGuessOverlay?.();
  });

  // ── Guess overlay ──
  const overlay = document.getElementById('guess-overlay')!;
  const input = document.getElementById('guess-input') as HTMLInputElement;
  const submitBtn = document.getElementById('guess-submit')!;
  const errorEl = document.getElementById('guess-error')!;

  (window as any).showGuessOverlay = () => {
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  };

  (window as any).hideGuessOverlay = () => {
    overlay.style.display = 'none';
  };

  submitBtn.addEventListener('click', async () => {
    const val = input.value.trim();
    if (val.length < 2) {
      errorEl.textContent = 'guess must be at least 2 characters';
      return;
    }

    submitBtn.textContent = 'locking in...';
    submitBtn.setAttribute('disabled', 'true');

    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess: val }),
      });

      if (!res.ok) {
        const err = await res.json();
        errorEl.textContent = err.message ?? 'could not submit';
        submitBtn.textContent = 'lock in guess';
        submitBtn.removeAttribute('disabled');
        return;
      }

      const data = await res.json();
      overlay.style.display = 'none';
      input.value = '';
      const s = getScene();
      s?.showFlash(`locked in: "${val}"`, '#2ecc71');
      if (s) {
        s.hasGuessed = true;
        if (data.guesses?.length > 0) {
          s.showGuessTicker(data.guesses);
        }
        (window as any).updateGuessBtn?.(s.revealPercent, true);
      }
    } catch {
      errorEl.textContent = 'connection error';
      submitBtn.textContent = 'lock in guess';
      submitBtn.removeAttribute('disabled');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });
  document.getElementById('guess-close')?.addEventListener('click', () => {
    overlay.style.display = 'none';
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});