import { Command } from '../base/Command.js';
import { audioService } from '../../services/ai/speech.js';

export class VoiceHelperCommand extends Command {
  constructor(bot) {
    super(bot);
    this.command = '/voicehelp';
    this.description = 'Voice command guide';
    this.pattern = /^(\/voicehelp|🎤 Voice Guide)$/;
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    await this.showVoiceGuide(chatId);
  }

  async showVoiceGuide(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '🔍 Scanning & Analysis', callback_data: 'voice_scan_guide' }],
      [{ text: '💰 Trading & Orders', callback_data: 'voice_trade_guide' }],
      [{ text: '⚡ Price Alerts', callback_data: 'voice_alerts_guide' }],
      [{ text: '💎 Gems & Research', callback_data: 'voice_gems_guide' }],
      [{ text: '🤖 FlipperMode', callback_data: 'voice_flipper_guide' }],
      [{ text: '⚙️ Autonomy Settings', callback_data: 'voice_autonomy_guide' }],
      [{ text: '🎤 Voice Guide from KATZ!', callback_data: 'voice_guide_audio' }],
      [{ text: '↩️ Back to Help', callback_data: 'back_to_help' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Voice Command Guide* 🎤\n\n' +
      'Learn how to use voice commands for:\n\n' +
      '• Token scanning & analysis\n' +
      '• Trading & order placement\n' +
      '• Price alerts & monitoring\n' +
      '• Gems research & social analysis\n' +
      '• FlipperMode automation\n' +
      '• Autonomy settings\n\n' +
      'Select a category to learn more, or get a voice guide from KATZ!',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    const userInfo = query.from;

    try {
      switch (action) {
        case 'voice_scan_guide':
          await this.showScanGuide(chatId);
          return true;

        case 'voice_trade_guide':
          await this.showTradeGuide(chatId);
          return true;

        case 'voice_alerts_guide':
          await this.showAlertsGuide(chatId);
          return true;

        case 'voice_gems_guide':
          await this.showGemsGuide(chatId);
          return true;

        case 'voice_flipper_guide':
          await this.showFlipperGuide(chatId);
          return true;

        case 'voice_autonomy_guide':
          await this.showAutonomyGuide(chatId);
          return true;

        case 'voice_guide_audio':
          await this.sendVoiceGuide(chatId, userInfo);
          return true;

        case 'back_to_voice_help':
          await this.showVoiceGuide(chatId);
          return true;
      }
    } catch (error) {
      console.error('Error handling voice help action:', error);
      await this.showErrorMessage(chatId, error, 'retry_voice_help');
    }
    return false;
  }

  async sendVoiceGuide(chatId, userInfo) {
    const loadingMsg = await this.showLoadingMessage(chatId, '🎤 Generating voice guide...');

    try {
      const voiceText = `Hey ${userInfo.username || 'anon'}, KATZ here! Let me tell you how to use voice commands. 
        You can ask me to scan tokens, check social media, set up trades and alerts, or find new gems.
        For example, try saying "Scan PEPE and check social media" or "Buy 1 SOL of BONK and sell 50% at 2x, rest at 5x".
        Just remember, if you're using an external wallet, you'll need to approve transactions manually.
        And don't blame me if you get rekt! Now go make some meme magic happen!`;

      const audioFile = await audioService.textToSpeech(voiceText);

      await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      await this.bot.sendVoice(chatId, audioFile, {
        caption: '*Voice Guide from KATZ* 🎤\n\n' +
                'Listen to the guide or check the text sections above for detailed examples.',
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '↩️ Back to Guide', callback_data: 'back_to_voice_help' }
          ]]
        }
      });
    } catch (error) {
      console.error('Error sending voice guide:', error);
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await this.showErrorMessage(chatId, error, 'retry_voice_help');
    }
  }

  async showScanGuide(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Voice Guide', callback_data: 'back_to_voice_help' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Scanning & Analysis Voice Commands* 🔍\n\n' +
      '*Basic Scanning:*\n' +
      '• "Scan token <address>"\n' +
      '• "Check contract <address>"\n' +
      '• "Analyze <symbol>"\n\n' +
      '*Social Analysis:*\n' +
      '• "Check KOLs for <symbol>"\n' +
      '• "Show tweets about <symbol>"\n' +
      '• "What are people saying about <symbol>"\n\n' +
      '*Combined Analysis:*\n' +
      '• "Scan <symbol> and check social media"\n' +
      '• "Analyze <symbol> and show me tweets"\n' +
      '• "Check contract and KOLs for <symbol>"\n\n' +
      '_Example: "Scan PEPE and check social media"_',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  async showTradeGuide(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Voice Guide', callback_data: 'back_to_voice_help' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Trading & Orders Voice Commands* 💰\n\n' +
      '*Quick Trading:*\n' +
      '• "Buy <amount> <symbol>"\n' +
      '• "Sell <amount> <symbol>"\n' +
      '• "Swap <amount> for <symbol>"\n\n' +
      '*Timed Orders:*\n' +
      '• "Buy <amount> <symbol> at <time>"\n' +
      '• "Sell <amount> <symbol> tomorrow at 3pm"\n' +
      '• "Schedule buy of <amount> <symbol> in 2 hours"\n\n' +
      '*Multi-Target Orders:*\n' +
      '• "Sell 50% at 2x, 25% at 3x, rest at 5x"\n' +
      '• "Take profits: 30% at $1, 40% at $2, 30% at $3"\n' +
      '• "Scale out: 25% every 50% up"\n\n' +
      '*Note:* External wallets require manual approval for each transaction.\n\n' +
      '_Example: "Buy 1 SOL of BONK and sell 50% at 2x, rest at 5x"_',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  async showAlertsGuide(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Voice Guide', callback_data: 'back_to_voice_help' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Price Alerts Voice Commands* ⚡\n\n' +
      '*Simple Alerts:*\n' +
      '• "Alert me when <symbol> hits <price>"\n' +
      '• "Notify when <symbol> drops to <price>"\n' +
      '• "Tell me if <symbol> goes above <price>"\n\n' +
      '*Auto-Trading Alerts:*\n' +
      '• "Buy <amount> <symbol> when price drops to <price>"\n' +
      '• "Sell <amount> <symbol> when it reaches <price>"\n' +
      '• "Buy the dip if <symbol> drops 30%"\n\n' +
      '*Multiple Alerts:*\n' +
      '• "Alert me at $1, $2, and $3"\n' +
      '• "Buy 1 SOL at $0.5, sell 50% at $1, rest at $2"\n' +
      '• "Set alerts for every 10% move"\n\n' +
      '*Note:* External wallets require pre-approval for auto-trading alerts.\n\n' +
      '_Example: "Alert me when PEPE drops 30% and buy 2 SOL worth"_',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  async showGemsGuide(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Voice Guide', callback_data: 'back_to_voice_help' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Gems & Research Voice Commands* 💎\n\n' +
      '*Gems Discovery:*\n' +
      '• "Show me today\'s gems"\n' +
      '• "What gems are trending?"\n' +
      '• "Find new gems with high social interest"\n\n' +
      '*Research Queries:*\n' +
      '• "Research <symbol> on Twitter"\n' +
      '• "What\'s the sentiment on <symbol>?"\n' +
      '• "Find trending memes about <symbol>"\n\n' +
      '*Combined Actions:*\n' +
      '• "Show gems and analyze top 3"\n' +
      '• "Find gems and check their socials, search internet too"\n' +
      '• "Research <symbol> and set alert me when price is up 50%"\n\n' +
      '_Example: "Show me today\'s gems and analyze the top rated one"_',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  async showFlipperGuide(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Voice Guide', callback_data: 'back_to_voice_help' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*FlipperMode Voice Commands* 🤖\n\n' +
      '*Basic Controls:*\n' +
      '• "Start FlipperMode"\n' +
      '• "Stop FlipperMode"\n' +
      '• "Show FlipperMode status"\n\n' +
      '*Configuration:*\n' +
      '• "Set FlipperMode take profit to <percentage>"\n' +
      '• "Set FlipperMode stop loss to <percentage>"\n' +
      '• "Set FlipperMode buy amount to <amount>"\n\n' +
      '*Position Management:*\n' +
      '• "Show FlipperMode positions"\n' +
      '• "Close FlipperMode position <symbol>"\n' +
      '• "Adjust take profit for <symbol> to <percentage>"\n\n' +
      '*Important Notes:*\n' +
      '• Requires autonomous trading to be enabled\n' +
      '• Internal wallets recommended for best performance\n' +
      '• External wallets need manual approval for each trade\n' +
      '• Pre-approve tokens for selling with external wallets\n\n' +
      '_Example: "Start FlipperMode with 30% take profit and 15% stop loss"_',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  async showAutonomyGuide(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '↩️ Back to Voice Guide', callback_data: 'back_to_voice_help' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Autonomy Settings Guide* ⚙️\n\n' +
      '*Voice Commands:*\n' +
      '• "Enable autonomous trading"\n' +
      '• "Disable autonomous trading"\n' +
      '• "Show autonomy status"\n\n' +
      '*What\'s Affected:*\n' +
      '• Voice trading commands\n' +
      '• FlipperMode automation\n' +
      '• Price alert auto-trading\n' +
      '• Multi-target sell orders\n\n' +
      '*What\'s Not Affected:*\n' +
      '• Manual trading through menus\n' +
      '• Basic price alerts (without auto-trade)\n' +
      '• Token scanning & analysis\n' +
      '• Gems research\n\n' +
      '*Wallet Types:*\n' +
      '• Internal Wallets:\n' +
      '  - Full automation support\n' +
      '  - Automatic approvals\n' +
      '  - Recommended for automation\n\n' +
      '• External Wallets:\n' +
      '  - Requires manual approval\n' +
      '  - Pre-approve tokens for selling\n' +
      '  - Higher latency on executions\n\n' +
      '_Note: Enable autonomous trading in Settings or via voice command_',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }
}