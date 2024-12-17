import { BaseCommand } from '../base/BaseCommand.js';
import { timedOrderService } from '../../services/timedOrders.js';
import { User } from '../../models/User.js';
import { networkState } from '../../services/networkState.js';
import { dextools } from '../../services/dextools/index.js';
import { USER_STATES } from '../../core/constants.js';
import { format } from 'date-fns';
import { ErrorHandler } from '../../core/errors/index.js';

export class TimedOrdersCommand extends BaseCommand {
  constructor(bot, eventHandler) {
    super(bot);
    this.command = '/timedorders';
    this.description = 'Set timed orders';
    this.pattern = /^(\/timedorders|⚡ Timed Orders)$/;

    this.eventHandler = eventHandler;
    this.registerCallbacks();
  }

  registerCallbacks() {
    this.eventHandler.on('set_timed_order', async (query) => this.startOrderCreation(query.message.chat.id, query.from));
    this.eventHandler.on('view_active_orders', async (query) => this.showActiveOrders(query.message.chat.id, query.from));
    this.eventHandler.on('confirm_order', async (query) => this.handleOrderConfirmation(query.message.chat.id, query.from));
    this.eventHandler.on('cancel_order', async (query) => this.handleOrderCancellation(query.message.chat.id, query.from));
    this.eventHandler.on(/^order_delete_/, async (query) => {
      const orderId = query.data.replace('order_delete_', '');
      await this.confirmOrderDeletion(query.message.chat.id, orderId, query.from);
    });
    this.eventHandler.on(/^order_delete_confirm_/, async (query) => {
      const orderId = query.data.replace('order_delete_confirm_', '');
      await this.handleOrderDeletion(query.message.chat.id, orderId, query.from);
    });
  }

  async execute(msg) {
    try {
      const chatId = msg.chat.id;
      await this.showTimedOrdersMenu(chatId, msg.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, msg.chat.id);
    }
  }

