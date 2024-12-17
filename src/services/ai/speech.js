import { openAIService } from './openai.js';
import speech from 'speech-to-text';
import { promises as fs } from 'fs';

class AudioService {
  constructor() {
    this.tempDir = '/tmp';
  }

  /**
   * Convert speech audio buffer to text.
   * @param {Buffer} audioBuffer - The audio file buffer.
   * @returns {Promise<string>} - Recognized text.
   */
  async speechToText(audioBuffer) {
    try {
      const result = await speech.recognize(audioBuffer, {
        language: 'en-US',
      });
      return result.text;
    } catch (error) {
      console.error('Speech to text error:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech and return the generated audio file path.
   * @param {string} text - Text to be converted to speech.
   * @returns {Promise<string>} - Path to the generated audio file.
   */
  async textToSpeech(text) {
    try {
      const mp3Response = await openAIService.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
      });

      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      const tempFilePath = `${this.tempDir}/voice_${Date.now()}.mp3`;

      await fs.writeFile(tempFilePath, buffer);
      return tempFilePath;
    } catch (error) {
      console.error('Text to speech error:', error);
      throw error;
    }
  }

  /**
   * Clean up temporary audio files to free up space.
   * @param {string} filePath - Path to the temporary file.
   */
  async cleanupAudioFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`Temporary file deleted: ${filePath}`);
    } catch (error) {
      console.error('Error cleaning up audio file:', error);
    }
  }
}

export const audioService = new AudioService();
