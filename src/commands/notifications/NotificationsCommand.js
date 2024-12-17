import { Command } from '../base/Command.js';
import { PriceAlert } from '../../models/PriceAlert.js';
import { TimedOrder } from '../../models/TimedOrder.js';
import { User } from '../../models/User.js';
import { notificationService } from '../../services/notifications.js';
import { createCanvas, loadImage } from 'canvas';
import { ErrorHandler } from '../../core/errors/index.js';

export class NotificationsCommand extends Command {
  constructor(bot, eventHandler) {
    super(bot, eventHandler);
    this.command = '/notifications';
    this.description = 'Manage, view, and share notifications visually';
    this.pattern = /^(\/notifications|🔔 Notifications)$/;
    
    this.eventHandler = eventHandler;

    this.registerCallbacks();
  }

  registerCallbacks() {
    this.eventHandler.on('notifications_menu', this.showNotificationsMenu.bind(this));
    this.eventHandler.on('price_alerts', this.showPriceAlerts.bind(this));
    this.eventHandler.on('reminders', this.showReminders.bind(this));
    this.eventHandler.on('timed_orders', this.showTimedOrders.bind(this));
    this.eventHandler.on('notification_settings', this.showNotificationSettings.bind(this));
    this.eventHandler.on('share_notification', this.handleShareNotification.bind(this));
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showNotificationsMenu(chatId);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showNotificationsMenu(chatId) {
    const keyboard = this.createKeyboard([
      [{ text: '💰 Price Alerts', callback_data: 'price_alerts' }],
      [{ text: '⏰ Reminders', callback_data: 'reminders' }],
      [{ text: '⚡ Timed Orders', callback_data: 'timed_orders' }],
      [{ text: '🔗 Share Notification', callback_data: 'share_notification' }],
      [{ text: '⚙️ Settings', callback_data: 'notification_settings' }],
      [{ text: '↩️ Back to Menu', callback_data: '/start' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Notifications Center* 🔔\n\n' +
        'Manage, view, and share your notifications:\n\n' +
        '• Price alerts\n' +
        '• Trading reminders\n' +
        '• Timed orders\n' +
        '• Custom settings\n' +
        '• Share notifications with others',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  async renderNotificationsAsCanvas(notifications, title) {
    const canvasWidth = 800;
    const canvasHeight = Math.max(600, 150 + notifications.length * 40);
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.font = 'bold 40px ToonFont';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvasWidth / 2, 60);

    ctx.font = '20px ToonFont';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#555';
    notifications.forEach((notif, index) => {
      ctx.fillText(`${index + 1}. ${notif}`, 40, 120 + index * 40);
    });

    ctx.font = 'italic 16px ToonFont';
    ctx.textAlign = 'center';
    ctx.fillText('Generated via NotificationsCommand', canvasWidth / 2, canvasHeight - 30);

    return canvas.toBuffer('image/png');
  }

  async showPriceAlerts(chatId) {
    try {
      const alerts = await PriceAlert.find({ userId: chatId });
      if (!alerts.length) {
        await this.bot.sendMessage(chatId, 'No active price alerts found. Create one from settings.');
        return;
      }

      const alertList = alerts.map(alert => `${alert.token}: ${alert.price} (${alert.direction === 'above' ? '🔼' : '🔽'})`);
      const canvasBuffer = await this.renderNotificationsAsCanvas(alertList, 'Price Alerts');
      await this.bot.sendPhoto(chatId, canvasBuffer, { caption: '*Your Price Alerts* 💰', parse_mode: 'Markdown' });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showReminders(chatId) {
    try {
      const reminders = await notificationService.getReminders(chatId);
      if (!reminders.length) {
        await this.bot.sendMessage(chatId, 'No active reminders found. Set one up from settings.');
        return;
      }

      const reminderList = reminders.map(reminder => `${reminder.text} at ${new Date(reminder.time).toLocaleString()}`);
      const canvasBuffer = await this.renderNotificationsAsCanvas(reminderList, 'Reminders');
      await this.bot.sendPhoto(chatId, canvasBuffer, { caption: '*Your Reminders* ⏰', parse_mode: 'Markdown' });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showTimedOrders(chatId) {
    try {
      const orders = await TimedOrder.find({ userId: chatId });
      if (!orders.length) {
        await this.bot.sendMessage(chatId, 'No active timed orders found. Set one up from settings.');
        return;
      }

      const orderList = orders.map(order => `${order.token} ${order.action} ${order.amount} at ${new Date(order.executeAt).toLocaleString()}`);
      const canvasBuffer = await this.renderNotificationsAsCanvas(orderList, 'Timed Orders');
      await this.bot.sendPhoto(chatId, canvasBuffer, { caption: '*Your Timed Orders* ⚡', parse_mode: 'Markdown' });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleShareNotification(chatId) {
    try {
      await this.bot.sendMessage(
        chatId,
        '*Share Notifications* 🔗\n\n' +
          'Enter the username of the recipient (e.g., `@username`), type of notification, and expiration in hours:\n\n' +
          'Format: `@username type expiration` (e.g., `@friend price_alerts 24`)',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'notifications_menu' }]] }
        }
      );

      this.setState(chatId, 'WAITING_SHARE_INPUT');
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleInput(msg) {
    const state = await this.getState(msg.chat.id);
    const chatId = msg.chat.id;

    if (state === 'WAITING_SHARE_INPUT') {
      await this.processShareNotification(chatId, msg.text);
    }
  }

  async processShareNotification(chatId, input) {
    try {
      const [username, type, expiration] = input.trim().split(' ');
      if (!username || !type || isNaN(expiration) || expiration <= 0) {
        throw new Error('Invalid format. Use `@username type expiration` (e.g., `@friend price_alerts 24`).');
      }

      const recipient = await User.findOne({ username: username.replace('@', '') });
      if (!recipient) throw new Error('Recipient not found.');

      const expirationDate = new Date(Date.now() + expiration * 60 * 60 * 1000);

      const notifications =
        type === 'price_alerts'
          ? await PriceAlert.find({ userId: chatId })
          : type === 'reminders'
          ? await notificationService.getReminders(chatId)
          : type === 'timed_orders'
          ? await TimedOrder.find({ userId: chatId })
          : null;

      if (!notifications || !notifications.length) throw new Error(`No ${type} found to share.`);

      await Promise.all(
        notifications.map(notification =>
          notificationService.shareNotification(chatId, recipient._id, notification, type, expirationDate)
        )
      );

      await this.bot.sendMessage(chatId, `✅ ${type} successfully shared with ${username} for ${expiration} hours!`);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    } finally {
      await this.clearState(chatId);
    }
  }

  async showNotificationSettings(chatId) {
    try {
      const user = await User.findOne({ telegramId: chatId.toString() });
      if (!user) {
        await this.bot.sendMessage(chatId, 'User not found. Please register with /start.');
        return;
      }

      const settings = user.notificationSettings || {};
      const keyboard = this.createKeyboard([
        [
          { text: `Price Alerts: ${settings.priceAlerts ? 'ON' : 'OFF'}`, callback_data: 'toggle_price_alerts' },
          { text: `Reminders: ${settings.reminders ? 'ON' : 'OFF'}`, callback_data: 'toggle_reminders' }
        ],
        [
          { text: `Timed Orders: ${settings.timedOrders ? 'ON' : 'OFF'}`, callback_data: 'toggle_timed_orders' },
          { text: `Global: ${settings.global ? 'ON' : 'OFF'}`, callback_data: 'toggle_global_notifications' }
        ],
        [{ text: '↩️ Back to Notifications', callback_data: 'notifications_menu' }]
      ]);

      await this.bot.sendMessage(chatId, `*Notification Settings* ⚙️\n\nCustomize your notification preferences:`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }
}