  async showTimedOrdersMenu(chatId, userInfo) {
    const keyboard = this.createKeyboard([
      [{ text: '⚡ Set Auto Swap Order', callback_data: 'set_timed_order' }],
      [{ text: '📋 View Active Orders', callback_data: 'view_active_orders' }],
      [{ text: '↩️ Back', callback_data: 'back_to_notifications' }]
    ]);

    await this.bot.sendMessage(chatId, '*Timed Orders* ⚡\n\nSchedule automatic token swaps:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async startOrderCreation(chatId, userInfo) {
    try {
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      if (!user?.settings?.autonomousWallet?.address) {
        await this.bot.sendMessage(chatId, '❌ Please set up an autonomous wallet first in Settings.', {
          reply_markup: {
            inline_keyboard: [[{ text: '⚙️ Go to Settings', callback_data: 'settings' }]]
          }
        });
        return;
      }

      await this.setState(userInfo.id, USER_STATES.WAITING_ORDER_ADDRESS);
      await this.setUserData(userInfo.id, {
        pendingOrder: {
          step: 1,
          network: await networkState.getCurrentNetwork(userInfo.id)
        }
      });

      await this.bot.sendMessage(chatId, '*Step 1/5: Token Address* 📝\n\nPlease enter the token address:', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'back_to_timed_orders' }]]
        }
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleInput(msg) {
    try {
      const chatId = msg.chat.id;
      const state = await this.getState(msg.from.id);

      if (!state || !msg.text) return false;

      switch (state) {
        case USER_STATES.WAITING_ORDER_ADDRESS:
          await this.handleAddressInput(chatId, msg.text, msg.from);
          break;
        case USER_STATES.WAITING_ORDER_AMOUNT:
          await this.handleAmountInput(chatId, msg.text, msg.from);
          break;
        case USER_STATES.WAITING_ORDER_DATE:
          await this.handleDateInput(chatId, msg.text, msg.from);
          break;
        case USER_STATES.WAITING_ORDER_TIME:
          await this.handleTimeInput(chatId, msg.text, msg.from);
          break;
        default:
          break;
      }
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, msg.chat.id);
    }
  }

  async handleAddressInput(chatId, address, userInfo) {
    try {
      const userData = await this.getUserData(userInfo.id);
      const tokenInfo = await dextools.getTokenInfo(userData.pendingOrder.network, address.trim());
      userData.pendingOrder = { ...userData.pendingOrder, tokenAddress: address.trim(), tokenInfo, step: 2 };
      await this.setUserData(userInfo.id, userData);

      const keyboard = this.createKeyboard([
        [{ text: '📈 Buy', callback_data: 'order_action_buy' }, { text: '📉 Sell', callback_data: 'order_action_sell' }],
        [{ text: '❌ Cancel', callback_data: 'back_to_timed_orders' }]
      ]);

      await this.bot.sendMessage(chatId, `*Step 2/5: Select Action* 🎯\n\nToken: ${tokenInfo.symbol}\nChoose the action to perform:`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleAmountInput(chatId, amount, userInfo) {
    try {
      if (isNaN(amount) || parseFloat(amount) <= 0) {
        throw new Error('Invalid amount entered.');
      }

      const userData = await this.getUserData(userInfo.id);
      userData.pendingOrder = { ...userData.pendingOrder, amount: parseFloat(amount), step: 4 };
      await this.setUserData(userInfo.id, userData);
      await this.setState(userInfo.id, USER_STATES.WAITING_ORDER_DATE);

      await this.bot.sendMessage(chatId, '*Step 4/5: Enter Date* 📅\n\nEnter the date (DD/MM/YYYY):', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'back_to_timed_orders' }]]
        }
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleDateInput(chatId, date, userInfo) {
    try {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        throw new Error('Invalid date format.');
      }

      const userData = await this.getUserData(userInfo.id);
      userData.pendingOrder = { ...userData.pendingOrder, date, step: 5 };
      await this.setUserData(userInfo.id, userData);
      await this.setState(userInfo.id, USER_STATES.WAITING_ORDER_TIME);

      await this.bot.sendMessage(chatId, '*Step 5/5: Enter Time* ⏰\n\nEnter the time (HH:MM):', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'back_to_timed_orders' }]]
        }
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleTimeInput(chatId, time, userInfo) {
    try {
      if (!/^([01][0-9]|2[0-3]):([0-5][0-9])$/.test(time)) {
        throw new Error('Invalid time format.');
      }

      const userData = await this.getUserData(userInfo.id);
      const [day, month, year] = userData.pendingOrder.date.split('/');
      const [hours, minutes] = time.split(':');
      const executeAt = new Date(year, month - 1, day, hours, minutes);

      if (executeAt <= new Date()) {
        throw new Error('Execution time must be in the future.');
      }

      userData.pendingOrder.executeAt = executeAt;
      await this.setUserData(userInfo.id, userData);
      await this.showOrderConfirmation(chatId, userInfo);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showOrderConfirmation(chatId, userInfo) {
    try {
      const userData = await this.getUserData(userInfo.id);
      const { pendingOrder } = userData;

      const keyboard = this.createKeyboard([
        [{ text: '✅ Submit', callback_data: 'confirm_order' }, { text: '❌ Cancel', callback_data: 'back_to_timed_orders' }]
      ]);

      await this.bot.sendMessage(chatId, `*Order Confirmation* ✅\n\nToken: ${pendingOrder.tokenInfo.symbol}\nAction: ${pendingOrder.action}\nAmount: ${pendingOrder.amount}\nExecute at: ${format(pendingOrder.executeAt, 'PPpp')}\n\nPlease confirm your order:`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleOrderConfirmation(chatId, userInfo) {
    try {
      const userData = await this.getUserData(userInfo.id);
      const { pendingOrder } = userData;
      const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
      const walletAddress = user.settings.autonomousWallet.address;

      await timedOrderService.createOrder(userInfo.id, {
        walletAddress,
        tokenAddress: pendingOrder.tokenAddress,
        network: pendingOrder.network,
        action: pendingOrder.action,
        amount: pendingOrder.amount,
        executeAt: pendingOrder.executeAt
      });

      await this.bot.sendMessage(chatId, `✅ Order created successfully!\n\nToken: ${pendingOrder.tokenInfo.symbol}\nAction: ${pendingOrder.action}\nAmount: ${pendingOrder.amount}\nExecute at: ${format(pendingOrder.executeAt, 'PPpp')}`, {
        reply_markup: {
          inline_keyboard: [[{ text: '📋 View Orders', callback_data: 'view_active_orders' }, { text: '↩️ Back', callback_data: 'back_to_notifications' }]]
        }
      });

      await this.clearState(userInfo.id);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showActiveOrders(chatId, userInfo) {
    try {
      const orders = await timedOrderService.getActiveOrders(userInfo.id);

      if (!orders || orders.length === 0) {
        await this.bot.sendMessage(chatId, 'No active orders found.', {
          reply_markup: {
            inline_keyboard: [[{ text: '➕ Create Order', callback_data: 'set_timed_order' }, { text: '↩️ Back', callback_data: 'back_to_notifications' }]]
          }
        });
        return;
      }

      const ordersList = await Promise.all(orders.map(async (order, index) => {
        const tokenInfo = await dextools.getTokenInfo(order.network, order.tokenAddress);
        return `${index + 1}. ${tokenInfo.symbol}\n• Action: ${order.action}\n• Amount: ${order.amount}\n• Execute at: ${format(order.executeAt, 'PPpp')}\n`;
      }));

      const keyboard = {
        inline_keyboard: [
          ...orders.map((order, index) => [{ text: `🗑️ Delete Order #${index + 1}`, callback_data: `order_delete_${order._id}` }]),
          [{ text: '➕ Create Order', callback_data: 'set_timed_order' }, { text: '↩️ Back', callback_data: 'back_to_notifications' }]
        ]
      };

      await this.bot.sendMessage(chatId, `*Active Orders* 📋\n\n${ordersList.join('\n')}`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async confirmOrderDeletion(chatId, orderId, userInfo) {
    try {
      const order = await timedOrderService.getOrder(orderId);
      if (!order || order.userId !== userInfo.id.toString()) {
        throw new Error('Order not found');
      }

      const tokenInfo = await dextools.getTokenInfo(order.network, order.tokenAddress);
      const keyboard = this.createKeyboard([
        [{ text: '✅ Confirm Delete', callback_data: `order_delete_confirm_${orderId}` }, { text: '❌ Cancel', callback_data: 'view_active_orders' }]
      ]);

      await this.bot.sendMessage(chatId, `*Confirm Delete Order* ⚠️\n\nAre you sure you want to delete this order?\n\nToken: ${tokenInfo.symbol}\nAction: ${order.action}\nAmount: ${order.amount}\nExecute at: ${format(order.executeAt, 'PPpp')}`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async handleOrderDeletion(chatId, orderId, userInfo) {
    try {
      await timedOrderService.cancelOrder(userInfo.id, orderId);

      await this.bot.sendMessage(chatId, '✅ Order cancelled successfully!', {
        reply_markup: {
          inline_keyboard: [[{ text: '📋 View Orders', callback_data: 'view_active_orders' }, { text: '↩️ Back', callback_data: 'back_to_notifications' }]]
        }
      });
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }
}
