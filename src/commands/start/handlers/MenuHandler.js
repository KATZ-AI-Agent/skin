export class MenuHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async showMainMenu(chatId) {
    const keyboard = {
      keyboard: [
        ['🎭 Meme Analysis', '💰 Investment Advice'],
        ['📊 Vet Meme Loans', '🔥 Trending Tokens'],
        ['🔍 Scan Token', '⚠️ Rug Reports'],
        ['💊 Pump.fun', '👛 Wallets'],
        ['⚙️ Settings', '❓ Help']
      ],
      resize_keyboard: true
    };

    await this.bot.sendMessage(chatId, 'Select an option:', {
      reply_markup: keyboard
    });
  }

  async showWelcomeMessage(chatId, username, isNewUser) {
    const message = isNewUser ?
      `*Say "Hey to KATZ!" to bother him* 🐈‍⬛\n\n` +
      `*${username.toUpperCase()}*, ready for the trenches? 🌳🌍🕳️\n\n` +
      `_Intelligent & autonomous meme trading..._ 🤖💎\n\n` +
      `Need help? Type /help or /start over.` :
      `*Welcome Back ${username.toUpperCase()}!* 🐈‍⬛\n\n` +
      `Ready for the trenches? 🌳🕳️\n\n` +
      `_Let's find gems..._ 💎\n\n` +
      `Need help? Type /help or /start over.`;

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Let\'s Go!', callback_data: 'start_menu' }
        ]]
      }
    });
  }
}