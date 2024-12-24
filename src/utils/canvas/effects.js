import { createCanvas } from 'canvas';

export function applyGrainyFilter(ctx, width, height, alpha = 0.03) {
  const grainCanvas = createCanvas(width, height);
  const grainCtx = grainCanvas.getContext('2d');

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (Math.random() > 0.97) {
        const gray = Math.random() * 255;
        grainCtx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
        grainCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  ctx.drawImage(grainCanvas, 0, 0);
}

export function createGlassEffect(ctx, x, y, width, height, opacity = 0.2) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

export function createNeonGlow(ctx, text, x, y, color) {
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function createMetallicGradient(ctx, x, y, width, height) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, '#808080');
  gradient.addColorStop(0.5, '#C0C0C0');
  gradient.addColorStop(1, '#808080');
  return gradient;
}