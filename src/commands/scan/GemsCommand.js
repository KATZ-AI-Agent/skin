import { Command } from '../base/Command.js';
import { gemsService } from '../../services/gems/GemsService.js';
import { GemScan } from '../../models/GemScan.js';
import { User } from '../../models/User.js';
import { createCanvas } from 'canvas';
import { format } from 'date-fns';
import { ErrorHandler } from '../../core/errors/index.js';

export class GemsCommand extends Command {
  constructor(bot, eventHandler) {
    super(bot, eventHandler);
    this.command = '/gems';
    this.description = 'View trending gems';
    this.pattern = /^(\/gems|💎 Gems Today)$/;
    
    this.eventHandler = eventHandler;
    this.registerCallbacks();
  }

  registerCallbacks() {
    this.eventHandler.on('view_gems', async (query) => this.showTodayGems(query));
    this.eventHandler.on('toggle_gems_notifications', async (query) =>
      this.toggleNotifications(query)
    );
    this.eventHandler.on('retry_gems', async (query) => this.retryGems(query));
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showGemsMenu(chatId, msg.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showGemsMenu(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const notificationsEnabled = user?.settings?.notifications?.gemsToday || false;

      const keyboard = this.createKeyboard([
        [{ text: '💎 View Today\'s Gems', callback_data: 'view_gems' }],
        [{
          text: `${notificationsEnabled ? '🔕 Disable' : '🔔 Enable'} Notifications`,
          callback_data: 'toggle_gems_notifications',
        }],
        [{ text: '↩️ Back to Scan', callback_data: 'back_to_scan' }],
      ]);

      await this.bot.sendMessage(
        chatId,
        '*Gems Today* 💎\n\n' +
          'Discover trending tokens with high social interest:\n\n' +
          '• Hourly scans across all chains\n' +
          '• Social media analysis\n' +
          '• Interest rating system\n' +
          `• Notifications: ${notificationsEnabled ? '✅' : '❌'}\n\n` +
          '_Note: This is an experimental feature based on social metrics._',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showTodayGems(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;
    const loadingMsg = await this.showLoadingMessage(chatId, '💎 Generating gems report...');

    try {
      const today = new Date().setHours(0, 0, 0, 0);
      const scan = await GemScan.findOne({ date: today }).lean();

      if (!scan || !scan.tokens.length) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
        await this.bot.sendMessage(
          chatId,
          'No gems found for today yet. Check back later!',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '↩️ Back', callback_data: 'retry_gems' },
              ]],
            },
          }
        );
        return;
      }

      const canvas = await this.generateGemsCanvas(scan.tokens.slice(0, 10));
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      await this.bot.sendPhoto(chatId, canvas.toBuffer(), {
        caption: '*Today\'s Top Gems* 💎\n\n' +
          `Last Updated: ${format(scan.scanTime, 'HH:mm')}\n\n` +
          '_Ratings based on social metrics & interest._',
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Refresh', callback_data: 'view_gems' },
            { text: '↩️ Back', callback_data: 'retry_gems' },
          ]],
        },
      });
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async generateGemsCanvas(tokens) {
      const canvas = createCanvas(800, 1200);
      const ctx = canvas.getContext('2d');

      // Draw Background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0d1117');
      gradient.addColorStop(1, '#1c1f26');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Logo and Title
      await this.drawLogoAndTitle(ctx);

      // Draw Token Information
      let y = 250; // Start drawing below the header
      for (const token of tokens) {
          this.drawTokenContainer(ctx, 50, y, 700, 100); // Draw container for each token
          this.drawTokenDetails(ctx, token, 70, y + 30);
          y += 130; // Move to the next section
      }

      // Add Footer with Timestamp
      this.drawFooter(ctx);

      return canvas;
  }

  async drawLogoAndTitle(ctx) {
      const logoPath = path.resolve(__dirname, '../../../assets/images/logo.png');
      const logo = await loadImage(logoPath);

      // Draw logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(400, 100, 50, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, 350, 50, 100, 100);
      ctx.restore();

      // Draw title
      ctx.font = 'bold 36px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('Today\'s Top Gems 💎', 400, 200);
  }

  drawTokenContainer(ctx, x, y, width, height) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.roundRect(x, y, width, height, 15); // Draw rounded rectangle
      ctx.fill();
      ctx.stroke();
  }

  drawTokenDetails(ctx, token, x, y) {
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(token.symbol, x, y);

      ctx.font = '16px Arial';
      ctx.fillStyle = '#ccc';
      ctx.fillText(this.formatAddress(token.address), x, y + 25);

      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#ff7b72';
      ctx.textAlign = 'right';
      ctx.fillText(`Rating: ${token.metrics.rating}/10`, x + 650, y + 10);
      ctx.fillStyle = '#c9d1d9';
      ctx.fillText(
          `👁 ${token.metrics.impressions} | ♥️ ${token.metrics.likes} | 🔄 ${token.metrics.retweets}`,
          x + 650,
          y + 40
      );
  }

  drawFooter(ctx) {
      const timestamp = format(new Date(), 'PPpp');
      ctx.font = 'italic 14px Arial';
      ctx.fillStyle = '#58a6ff';
      ctx.textAlign = 'center';
      ctx.fillText(`Report generated on: ${timestamp}`, 400, 1180);
  }

  formatAddress(address) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  async toggleNotifications(query) {
    const chatId = query.message.chat.id;
    const userInfo = query.from;

    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const newState = !user?.settings?.notifications?.gemsToday;

      await User.updateOne(
        { telegramId: userInfo.id.toString() },
        { $set: { 'settings.notifications.gemsToday': newState } }
      );

      await this.bot.sendMessage(
        chatId,
        `✅ Gems notifications ${newState ? 'enabled' : 'disabled'} successfully!`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '↩️ Back', callback_data: 'retry_gems' },
            ]],
          },
        }
      );
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async retryGems(query) {
    const chatId = query.message.chat.id;
    try {
      await this.showGemsMenu(chatId, query.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
