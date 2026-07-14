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
  public hasGuessed = false;
  public revealPercent = 0;
  private revealedCount = 0;
  private guessingOpen = false;
  private revealing = false;
  private countdownStarted = false;

  public cam!: Phaser.Cameras.Scene2D.Camera;

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
    const availableW = this.scale.width;
    const availableH = this.scale.height - 60;
    this.cellSize = Math.max(3, Math.floor(
      Math.min(availableW, availableH) / GRID
    ));
  }

  private offsetX() {
    return Math.floor((this.scale.width - GRID * this.cellSize) / 2);
  }

  private offsetY() {
    const gridH = GRID * this.cellSize;
    const availableH = this.scale.height - 60;
    return 40 + Math.floor((availableH - gridH) / 2);
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
    if (this.statusText) {
      this.statusText.setPosition(this.scale.width / 2, 10);
    }
    if (this.promptText) {
      this.promptText.setPosition(this.scale.width / 2, this.scale.height - 10);
    }
  }

  // ── HUD ──────────────────────────────────────────────────

  private createHUD() {
    this.progressBar = this.add.rectangle(
      this.scale.width / 2, 22,
      this.scale.width - 40, 8,
      0x333333
    ).setDepth(10).setScrollFactor(0);

    this.progressFill = this.add.rectangle(
      20, 22, 2, 8, 0x4a9eff
    ).setDepth(11).setOrigin(0, 0.5).setScrollFactor(0);

    this.statusText = this.add.text(
      this.scale.width / 2, 16,
      'loading...',
      {
        fontSize: '11px',
        color: '#4a9eff',
        fontFamily: '"Space Mono", monospace',
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#4a9eff',
          blur: 8,
          fill: true,
        },
      }
    ).setOrigin(0.5, 0.5).setDepth(10).setScrollFactor(0);

    this.promptText = this.add.text(
      this.scale.width / 2,
      this.scale.height - 6,
      'tap any covered cell to reveal',
      { fontSize: '10px', color: '#555555', fontFamily: '"Space Mono", monospace' }
    ).setOrigin(0.5, 1).setDepth(10).setScrollFactor(0);

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
    const barWidth = this.scale.width - 40;
    const fillWidth = Math.max(2, (this.revealPercent / 100) * barWidth);

    this.tweens.add({
      targets: this.progressFill,
      width: fillWidth,
      duration: 400,
      ease: 'Quad.easeOut',
    });

    const color = this.revealPercent < 20 ? 0x4a9eff :
                  this.revealPercent < 40 ? 0xf0a500 :
                  this.revealPercent < 80 ? 0x2ecc71 : 0xffd700;
    this.progressFill.setFillStyle(color);

    let statusMsg = '';
    if (this.revealPercent < 20) {
      statusMsg = `${this.revealedCount} of 4096 cells revealed`;
    } else if (this.revealPercent < 40) {
      statusMsg = `${this.revealPercent}% revealed - guess what it is!`;
    } else if (this.revealPercent < 100) {
      statusMsg = `${this.revealPercent}% revealed - keep going!`;
    } else {
      this.startMidnightCountdown();
      return; // countdown handles status text
    }
    this.statusText.setText(statusMsg);

    if (this.hasRevealedToday) {
      this.promptText.setText('come back tomorrow to reveal more').setAlpha(0.5);
      this.tweens.killTweensOf(this.promptText);
    }
    (window as any).updateGuessBtn?.(this.revealPercent, this.hasGuessed);
  }

  // ── Tooltip ──────────────────────────────────────────────

  private createTooltip() {
    this.tooltipBg = this.add.rectangle(0, 0, 160, 44, 0x000000, 0.88)
      .setOrigin(0, 1);
    this.tooltipText = this.add.text(8, -6, '', {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'monospace',
      lineSpacing: 4,
    }).setOrigin(0, 1);

    this.tooltip = this.add.container(0, 0, [this.tooltipBg, this.tooltipText]);
    this.tooltip.setVisible(false).setDepth(20).setScrollFactor(0);
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
  }

  private async submitGuess(_guess: string) {
    // handled by game.ts DOM layer
  }

  // ── Cell interaction ─────────────────────────────────────

  private async onCellClick(r: number, c: number) {
    if (this.cellData[r][c]) return;

    if (this.hasRevealedToday) {
      this.showFlash('come back tomorrow!', '#888888');
      return;
    }

    await this.revealCell(r, c);
  }

  private async revealCell(r: number, c: number) {
  if (this.revealing) return;
  this.revealing = true;

  // Optimistic UI — show immediately, don't wait for server
  const tempColor = '#4a9eff';
  const tempCell: CellData = {
    revealedBy: this.username,
    color: tempColor,
    revealedAt: Date.now(),
  };
  this.renderCell(r, c, tempCell);
  this.showFlash('revealed!', '#4a9eff');
  this.hasRevealedToday = true;
  this.revealedCount += 1;
  this.revealing = false; // allow next action immediately

  try {
    const res = await fetch('/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row: r, col: c }),
    });

    if (!res.ok) {
      const err = await res.json();
      // Revert optimistic update
      this.cellData[r][c] = null;
      this.cells[r][c].setFillStyle(0x1a1a2e).setAlpha(1);
      this.hasRevealedToday = false;
      this.revealedCount -= 1;
      this.showFlash(err.message ?? 'reveal failed', '#e74c3c');
      return;
    }

    const data = await res.json();
    // Update with real color from server
    this.renderCell(r, c, data.cell);
    this.revealPercent = data.revealPercent;
    this.guessingOpen = data.guessingOpen;
    if (data.revealPercent >= 100) {
      this.triggerRevealWave();
    }
    this.updateHUD();
  } catch {
    // Revert on network error
    this.cellData[r][c] = null;
    this.cells[r][c].setFillStyle(0x1a1a2e).setAlpha(1);
    this.hasRevealedToday = false;
    this.revealedCount -= 1;
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

  // ── Reveal wave ──────────────────────────────────────────

  private triggerRevealWave() {
    const ox = this.offsetX();
    const oy = this.offsetY();
    const cx = ox + (GRID * this.cellSize) / 2;
    const cy = oy + (GRID * this.cellSize) / 2;

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (this.cellData[r][c]) continue;
        const cell = this.cells[r][c];
        const dist = Phaser.Math.Distance.Between(cell.x, cell.y, cx, cy);
        this.time.delayedCall(dist * 2, () => {
          cell.setFillStyle(0x333333);
          this.tweens.add({
            targets: cell,
            alpha: 1,
            duration: 300,
            ease: 'Quad.easeOut',
          });
        });
      }
    }

    const maxDist = Math.sqrt((GRID * this.cellSize) ** 2 * 2);
    this.time.delayedCall(maxDist * 2 + 500, () => {
      const msg = this.add.text(
        this.scale.width / 2,
        this.scale.height / 2,
        'fully revealed!\nnew art drops at midnight',
        {
          fontSize: '18px',
          color: '#ffd700',
          fontFamily: '"Space Mono", monospace',
          backgroundColor: '#000000cc',
          padding: { x: 20, y: 14 },
          align: 'center',
        }
      ).setOrigin(0.5).setDepth(40).setScrollFactor(0);

      this.tweens.add({
        targets: msg,
        alpha: 0,
        duration: 3000,
        delay: 3000,
        ease: 'Quad.easeIn',
        onComplete: () => msg.destroy(),
      });
    });
  }
  private startMidnightCountdown() {
  if (this.countdownStarted) return;
  this.countdownStarted = true;

  const updateCountdown = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    this.statusText.setText(`fully revealed! new art in ${h}h ${m}m ${s}s`);
  };

  updateCountdown();
  setInterval(updateCountdown, 1000);
}
  // ── Loading overlay ──────────────────────────────────────

  private createLoadingOverlay() {
    this.loadingOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      0x0d0d0d
    ).setDepth(50).setOrigin(0.5).setScrollFactor(0);

    this.loadingText = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      'loading canvas...',
      { fontSize: '13px', color: '#444444', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(51).setScrollFactor(0);
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
    this.hasRevealedToday = data.hasRevealedToday ?? false; // restored
    this.hasGuessed = data.hasGuessed ?? false;
    this.revealPercent = data.revealPercent ?? 0;
    this.revealedCount = data.revealedCount ?? 0;
    this.guessingOpen = data.guessingOpen ?? false;

    for (const { row, col, cell } of data.cells ?? []) {
      this.renderCell(row, col, cell);
    }

    this.updateHUD();

    if (this.revealPercent >= 100 && data.label) {
      this.time.delayedCall(1000, () => {
        this.showFlash(`today's art: "${data.label}"`, '#ffd700');
      });
    }

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

  public showGuessTicker(guesses: GuessData[]) {
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
    ).setDepth(10).setScrollFactor(0);

    this.tweens.add({
      targets: this.guessTicker,
      x: -this.guessTicker.width - 100,
      duration: text.length * 80,
      ease: 'Linear',
      repeat: -1,
      onRepeat: () => this.guessTicker.setX(this.scale.width + 100),
    });
  }

  // ── Flash ────────────────────────────────────────────────

  public showFlash(msg: string, color: string) {
    const flash = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      msg,
      {
        fontSize: '15px', color,
        fontFamily: 'monospace',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 },
      }
    ).setOrigin(0.5).setDepth(30).setScrollFactor(0);

    this.tweens.add({
      targets: flash,
      y: flash.y - 40,
      alpha: 0,
      duration: 1500,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  // ── Zoom and Pan ─────────────────────────────────────────

  private setupZoomAndPan() {
    this.cam = this.cameras.main;

    let dragX = 0, dragY = 0, camX = 0, camY = 0;
    let moved = false;
    let lastTap = 0;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        this.cam.setZoom(1);
        this.cam.setScroll(0, 0);
      }
      lastTap = now;

      dragX = ptr.x;
      dragY = ptr.y;
      camX = this.cam.scrollX;
      camY = this.cam.scrollY;
      moved = false;
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || this.cam.zoom <= 1) return;
      const dx = ptr.x - dragX;
      const dy = ptr.y - dragY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        moved = true;
        this.cam.setScroll(
          camX - dx / this.cam.zoom,
          camY - dy / this.cam.zoom
        );
      }
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (!moved) {
        const worldPoint = this.cam.getWorldPoint(ptr.x, ptr.y);
        const col = Math.floor((worldPoint.x - this.offsetX()) / this.cellSize);
        const row = Math.floor((worldPoint.y - this.offsetY()) / this.cellSize);
        if (row >= 0 && row < GRID && col >= 0 && col < GRID) {
          this.onCellClick(row, col);
        }
      }
      moved = false;
    });
  }

  public clampCamera() {}
}