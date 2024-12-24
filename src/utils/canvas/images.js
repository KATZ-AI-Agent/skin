import { createCanvas, Image } from 'canvas';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const imageCache = new Map();

/**
 * Load an image from a file path or buffer
 * @param {string|Buffer} source - Image source (file path or buffer)
 * @returns {Promise<Image>} - Loaded image
 */
export async function loadImage(source) {
  try {
    // Return cached image if available
    if (imageCache.has(source)) {
      console.log('✅ Returning cached image');
      return imageCache.get(source);
    }

    let buffer;
    if (Buffer.isBuffer(source)) {
      console.log('📦 Using provided buffer');
      buffer = source;
    } else if (typeof source === 'string') {
      // Handle different path formats
      let absolutePath;
      if (path.isAbsolute(source)) {
        absolutePath = source;
      } else if (source.startsWith('./') || source.startsWith('../')) {
        absolutePath = path.resolve(__dirname, source);
      } else {
        absolutePath = path.join(PROJECT_ROOT, source);
      }

      console.log('🔍 Attempting to load image from:', absolutePath);
      
      try {
        await fs.access(absolutePath);
        buffer = await fs.readFile(absolutePath);
        console.log('✅ Successfully read image file');
      } catch (error) {
        console.error(`❌ Failed to access image at: ${absolutePath}`);
        console.error('Error details:', error);
        throw new Error(`Image file not found or inaccessible: ${absolutePath}`);
      }
    } else {
      throw new Error('Invalid image source: must be a file path or Buffer');
    }

    // Create and load the image
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        imageCache.set(source, img);
        console.log('✅ Image loaded and cached successfully');
        resolve(img);
      };
      
      img.onerror = (err) => {
        console.error('❌ Failed to load image:', err);
        reject(new Error(`Failed to load image: ${err.message}`));
      };

      img.src = buffer;
    });
  } catch (error) {
    console.error('❌ Error in loadImage:', error);
    throw error;
  }
}

/**
 * Clear the image cache
 */
export function clearImageCache() {
  imageCache.clear();
  console.log('✅ Image cache cleared');
}

/**
 * Validate and resolve an image path
 * @param {string} imagePath - Path to validate
 * @returns {string} - Resolved absolute path
 */
export function resolveImagePath(imagePath) {
  if (!imagePath) {
    throw new Error('Image path is required');
  }

  let absolutePath;
  if (path.isAbsolute(imagePath)) {
    absolutePath = imagePath;
  } else if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
    absolutePath = path.resolve(__dirname, imagePath);
  } else {
    absolutePath = path.join(PROJECT_ROOT, imagePath);
  }

  return absolutePath;
}