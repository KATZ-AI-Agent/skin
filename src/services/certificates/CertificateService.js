import { createCanvas } from 'canvas';
import { loadFonts } from '../../utils/canvas/fonts.js';
import { loadImage } from '../../utils/canvas/images.js';
import { 
  drawBackground,
  drawLogoAndTitle,
  drawHandDrawnContainer,
  drawCatRobotSilhouette,
  drawMetallicBud,
  drawClawSignature,
  drawTimestamp
} from '../../utils/canvas/drawers.js';
import { applyGrainyFilter } from '../../utils/canvas/effects.js';

export class CertificateService {
  constructor() {
    this.initialized = false;
    this.CANVAS_DIMENSIONS = {
      WIDTH: 800,
      HEIGHT: 1250
    };
  }

  async initialize() {
    if (this.initialized) return;
    await loadFonts();
    this.initialized = true;
  }

  async generateCertificate(data) {
    if (!this.initialized) {
      await this.initialize();
    }

    const canvas = createCanvas(this.CANVAS_DIMENSIONS.WIDTH, this.CANVAS_DIMENSIONS.HEIGHT);
    const ctx = canvas.getContext('2d');

    await this.drawCertificate(ctx, canvas, data);
    return canvas.toBuffer('image/png');
  }

  async drawCertificate(ctx, canvas, data) {
    // Draw base elements
    await drawBackground(ctx, canvas);
    
    // Load and draw logo
    const logoImage = await loadImage('assets/images/logo.png');
    await drawLogoAndTitle(ctx, logoImage);

    // Draw user info
    await this.drawUserInfo(ctx, data.user);

    // Draw wallet sections
    await this.drawWalletSections(ctx, data.wallets);

    // Draw signature and timestamp
    drawClawSignature(ctx);
    await drawTimestamp(ctx, 'assets/images/helmet.png');

    // Apply final effects
    applyGrainyFilter(ctx, canvas.width, canvas.height);
  }

  async drawUserInfo(ctx, user) {
    const avatarContainerY = 350;
    drawHandDrawnContainer(ctx, 175, avatarContainerY, 480, 110);
    drawCatRobotSilhouette(ctx);

    ctx.font = 'italic 21px "SF Toontime"';
    ctx.fillStyle = '#eee';
    ctx.fillText('anon@:', 290, avatarContainerY + 50);

    ctx.font = 'bold 21px "SF Toontime"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(user.username || 'Not set', 290, avatarContainerY + 80);
  }

  async drawWalletSections(ctx, wallets) {
    const networks = [
      { name: 'Ethereum', wallet: wallets.ethereum, y: 550 },
      { name: 'Base', wallet: wallets.base, y: 750 },
      { name: 'Solana', wallet: wallets.solana, y: 950 }
    ];

    for (const { name, wallet, y } of networks) {
      await this.drawWalletSection(ctx, name, wallet, y);
    }
  }

  async drawWalletSection(ctx, name, wallet, y) {
    const containerWidth = this.CANVAS_DIMENSIONS.WIDTH - 50; // Wider container
    const containerX = (this.CANVAS_DIMENSIONS.WIDTH - containerWidth) / 2; // Center the container
    const containerHeight = 160;

    // Draw the container
    drawHandDrawnContainer(ctx, containerX, y, containerWidth, containerHeight);

    // Title text
    ctx.font = 'bold 23px "SF Toontime"';
    ctx.fillStyle = '#ffffff'; // Ensure the text is bright white
    ctx.textAlign = 'center';

    const titleX = containerX + containerWidth / 2;
    const titleY = y + 40;

    // Adjust the golden bud
    const budX = titleX - 170; // Slightly left of the title
    const budY = titleY - 10; // 10px higher
    drawMetallicBud(ctx, budX, budY, '#FFD700');

    // Draw the title 
    ctx.fillStyle = '#00FF00';
    ctx.fillText(`${name} Wallet`, titleX, titleY);

    // Draw underline for the title
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(titleX - 50, titleY + 10); // Start 30px left of the center
    ctx.lineTo(titleX + 50, titleY + 10); // End 30px right of the center
    ctx.stroke();

    // Wallet details
    ctx.font = '20px "SF Toontime"';
    ctx.fillStyle = '#ffffff'; // Ensure the text is bright white
    ctx.textAlign = 'left';
    const details = [
        [`Address: ${wallet.address}`, 80],
        [`Private Key: ${wallet.privateKey}`, 110],
        [`Recovery Phrase: ${wallet.mnemonic}`, 140]
    ];

    details.forEach(([text, yOffset]) => {
        ctx.fillText(text, containerX + 30, y + yOffset); // Indent slightly from the container's left edge
    });
  }



}