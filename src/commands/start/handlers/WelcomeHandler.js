import { createCanvas } from '@napi-rs/canvas';
import { WELCOME_MESSAGES, REGISTRATION_MESSAGES } from '../../../core/constants.js';

export class WelcomeHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async showWelcome(chatId) {
    const startMessage = `
🐈‍⬛ *KATZ - Autonomous Trench Agent...* 🐈‍⬛

_AI trench pawtner on Eth, Base, SOL_ 

🔍 *Personal meme trading agent:* 😼
• 🦴 Meme Analysis
• 🦴 AI Ape Suggestions
• 🦴 AI Loan Matching
• 🦴 Token Scanning
• 🦴 Autonomous Voice Trading
• 🦴 Pump.fun, Moonshot and more...

🐕 *Origins:* Courage The Cowardly Dog (meme)
`.trim();

    await this.bot.sendAnimation(
      chatId,
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2JkenYycWk0YjBnNXhhaGliazI2dWxwYm94djNhZ3R1dWhsbmQ2MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xouqS1ezHDrNkhPWMI/giphy.gif',
      {
        caption: startMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }
    );

    await this.showRegistrationPrompt(chatId);
  }

  async showRegistrationPrompt(chatId) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '🎯 Register Now', callback_data: 'register_user' }],
        [{ text: '❌ Cancel', callback_data: 'cancel_registration' }]
      ]
    };

    await this.bot.sendMessage(
      chatId,
      REGISTRATION_MESSAGES.PROMPT,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  getWelcomeMessage(username, isNewUser = false) {
    const template = isNewUser ? WELCOME_MESSAGES.NEW_USER : WELCOME_MESSAGES.RETURNING_USER;
    return template.replace('{username}', username);
  }
}