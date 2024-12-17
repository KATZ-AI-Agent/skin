import { Command } from '../base/Command.js';

export class HelpCommand extends Command {
  constructor(bot) {
    super(bot);
    this.command = '/help';
    this.description = 'Show help menu';
    this.pattern = /^(\/help|❓ Help)$/;
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    await this.showHelpMenu(chatId);
  }

  async showHelpMenu(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '💱 Trading Features', callback_data: 'help_trading' }],
      [{ text: '👛 Wallet Management', callback_data: 'help_wallets' }],
      [{ text: '🤖 Automation & AI', callback_data: 'help_automation' }],
      [{ text: '🛡️ Encryption & Security', callback_data: 'help_encryption' }],
      [{ text: '⚙️ Advanced Architecture', callback_data: 'help_architecture' }],
      [{ text: '🌟 Multi-Level Swaps & Scenarios', callback_data: 'help_scenarios' }],
      [{ text: '↩️ Back to Menu', callback_data: '/start' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*KATZ! - Your All-in-One Trading Sidekick* 🐈‍⬛\n\n' +
        'AI-powered, voice-enabled, and built for resilience and speed.\n\n' +
        '*Key Features:*\n' +
        '• Autonomous trading with real-time updates.\n' +
        '• Multi-step trade scenarios and batch processing.\n' +
        '• Limit orders? Done. AI calculates and executes seamlessly.\n' +
        '• Voice-activated commands with precise execution.\n' +
        '• AI aware rug protection. Super fast websockets to sense dumps and act.\n\n' +
        '• Secure internal and external wallet management.\n' +
        '• Bank-grade encryption and data protection.\n' +
        '• Advanced architecture for reliability and speed.\n' +
        '• Flipper Mode for quick profit on pump tokens. Customize your strategies.\n' +
        '• Internet-linked searches and trends from X.\n\n' +
        '• Copy a KOL? Done. KATZ will buy when your delegated KOL tweets.\n' +
        '• Multi-LLM MCP Architecture: AI that scales, learns, and adapts to you.\n' +
        '• Built for expansion—more capabilities coming soon!\n\n' +
        'Select a category to explore more.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;

    try {
      switch (action) {
        case 'help_trading':
          await this.showTradingHelp(chatId);
          return true;

        case 'help_wallets':
          await this.showWalletsHelp(chatId);
          return true;

        case 'help_automation':
          await this.showAutomationHelp(chatId);
          return true;

        case 'help_encryption':
          await this.showEncryptionHelp(chatId);
          return true;

        case 'help_architecture':
          await this.showArchitectureHelp(chatId);
          return true;

        case 'help_scenarios':
          await this.showScenariosHelp(chatId);
          return true;

        case 'back_to_help':
          await this.showHelpMenu(chatId);
          return true;
      }
    } catch (error) {
      console.error('Error handling help action:', error);
      await this.showErrorMessage(chatId, error, 'back_to_help');
    }
    return false;
  }

  async showTradingHelp(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Help', callback_data: 'back_to_help' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Trading Features* 💱\n\n' +
        '• *Limit Orders*: Automate your trades at predefined price points.\n' +
        '• *Flipper Mode*: Ride pump launches and secure quick profits.\n' +
        '• *Price Alerts with Auto Swaps*: Get notified and let KATZ execute for you.\n' +
        '• *AI Market Predictions*: Make data-driven decisions in real time.\n' +
        '• *Batch Processing*: Analyze and trade multiple tokens in one go.\n\n' +
        '*Examples:*\n' +
        '• "Buy 1 SOL if it falls to $20, sell half at $40, and the rest at $200."\n' +
        '• "Set an alert for KATZ at $0.05 and auto-buy when triggered."\n' +
        '• "Flip all trending tokens on pump.fun for quick gains!"',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async showWalletsHelp(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Help', callback_data: 'back_to_help' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Wallet Management* 👛\n\n' +
        '• *Multi-Chain Support*: Seamlessly manage Ethereum, Solana, and Base.\n' +
        '• *Internal-External Transfers*: Move funds effortlessly between wallets.\n' +
        '• *WalletConnect Integration*: Sync your MetaMask, Trust Wallet, and others.\n' +
        '• *Google-Linked Services*: Use Drive and Calendar for trade tracking.\n' +
        '• *Real-Time Monitoring*: Track balances, transactions, and market trends live.\n' +
        '• *External Wallet Support*: Reown integration ensures seamless external connections.\n\n' +
        'Stay secure, connected, and in control of all your assets.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async showAutomationHelp(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Help', callback_data: 'back_to_help' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Automation & AI* 🤖\n\n' +
        '• *Batch Processing*: Handle multiple trades or analyses at once.\n' +
        '• *Auto-Trading*: AI-driven trades based on your predefined rules.\n' +
        '• *Context Awareness*: AI remembers your history for tailored insights.\n' +
        '• *Voice Navigation*: Trade hands-free with natural language commands.\n' +
        '• *AI Sleep Mode*: Pause automation to trade manually when preferred.\n\n' +
        '*Examples:*\n' +
        '• "Auto-sell 50% of my KATZ holdings if it doubles."\n' +
        '• "Batch analyze trending tokens and buy the top performers."\n' +
        '• "Use voice to execute trades or set alerts for me."',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async showEncryptionHelp(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Help', callback_data: 'back_to_help' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Encryption & Security* 🛡️\n\n' +
        '• *AES-256 Encryption*: Protects trades, wallet keys, and personal data.\n' +
        '• *Data Privacy First*: Ensures only you control your data.\n' +
        '• *Secure Multi-Wallet Sync*: Safely connect external wallets.\n' +
        '• *Encryption for Transfers*: Protects both internal and external transfers.\n\n' +
        'KATZ keeps your assets and personal data secure.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async showArchitectureHelp(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Help', callback_data: 'back_to_help' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Advanced Architecture* ⚙️\n\n' +
        '• *WebSocket Reliability*: Exponential backoff reconnects ensure uptime.\n' +
        '• *Circuit Breaking*: Prevents overloads and maintains smooth operation.\n' +
        '• *Database Caching*: Speeds up trades and queries with cached data.\n' +
        '• *Multi-LLM MCP Framework*: AI evolves with advanced scalable intelligence.\n' +
        '• *Scalable Processing*: Handles high trade volumes efficiently.\n\n' +
        'Engineered for speed, resilience, and advanced AI capabilities.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async showScenariosHelp(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Help', callback_data: 'back_to_help' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Multi-Level Swaps & Scenarios* 🌟\n\n' +
        '• *Natural Language Commands*: Build strategies easily with simple inputs.\n' +
        '• *Complex Multi-Step Trades*: Automate entire workflows.\n' +
        '• *Dynamic Scenarios*: Adjusts to real-time market conditions.\n' +
        '• *Batch Processing*: Execute multiple trades with a single command.\n\n' +
        '*Examples:*\n' +
        '• "Buy 1 SOL if it drops 30%, sell 50% at 100%, and the rest at 2000%."\n' +
        '• "Auto-buy trending tokens on Solana and flip at a 2x gain."\n' +
        '• "If KATZ drops 20%, buy $500 and hold until it pumps 5x."',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }
}
