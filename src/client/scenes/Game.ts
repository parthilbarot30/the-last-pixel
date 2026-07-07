import { Scene } from 'phaser';
import * as Phaser from 'phaser';

const GRID = 64;

type CellData = {
  revealedBy: string;
  color: string;
  revealedAt: number;
};

type GuessData = {
  username: string;
  guess: string;
  submittedAt: number;
};

export class Game extends Scene {
  private cells: Phaser.GameObjects.Rectangle[][] = [];
  private cellData: (CellData | null)[][] = [];
  private cellSize = 10;

  private username = 'anonymous';
  private hasRevealedToday = false;
  private hasGuessed = false;
  private revealPercent = 0;
  private revealedCount = 0;
  private guessingOpen = false;

  private tooltip!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;

  private statusText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;

  private guessContainer!: Phaser.GameObjects.Container;
  private guessTicker!: Phaser.GameObjects.Text;

  private loadingOverlay!: Phaser.GameObjects.Rectangle;
  private loadingText!: Phaser.GameObjects.Text;

  private cam!: Phaser.Cameras.Scene2D.Camera;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0d0d');
    this.computeCellSize();
    this.initGrid();
    this.drawGrid();
    this.createTooltip();
    this.createHUD();
    this.createLoadingOverlay();
    this.loadInit();
    this.setupZoomAndPan();

