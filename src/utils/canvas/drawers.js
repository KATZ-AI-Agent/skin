import { loadImage } from './images.js';

export async function drawBackground(ctx, canvas) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#2a0a0a');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export async function drawLogoAndTitle(ctx, logoImage, x = 270, y = 100) {
  if (!logoImage) {
    throw new Error('Logo image is required');
  }
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 100, y + 100, 100, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logoImage, x, y, 200, 200);
  ctx.restore();

  drawTiltedText(ctx, 'KATZ!', 500, 180, 'bold 42px "SF Toontime"', 'azure', 'center', 0.05, 0);
  drawTiltedText(ctx, 'KATZ!', 490, 200, 'bold 45px "SF Toontime"', 'azure', 'center', -0.3, 0);
  drawTiltedText(ctx, 'memes', 280, 210, 'italic 20px "SF Toontime"', '#b09a9a', 'center', 0.1, 0.2);
}

export function drawTiltedText(ctx, text, x, y, font, fillStyle, textAlign, skewX = 0, skewY = 0) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = textAlign;
  ctx.transform(1, skewY, skewX, 1, 0, 0);
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawHandDrawnContainer(ctx, x, y, width, height) {
  ctx.strokeStyle = y < 400 ? '#444' : '#555';
  ctx.lineWidth = y < 400 ? 1 : 1.5;
  
  ctx.beginPath();
  ctx.moveTo(x + 20, y);
  ctx.lineTo(x + width - 20, y + 10);
  ctx.lineTo(x + width, y + height - 20);
  ctx.lineTo(x + 10, y + height);
  ctx.lineTo(x - 20, y + height - 10);
  ctx.closePath();
  ctx.stroke();
}

export function drawMetallicBud(ctx, centerX, centerY, color) {
  const radius = 6;
  const gradient = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, radius);
  
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.4, 'rgba(255, 255, 0, 1)');
  gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.8)');
  gradient.addColorStop(1, 'rgba(120, 120, 120, 1)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(centerX - 1, centerY - 2, radius / 2.5, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawCatRobotSilhouette(ctx) {
  const x = 200;
  const y = 390;
  const scale = 0.38;

  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(x + 20 * scale, y);
  ctx.lineTo(x + 60 * scale, y - 40 * scale);
  ctx.lineTo(x + 100 * scale, y);
  ctx.lineTo(x + 140 * scale, y - 40 * scale);
  ctx.lineTo(x + 180 * scale, y);
  ctx.lineTo(x + 160 * scale, y + 100 * scale);
  ctx.lineTo(x + 20 * scale, y + 100 * scale);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.arc(x + 60 * scale, y + 20 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.arc(x + 120 * scale, y + 20 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Draw nose and whiskers
  drawNoseAndWhiskers(ctx, x, y, scale);
}

export function drawNoseAndWhiskers(ctx, x, y, scale) {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(x + 90 * scale, y + 40 * scale);
  ctx.lineTo(x + 80 * scale, y + 60 * scale);
  ctx.lineTo(x + 100 * scale, y + 60 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const whiskers = [
    [40, 40, 10, 40],
    [40, 50, 10, 50],
    [140, 40, 170, 40],
    [140, 50, 170, 50]
  ];
  whiskers.forEach(([x1, y1, x2, y2]) => {
    ctx.moveTo(x + x1 * scale, y + y1 * scale);
    ctx.lineTo(x + x2 * scale, y + y2 * scale);
  });
  ctx.stroke();

  ctx.font = '15px "SF Toontime"';
  ctx.fillStyle = 'red';
  ctx.fillText('KATZ!', x + 35 * scale, y + 90 * scale);
}

export function drawClawSignature(ctx, x = 410, y = 470, size = 8) {
  const scratchOffsets = [-20, -5, 10, 20];

  scratchOffsets.forEach(offset => {
    const gradient = ctx.createLinearGradient(
      x + offset, y - size * 2,
      x + offset, y + size * 3
    );
    gradient.addColorStop(0, 'rgba(255, 65, 65, 0)');
    gradient.addColorStop(0.2, '#FF0000');
    gradient.addColorStop(0.8, '#FF0000');
    gradient.addColorStop(1, 'rgba(255, 65, 65, 0)');

    ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;

    drawClawScratch(ctx, x + offset, y, size);
  });

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Add signature text
  ctx.shadowBlur = 20;
  ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
  ctx.font = 'italic 14px "SF Toontime"';
  ctx.fillStyle = 'yellow';
  ctx.fillText('Meme Trechor Level 1: Square up anon...', 250, y + 750);
}

export function drawClawScratch(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size * 2);
  
  for (let i = y - size * 2; i < y + size * 3; i += size / 2) {
    const variation = (Math.random() * size * 0.6) - size * 0.2;
    ctx.lineTo(x + variation, i + size / 2);
  }
  
  ctx.stroke();
  ctx.closePath();

  // Thicker middle section
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + size * 2);
  ctx.stroke();
  ctx.closePath();
}

export async function drawTimestamp(ctx, helmetPath) {
  const options = {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  const timestamp = new Date().toLocaleString('en-US', options);
  
  if (!helmetPath) {
    throw new Error('Helmet image path is required');
  }
  
  const helmetImage = await loadImage(helmetPath);
  const x = 330;
  const y = 1200;
  const iconSize = 32;
  
  ctx.drawImage(helmetImage, x, y - iconSize, iconSize, iconSize);
  
  ctx.font = 'italic 14px "SF Toontime"';
  ctx.fillStyle = '#00FF00';
  ctx.fillText(timestamp, x + iconSize + 40, y + iconSize - 40);
}