import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANVAS_DIMENSIONS } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CertificateGenerator {
  constructor() {
    this.canvas = createCanvas(CANVAS_DIMENSIONS.WIDTH, CANVAS_DIMENSIONS.HEIGHT);
    this.ctx = this.canvas.getContext('2d');
  }

  async generate(data) {
    await this.drawBackground();
    await this.drawLogoAndTitle();
    await this.drawUserInfo(data.user);
    await this.drawWalletInfo(data.wallets);
    await this.drawTimestamp();
    await this.drawClawSignature();
    this.applyGrainyFilter();
    return this.canvas.toBuffer('image/png');
  }

  async drawBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, CANVAS_DIMENSIONS.HEIGHT);
    gradient.addColorStop(0, '#2a0a0a');
    gradient.addColorStop(1, '#000000');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, CANVAS_DIMENSIONS.WIDTH, CANVAS_DIMENSIONS.HEIGHT);
  }

  async drawLogoAndTitle() {
    const logoPath = path.resolve(__dirname, '../../../assets/images/logo.png');
    const logoBuffer = await loadImage(logoPath);

    // Draw logo
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(370, 200, 100, 0, Math.PI * 2);
    this.ctx.clip();
    this.ctx.drawImage(logoBuffer, 270, 100, 200, 200);
    this.ctx.restore();

    // Draw title text with effects
    this.drawTiltedText('KATZ!', 500, 180, 'bold 42px "SF Toontime"', 'azure', 'center', 0.05, 0);
    this.drawTiltedText('KATZ!', 490, 200, 'bold 45px "SF Toontime"', 'azure', 'center', -0.3, 0);
    this.drawTiltedText('memes', 280, 210, 'italic 20px "SF Toontime"', '#b09a9a', 'center', 0.1, 0.2);
  }

  drawTiltedText(text, x, y, font, fillStyle, textAlign, skewX = 0, skewY = 0) {
    this.ctx.save();
    this.ctx.font = font;
    this.ctx.fillStyle = fillStyle;
    this.ctx.textAlign = textAlign;
    this.ctx.transform(1, skewY, skewX, 1, 0, 0);
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }

  async drawUserInfo(user) {
    const avatarContainerY = 350;
    this.drawHandDrawnContainer(175, avatarContainerY, 480, 110);

    // Draw cat robot silhouette
    this.drawCatRobotSilhouette();

    // Draw user info text
    this.ctx.font = 'italic 21px "SF Toontime"';
    this.ctx.fillStyle = '#b0b0b0';
    this.ctx.fillText('anon@:', 290, avatarContainerY + 50);

    this.ctx.font = 'bold 21px "SF Toontime"';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(user.username || 'Not set', 290, avatarContainerY + 80);
  }

  drawCatRobotSilhouette() {
    const x = 200;
    const y = 390;
    const scale = 0.38;

    this.ctx.fillStyle = '#FFD700';
    this.ctx.beginPath();
    this.ctx.moveTo(x + 20 * scale, y);
    this.ctx.lineTo(x + 60 * scale, y - 40 * scale);
    this.ctx.lineTo(x + 100 * scale, y);
    this.ctx.lineTo(x + 140 * scale, y - 40 * scale);
    this.ctx.lineTo(x + 180 * scale, y);
    this.ctx.lineTo(x + 160 * scale, y + 100 * scale);
    this.ctx.lineTo(x + 20 * scale, y + 100 * scale);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw eyes
    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.arc(x + 60 * scale, y + 20 * scale, 10 * scale, 0, Math.PI * 2);
    this.ctx.arc(x + 120 * scale, y + 20 * scale, 10 * scale, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw nose and whiskers
    this.drawNoseAndWhiskers(x, y, scale);
  }

  drawNoseAndWhiskers(x, y, scale) {
    // Nose
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.moveTo(x + 90 * scale, y + 40 * scale);
    this.ctx.lineTo(x + 80 * scale, y + 60 * scale);
    this.ctx.lineTo(x + 100 * scale, y + 60 * scale);
    this.ctx.closePath();
    this.ctx.fill();

    // Whiskers
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    [
      [40, 40, 10, 40],
      [40, 50, 10, 50],
      [140, 40, 170, 40],
      [140, 50, 170, 50]
    ].forEach(([x1, y1, x2, y2]) => {
      this.ctx.moveTo(x + x1 * scale, y + y1 * scale);
      this.ctx.lineTo(x + x2 * scale, y + y2 * scale);
    });
    this.ctx.stroke();

    // KATZ! text on chest
    this.ctx.font = '15px "SF Toontime"';
    this.ctx.fillStyle = 'red';
    this.ctx.fillText('KATZ!', x + 35 * scale, y + 90 * scale);
  }

  async drawWalletInfo(wallets) {
    const networks = [
      { name: 'Ethereum', wallet: wallets.ethereum, y: 550 },
      { name: 'Base', wallet: wallets.base, y: 750 },
      { name: 'Solana', wallet: wallets.solana, y: 950 }
    ];

    networks.forEach(({ name, wallet, y }) => {
      this.drawWalletSection(name, wallet, y);
    });
  }

  drawWalletSection(name, wallet, y) {
    // Draw container
    this.drawHandDrawnContainer(100, y, CANVAS_DIMENSIONS.WIDTH - 200, 150);

    // Draw wallet info
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px "SF Toontime"';
    this.ctx.fillText(`${name} Wallet`, 120, y + 40);

    this.ctx.font = '20px "SF Toontime"';
    [
      [`Address: ${wallet.address}`, 80],
      [`Private Key: ${wallet.privateKey}`, 110],
      [`Recovery Phrase: ${wallet.mnemonic}`, 140]
    ].forEach(([text, yOffset]) => {
      this.ctx.fillText(text, 120, y + yOffset);
    });
  }

  async drawTimestamp() {
    const options = {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    const timestamp = new Date().toLocaleString('en-US', options);
    
    const helmetPath = path.resolve(__dirname, '../../../assets/images/helmet.png');
    const helmetImage = await loadImage(helmetPath);
    
    const x = 345;
    const y = 1150;
    const iconSize = 32;
    
    this.ctx.drawImage(helmetImage, x, y - iconSize, iconSize, iconSize);
    
    this.ctx.font = 'italic 14px "SF Toontime"';
    this.ctx.fillStyle = '#00FF00';
    this.ctx.fillText(timestamp, x + iconSize - 20, y + iconSize - 10);
  }

  drawClawSignature() {
    const clawX = 420;
    const clawY = 1050;
    const clawSize = 8;
    const scratchOffsets = [-20, -5, 10, 20];

    scratchOffsets.forEach(offset => {
      const gradient = this.ctx.createLinearGradient(
        clawX + offset,
        clawY - clawSize * 2,
        clawX + offset,
        clawY + clawSize * 3
      );
      gradient.addColorStop(0, 'rgba(255, 65, 65, 0)');
      gradient.addColorStop(0.2, '#FF0000');
      gradient.addColorStop(0.8, '#FF0000');
      gradient.addColorStop(1, 'rgba(255, 65, 65, 0)');

      this.ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
      this.ctx.shadowBlur = 15;
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 3;

      this.drawClawScratch(clawX + offset, clawY, clawSize);
    });

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Add signature text
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
    this.ctx.font = 'italic 14px "SF Toontime"';
    this.ctx.fillStyle = 'yellow';
    this.ctx.fillText('Meme Trechor Level 1: Square up anon...', 250, clawY + 70);
  }

  drawClawScratch(x, y, size) {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size * 2);
    
    for (let i = y - size * 2; i < y + size * 3; i += size / 2) {
      const variation = (Math.random() * size * 0.6) - size * 0.2;
      this.ctx.lineTo(x + variation, i + size / 2);
    }
    
    this.ctx.stroke();
    this.ctx.closePath();

    // Thicker middle section
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x, y + size * 2);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  drawHandDrawnContainer(x, y, width, height) {
    this.ctx.strokeStyle = y < 400 ? '#444' : '#555';
    this.ctx.lineWidth = y < 400 ? 1 : 1.5;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x + 20, y);
    this.ctx.lineTo(x + width - 20, y + 10);
    this.ctx.lineTo(x + width, y + height - 20);
    this.ctx.lineTo(x + 10, y + height);
    this.ctx.lineTo(x - 20, y + height - 10);
    this.ctx.closePath();
    this.ctx.stroke();
  }

  applyGrainyFilter(alpha = 0.03) {
    const grainCanvas = createCanvas(CANVAS_DIMENSIONS.WIDTH, CANVAS_DIMENSIONS.HEIGHT);
    const grainCtx = grainCanvas.getContext('2d');

    for (let x = 0; x < CANVAS_DIMENSIONS.WIDTH; x++) {
      for (let y = 0; y < CANVAS_DIMENSIONS.HEIGHT; y++) {
        if (Math.random() > 0.97) {
          const gray = Math.random() * 255;
          grainCtx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
          grainCtx.fillRect(x, y, 1, 1);
        }
      }
    }

    this.ctx.drawImage(grainCanvas, 0, 0);
  }
}