    this.scale.on('resize', () => {
      this.computeCellSize();
      this.repositionGrid();
    });
  }

  // ── Layout ───────────────────────────────────────────────

  private computeCellSize() {
    const available = Math.min(this.scale.width, this.scale.height - 60);
    this.cellSize = Math.max(4, Math.floor(available / GRID));
  }

  private offsetX() {
    return (this.scale.width - GRID * this.cellSize) / 2;
  }

  private offsetY() {
    const gridHeight = GRID * this.cellSize;
    const availableHeight = this.scale.height - 50; // 50 for HUD
    return 40 + Math.max(0, (availableHeight - gridHeight) / 2);
  }

  private initGrid() {
    for (let r = 0; r < GRID; r++) {
      this.cellData[r] = [];
      this.cells[r] = [];
      for (let c = 0; c < GRID; c++) {
        this.cellData[r][c] = null;
      }
    }
  }
  private setupZoomAndPan() {
    this.cam = this.cameras.main;

    // ── Scroll wheel zoom (desktop) ──
    this.input.on('wheel', (_ptr: unknown, _objs: unknown, _dx: unknown, dy: number) => {
      const zoom = Phaser.Math.Clamp(this.cam.zoom - dy * 0.001, 1, 4);
      this.cam.setZoom(zoom);
    });

    // ── Mobile pinch zoom using Phaser's built-in gesture ──
    this.input.addPointer(2);

    const pinch = new Phaser.Input.InputPlugin(this);

    let startZoom = 1;
    let startDist = 0;

    this.input.on('pointermove', () => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);

        if (startDist === 0) {
          startDist = dist;
          startZoom = this.cam.zoom; // capture zoom at THIS pinch start
          return;
        }

        // Small incremental delta per frame, not ratio from start
        const delta = (dist - startDist) * 0.005;
        const zoom = Phaser.Math.Clamp(startZoom + delta, 1, 4);
        this.cam.setZoom(zoom);
      }
    });

    this.input.on('pointerup', () => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (!p1.isDown || !p2.isDown) {
        startDist = 0;
      }
    });

    // ── Single finger pan (only when zoomed in) ──
    let dragStartX = 0;
    let dragStartY = 0;
    let camStartX = 0;
    let camStartY = 0;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      dragStartX = ptr.x;
      dragStartY = ptr.y;
      camStartX = this.cam.scrollX;
      camStartY = this.cam.scrollY;
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown) return;
      if (this.input.pointer2.isDown) return; // skip if pinching
      if (this.cam.zoom <= 1) return; // only pan when zoomed in

      const dx = (ptr.x - dragStartX) / this.cam.zoom;
      const dy = (ptr.y - dragStartY) / this.cam.zoom;
      this.cam.setScroll(camStartX - dx, camStartY - dy);
    });

    // ── Double tap to reset zoom ──
    let lastTap = 0;
    this.input.on('pointerdown', () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        this.cam.setZoom(1);
        this.cam.setScroll(0, 0);
      }
      lastTap = now;
    });
  }

  private drawGrid() {
    const ox = this.offsetX();
    const oy = this.offsetY();

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = ox + c * this.cellSize + this.cellSize / 2;
        const y = oy + r * this.cellSize + this.cellSize / 2;

        const cell = this.add.rectangle(
          x, y,
          this.cellSize - 1,
          this.cellSize - 1,
          0x1a1a2e
        );

        cell.setInteractive();
        cell.on('pointerover', () => this.onHover(r, c, cell));
        cell.on('pointerout', () => this.tooltip.setVisible(false));
        cell.on('pointerdown', () => this.onCellClick(r, c));

        this.cells[r][c] = cell;
      }
    }
  }

  private repositionGrid() {
    const ox = this.offsetX();
    const oy = this.offsetY();
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = ox + c * this.cellSize + this.cellSize / 2;
        const y = oy + r * this.cellSize + this.cellSize / 2;
        this.cells[r][c].setPosition(x, y);
        this.cells[r][c].setSize(this.cellSize - 1, this.cellSize - 1);
      }
    }
    if (this.progressBar) {
      this.progressBar.setPosition(this.scale.width / 2, 22);
      this.progressBar.setSize(this.scale.width - 40, 8);
    }
  }

  // ── HUD ──────────────────────────────────────────────────

  private createHUD() {
    // Progress bar background
    this.progressBar = this.add.rectangle(
      this.scale.width / 2, 22,
      this.scale.width - 40, 8,
      0x333333
    ).setDepth(10);

    // Progress fill
    this.progressFill = this.add.rectangle(
      20 + 1, 22,
      2, 8,
      0x4a9eff
    ).setDepth(11).setOrigin(0, 0.5);

    // Status text
    this.statusText = this.add.text(
      this.scale.width / 2, 10,
      'uncovering today\'s art...',
      {
        fontSize: '11px',
        color: '#666666',
        fontFamily: 'monospace',
      }
    ).setOrigin(0.5, 0.5).setDepth(10);

    // Bottom prompt
    this.promptText = this.add.text(
      this.scale.width / 2,
      this.scale.height - 10,
      'tap any covered cell to reveal',
      {
        fontSize: '11px',
        color: '#555555',
        fontFamily: 'monospace',
      }
    ).setOrigin(0.5, 1).setDepth(10);

    this.tweens.add({
      targets: this.promptText,
      alpha: 0.3,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateHUD() {
    const pct = this.revealPercent;
    const barWidth = this.scale.width - 40;
    const fillWidth = Math.max(2, (pct / 100) * barWidth);

    this.tweens.add({
      targets: this.progressFill,
      width: fillWidth,
      duration: 400,
      ease: 'Quad.easeOut',
    });

    // Color shifts as more is revealed
    const color = pct < 20 ? 0x4a9eff :
                  pct < 40 ? 0xf0a500 :
                  pct < 80 ? 0x2ecc71 : 0xffd700;
    this.progressFill.setFillStyle(color);

    let statusMsg = '';
    if (this.revealPercent < 20) {
      statusMsg = `${this.revealedCount} of 4096 cells revealed`;
    } else if (this.revealPercent < 40) {
      statusMsg = `${this.revealPercent}% revealed - guess what it is!`;
    } else if (this.revealPercent < 100) {
      statusMsg = `${this.revealPercent}% revealed - keep going!`;
    } else {
      statusMsg = 'fully revealed! resets at midnight';
    }
    this.statusText.setText(statusMsg);

    if (this.hasRevealedToday) {
      this.promptText.setText('come back tomorrow to reveal more').setAlpha(0.5);
      this.tweens.killTweensOf(this.promptText);
    }

    // Show/hide guess input
    if (this.guessingOpen && !this.hasGuessed) {
      this.showGuessInput();
    } else if (!this.guessingOpen && this.guessContainer) {
      this.guessContainer.setVisible(false);
    }
  }

  // ── Tooltip ──────────────────────────────────────────────

  private createTooltip() {
    this.tooltipBg = this.add.rectangle(0, 0, 160, 44, 0x000000, 0.88).setOrigin(0, 1);
    this.tooltipText = this.add.text(8, -6, '', {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'monospace',
      lineSpacing: 4,
    }).setOrigin(0, 1);

    this.tooltip = this.add.container(0, 0, [this.tooltipBg, this.tooltipText]);
    this.tooltip.setVisible(false).setDepth(20);
  }

  private onHover(r: number, c: number, cell: Phaser.GameObjects.Rectangle) {
    const data = this.cellData[r][c];
    if (!data) {
      this.tooltip.setVisible(false);
      return;
    }

    const px = Math.min(cell.x + this.cellSize, this.scale.width - 165);
    const py = Math.min(cell.y + this.cellSize, this.scale.height - 10);
    this.tooltip.setPosition(px, py);
    this.tooltipText.setText(`revealed by\n${data.revealedBy}`);
    this.tooltip.setVisible(true);
  }

  // ── Guess input ──────────────────────────────────────────

  private showGuessInput() {
    if (this.guessContainer && this.guessContainer.visible) return;

    const w = Math.min(300, this.scale.width - 40);
    const x = this.scale.width / 2;
    const y = this.scale.height - 50;

    const bg = this.add.rectangle(0, 0, w, 36, 0x111111, 0.95)
      .setStrokeStyle(1, 0x4a9eff);

    const label = this.add.text(-w / 2 + 10, 0, 'guess the art (20-40% window):', {
      fontSize: '10px',
      color: '#4a9eff',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Use DOM input for text entry
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'type your guess...';
    inputEl.maxLength = 50;
    inputEl.style.cssText = `
      position: absolute;
      width: ${w - 20}px;
      background: transparent;
      border: none;
      border-bottom: 1px solid #4a9eff;
      color: #ffffff;
      font-family: monospace;
      font-size: 13px;
      outline: none;
      padding: 2px 4px;
    `;

    const domEl = this.add.dom(0, 0, inputEl);

    const submitBtn = this.add.text(w / 2 - 8, 0, 'submit', {
      fontSize: '11px',
      color: '#2ecc71',
      fontFamily: 'monospace',
      backgroundColor: '#0d2b1a',
      padding: { x: 6, y: 3 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    submitBtn.on('pointerdown', () => {
      const val = inputEl.value.trim();
      if (val.length >= 2) this.submitGuess(val);
    });

    this.guessContainer = this.add.container(x, y, [bg, label, domEl, submitBtn]);
    this.guessContainer.setDepth(25);
  }

  private async submitGuess(guess: string) {
    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess }),
      });

      if (!res.ok) {
        const err = await res.json();
        this.showFlash(err.message ?? 'could not submit', '#e74c3c');
        return;
      }

      this.hasGuessed = true;
      this.guessContainer.setVisible(false);
      this.showFlash(`guess locked in: "${guess}"`, '#2ecc71');
    } catch {
      this.showFlash('connection error', '#e74c3c');
    }
  }

  // ── Cell interaction ─────────────────────────────────────

  private async onCellClick(r: number, c: number) {
    if (this.cellData[r][c]) return; // already revealed

    if (this.hasRevealedToday) {
      this.showFlash('come back tomorrow!', '#888888');
      return;
    }

    await this.revealCell(r, c);
  }

  private async revealCell(r: number, c: number) {
    try {
      const res = await fetch('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: r, col: c }),
      });

      if (!res.ok) {
        const err = await res.json();
        this.showFlash(err.message ?? 'reveal failed', '#e74c3c');
        return;
      }

      const data = await res.json();
      this.renderCell(r, c, data.cell);
      this.hasRevealedToday = true;
      this.revealPercent = data.revealPercent;
      this.revealedCount += 1;
      this.guessingOpen = data.guessingOpen;
      this.updateHUD();
      this.showFlash('revealed!', '#4a9eff');
    } catch {
      this.showFlash('connection error', '#e74c3c');
    }
  }

  // ── Rendering ────────────────────────────────────────────

  private renderCell(r: number, c: number, data: CellData) {
    this.cellData[r][c] = data;
    const cell = this.cells[r][c];
    const colorInt = parseInt(data.color.replace('#', ''), 16);

    cell.setFillStyle(colorInt);
    cell.setAlpha(0);

    this.tweens.add({
      targets: cell,
      alpha: 1,
      duration: 400,
      ease: 'Quad.easeOut',
    });

    // Reveal ripple
    const ripple = this.add.circle(cell.x, cell.y, this.cellSize * 2, colorInt, 0.5);
    this.tweens.add({
      targets: ripple,
      scaleX: 4, scaleY: 4,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => ripple.destroy(),
    });
  }

  // ── Loading overlay ──────────────────────────────────────

  private createLoadingOverlay() {
    this.loadingOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      0x0d0d0d
    ).setDepth(50).setOrigin(0.5);

    this.loadingText = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      'loading canvas...',
      { fontSize: '13px', color: '#444444', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(51);
  }

  private removeLoadingOverlay() {
    this.tweens.add({
      targets: [this.loadingOverlay, this.loadingText],
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.loadingOverlay.destroy();
        this.loadingText.destroy();
      },
    });
  }

  // ── Init load ────────────────────────────────────────────

  private async loadInit() {
    try {
      const res = await fetch('/api/init');
      if (!res.ok) return;
      const data = await res.json();

      this.username = data.username ?? 'anonymous';
      this.hasRevealedToday = data.hasRevealedToday ?? false;
      this.hasGuessed = data.hasGuessed ?? false;
      this.revealPercent = data.revealPercent ?? 0;
      this.revealedCount = data.revealedCount ?? 0;
      this.guessingOpen = data.guessingOpen ?? false;

      for (const { row, col, cell } of data.cells ?? []) {
        this.renderCell(row, col, cell);
      }

      this.updateHUD();

      // Show guesses ticker if any
      if (data.guesses?.length > 0) {
        this.showGuessTicker(data.guesses);
      }
    } catch (e) {
      console.error('init failed', e);
    } finally {
      this.removeLoadingOverlay();
    }
  }

  // ── Guesses ticker ───────────────────────────────────────

  private showGuessTicker(guesses: GuessData[]) {
    const text = guesses
      .slice(-5)
      .map((g) => `${g.username}: "${g.guess}"`)
      .join('   |   ');

    if (this.guessTicker) this.guessTicker.destroy();

    this.guessTicker = this.add.text(
      this.scale.width + 100,
      this.scale.height - 28,
      text,
      { fontSize: '11px', color: '#f0a500', fontFamily: 'monospace' }
    ).setDepth(10);

    // Scroll ticker left
    this.tweens.add({
      targets: this.guessTicker,
      x: -this.guessTicker.width - 100,
      duration: text.length * 80,
      ease: 'Linear',
      repeat: -1,
      onRepeat: () => {
        this.guessTicker.setX(this.scale.width + 100);
      },
    });
  }

  // ── Flash message ────────────────────────────────────────

  private showFlash(msg: string, color: string) {
    const flash = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      msg,
      {
        fontSize: '15px',
        color,
        fontFamily: 'monospace',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 },
      }
    ).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: flash,
      y: flash.y - 40,
      alpha: 0,
      duration: 1500,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }
}