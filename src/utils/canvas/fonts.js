import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { registerFont } from 'canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.resolve(__dirname, '../../../temp');

const FONT_PATHS = {
  'SF Toontime': '../../../assets/fonts/SF_Toontime.ttf',
  'SF Toontime Bold': '../../../assets/fonts/SF_Toontime_Bold.ttf',
  'SF Toontime Italic': '../../../assets/fonts/SF_Toontime_Italic.ttf',
  'SF Toontime Bold Italic': '../../../assets/fonts/SF_Toontime_Bold_Italic.ttf',
};

export async function loadFonts() {
  try {
    for (const [family, relativePath] of Object.entries(FONT_PATHS)) {
      const fontPath = path.resolve(__dirname, relativePath);
      const fontBuffer = await fs.readFile(fontPath);
      await loadFont(family, fontBuffer);
    }
    console.log('✅ Fonts loaded successfully');
  } catch (error) {
    console.error('❌ Error loading fonts:', error);
    throw error;
  }
}

export function getFontPath(fontFamily) {
  const fontPath = FONT_PATHS[fontFamily];
  if (!fontPath) {
    throw new Error(`Font family "${fontFamily}" not found`);
  }
  return path.resolve(__dirname, fontPath);
}

export async function loadFont(family, buffer) {
  try {
    // Ensure temp directory exists
    try {
      await fs.access(TEMP_DIR);
    } catch {
      await fs.mkdir(TEMP_DIR, { recursive: true });
    }
    
    const tempPath = path.join(TEMP_DIR, `${family.replace(/\s+/g, '_')}.ttf`);
    await fs.writeFile(tempPath, buffer);
    registerFont(tempPath, { family });
    console.log(`✅ Registered font: ${family}`);
  } catch (error) {
    console.error(`❌ Error loading font ${family}:`, error);
    throw error;
  }
}