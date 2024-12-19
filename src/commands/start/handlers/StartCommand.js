import { BaseCommand } from '../../base/BaseCommand.js';
import { User } from '../../../models/User.js';
import { networkState } from '../../../services/networkState.js';
import { WelcomeHandler } from './WelcomeHandler.js';
import { RegistrationHandler } from './RegistrationHandler.js';
import { MenuHandler } from './MenuHandler.js';
import { USER_STATES } from '../../../core/constants.js';
import { ErrorHandler } from '../../../core/errors/index.js';

export class StartCommand extends BaseCommand {
  constructor(bot, eventHandler) {
    super(bot);
    this.command = '/start';
    this.description = 'Start the bot';
    this.pattern = /^\/start$/;

    if (!eventHandler) {
      throw new Error('Event handler is required for StartCommand');
    }

    this.eventHandler = eventHandler;

    // Initialize handlers
    this.welcomeHandler = new WelcomeHandler(bot);
    this.registrationHandler = new RegistrationHandler(bot);
    this.menuHandler = new MenuHandler(bot);

    // Register event callbacks
    this.registerCallbacks();
  }

  registerCallbacks() {
    // Register events for centralized handling
    this.eventHandler.on('register_user', async (query) => {
      await this.safeHandle(() => this.handleRegistration(query), query.message.chat.id);
    });

    this.eventHandler.on('cancel_registration', async (query) => {
      await this.safeHandle(() => this.handleCancelRegistration(query), query.message.chat.id);
    });

    this.eventHandler.on('start_menu', async (query) => {
      await this.safeHandle(() => this.handleStartMenu(query), query.message.chat.id);
    });

    this.eventHandler.on('retry_start', async (query) => {
      await this.safeHandle(() => this.retryStart(query), query.message.chat.id);
    });
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    await this.safeHandle(() => this.handleStart(chatId, msg.from), chatId);
  }

  async handleStart(chatId, userInfo) {
    await this.clearState(userInfo.id);

    const currentNetwork = await networkState.getCurrentNetwork(userInfo.id);
    const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();

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

Chain: *${networkState.getNetworkDisplay(currentNetwork)}*
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

    if (!user) {
      await this.showRegistrationPrompt(chatId);
      await this.setState(userInfo.id, USER_STATES.AWAITING_REGISTRATION);
    } else {
      await this.menuHandler.showWelcomeMessage(chatId, userInfo.username, false);
    }
  }

  async showRegistrationPrompt(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '🎯 Register Now', callback_data: 'register_user' }],
      [{ text: '❌ Cancel', callback_data: 'cancel_registration' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      `*🆕 First Time?...*\n\n` +
        `_Let's get you set up with your own secure wallets and access to all KATZ features!_\n\n` +
        `• Secure wallet creation\n` +
        `• Multi-chain trenching\n` +
        `• AI-powered trading\n` +
        `• And much more...\n\n` +
        `Ready to start? 🚀`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async handleRegistration(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    const state = await this.getState(userInfo.id);
    if (state === USER_STATES.AWAITING_REGISTRATION) {
      await this.registrationHandler.handleRegistration(chatId, userInfo);
    } else {
      await this.bot.sendMessage(chatId, '🛑 You are already registered or in another state.');
    }
  }

  async handleCancelRegistration(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    await this.bot.sendMessage(chatId, '❌ Registration cancelled. Use /start when you\'re ready to begin.');
    await this.clearState(userInfo.id);
  }

  async handleStartMenu(query) {
    const chatId = query.message.chat.id;
    await this.menuHandler.showMainMenu(chatId);
  }

  async retryStart(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    await this.handleStart(chatId, userInfo);
  }

  async handleCallback(query) {
    const action = query.data;
    const chatId = query.message.chat.id;

    const handled = this.eventHandler.emit(action, query);

    if (!handled) {
      console.warn(`Unhandled callback action: ${action}`);
    }
  }

  async safeHandle(fn, chatId) {
    try {
      await fn();
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }
}
