import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGlassEffect, createNeonText } from '../../utils/styles.js';
import { CANVAS_DIMENSIONS } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WelcomeCard {
  constructor() {
    this.canvas = createCanvas(CANVAS_DIMENSIONS.WIDTH, CANVAS_DIMENSIONS.HEIGHT);
    this.ctx = this.canvas.getContext('2d');
  }

  async create(data) {
    await this.drawBackground();
    await this.drawLogo();
    await this.drawWalletInfo(data.wallets);
    await this.drawDisclaimer();
    return this.canvas.toBuffer('image/png');
  }

  async drawBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, CANVAS_DIMENSIONS.HEIGHT);
    gradient.addColorStop(0, '#2a0a0a');
    gradient.addColorStop(1, '#000000');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, CANVAS_DIMENSIONS.WIDTH, CANVAS_DIMENSIONS.HEIGHT);
  }

  async drawLogo() {
    const logoPath = path.resolve(__dirname, '../../../assets/images/logo.png');
    const logo = await loadImage(logoPath);
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(270, 100, 100, 0, Math.PI * 2);
    this.ctx.clip();
    
    this.ctx.drawImage(logo, 170, 0, 200, 200);
    createGlassEffect(this.ctx, 170, 0, 200, 200);
    
    this.ctx.restore();
  }

  async drawWalletInfo(wallets) {
    const networks = [
      { name: 'Ethereum', wallet: wallets.ethereum, y: 250 },
      { name: 'Base', wallet: wallets.base, y: 500 },
      { name: 'Solana', wallet: wallets.solana, y: 750 }
    ];

    networks.forEach(({ name, wallet, y }) => {
      createGlassEffect(this.ctx, 100, y, CANVAS_DIMENSIONS.WIDTH - 200, 200);
      
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 20px "SF Toontime"';
      this.ctx.fillText(`${name} Wallet`, 120, y + 40);
      
      this.ctx.font = '24px "SF Toontime"';
      this.ctx.fillText(`Address: ${wallet.address}`, 120, y + 80);
      this.ctx.fillText(`Private Key: ${wallet.privateKey}`, 120, y + 120);
      this.ctx.fillText(`Recovery Phrase: ${wallet.mnemonic}`, 120, y + 160);
    });
  }

  drawDisclaimer() {
    this.ctx.font = '20px "SF Toontime"';
    this.ctx.fillStyle = '#ff0066';
    const disclaimer = 
      'Please download this certificate and write down the private keys. ' +
      'This is the only copy you will get. Welcome to KATZ! ' +
      'Let\'s go into the trenches...';
    
    this.ctx.fillText(disclaimer, 100, CANVAS_DIMENSIONS.HEIGHT - 100);
  }
}