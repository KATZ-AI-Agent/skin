import { openAIService } from './openai.js';
import { dextools } from '../dextools/index.js';
import { networkState } from '../networkState.js';
import { timedOrderService } from '../timedOrders.js';
import { PriceAlert } from '../../models/PriceAlert.js';
import { format } from 'date-fns';
import { User } from '../../models/User.js';
import { ErrorHandler } from '../../core/errors/index.js';

// Enhanced prompt for better command parsing
const TRADING_PROMPT = `You are a trading assistant parsing natural language commands.
Extract trading intent from user input. Return a JSON object with:

{
  "type": "order" | "alert" | "risk",
  "action": "buy" | "sell" | "monitor",
  "token": "<address or symbol>",
  "amount": "<number>",
  "timing": "now" | "<ISO date string>",
  "targetPrice": "<number or null>",
  "network": "<network name or null>",
  "riskCondition": "rug_pull" | "flash_crash" | null
}

Examples:
"Buy 1000 PEPE when it hits $0.001" ->
{
  "type": "alert",
  "action": "buy", 
  "token": "PEPE",
  "amount": "1000",
  "timing": "now",
  "targetPrice": "0.001",
  "riskCondition": null
}

"Monitor for rug pulls on PEPE" ->
{
  "type": "risk",
  "action": "monitor",
  "token": "PEPE",
  "amount": null,
  "timing": "now",
  "targetPrice": null,
  "riskCondition": "rug_pull"
}`;

export async function parseTradingCommand(input, userId) {
  try {
    const response = await openAIService.generateAIResponse(
      input,
      'trading_command'
    );

    const parsed = JSON.parse(response);

    // Resolve token address if symbol provided
    if (parsed.token && !parsed.token.startsWith('0x')) {
      const network = parsed.network || await networkState.getCurrentNetwork(userId);
      const tokenInfo = await dextools.getTokenInfo(network, parsed.token);
      if (!tokenInfo) {
        throw new Error(`Token ${parsed.token} not found`);
      }
      parsed.token = tokenInfo.address;
      parsed.tokenInfo = tokenInfo;
    }

    return parsed;
  } catch (error) {
    ErrorHandler.logAndThrow('Error parsing trading command', error);
  }
}

export async function handleTradingCommand(bot, chatId, userInfo, input) {
  const loadingMsg = await bot.sendMessage(chatId, '🤖 Processing trading command...');

  try {
    // Get user's autonomous wallet
    const user = await User.findOne({ telegramId: userInfo.id.toString() }).lean();
    if (!user?.settings?.autonomousWallet?.address) {
      throw new Error('Autonomous wallet not configured');
    }

    const parsed = await parseTradingCommand(input, userInfo.id);
    const network = parsed.network || await networkState.getCurrentNetwork(userInfo.id);

    // Subscribe to price updates for the token
    await dextools.subscribeToPriceUpdates(
      network,
      parsed.token,
      (price) => console.log(`Price update for ${parsed.token}: ${price}`)
    );

    if (parsed.type === 'alert') {
      await handlePriceAlert(bot, chatId, userInfo, parsed, user);
    } else if (parsed.type === 'order') {
      await handleTimedOrder(bot, chatId, userInfo, parsed, user); 
    } else if (parsed.type === 'risk') {
      await handleRiskMonitoring(bot, chatId, userInfo, parsed, user);
    }

  } catch (error) {
    ErrorHandler.handleWithUserNotification(bot, chatId, error, {
      wallet: 'Please configure your autonomous wallet in Settings first.',
      Token: 'Token not found. Please check the symbol or address.',
      default: 'Please try again or use the menu options.'
    });
  } finally {
    if (loadingMsg) {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    }
  }
}

async function handlePriceAlert(bot, chatId, userInfo, parsed, user) {
  try {
    const alert = new PriceAlert({
      userId: userInfo.id.toString(),
      tokenAddress: parsed.token,
      network: parsed.network || await networkState.getCurrentNetwork(userInfo.id),
      targetPrice: parseFloat(parsed.targetPrice),
      condition: parsed.action === 'buy' ? 'below' : 'above',
      isActive: true,
      swapAction: {
        enabled: true,
        type: parsed.action,
        amount: parsed.amount,
        walletAddress: user.settings.autonomousWallet.address
      }
    });

    await alert.save();

    await bot.sendMessage(
      chatId,
      '✅ Price alert created!\n\n' +
      `Token: ${parsed.tokenInfo?.symbol || parsed.token}\n` +
      `Target Price: $${parsed.targetPrice}\n` +
      `Action: Auto-${parsed.action} ${parsed.amount} when triggered\n` +
      `Network: ${networkState.getNetworkDisplay(alert.network)}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 View Alerts', callback_data: 'view_price_alerts' },
            { text: '↩️ Back', callback_data: 'back_to_notifications' }
          ]]
        }
      }
    );
  } catch (error) {
    ErrorHandler.logAndNotify('Error handling price alert', error);
  }
}

async function handleTimedOrder(bot, chatId, userInfo, parsed, user) {
  try {
    const order = await timedOrderService.createOrder(userInfo.id, {
      walletAddress: user.settings.autonomousWallet.address,
      tokenAddress: parsed.token,
      network: parsed.network || await networkState.getCurrentNetwork(userInfo.id),
      action: parsed.action,
      amount: parsed.amount,
      executeAt: new Date(parsed.timing)
    });

    await bot.sendMessage(
      chatId,
      '✅ Timed order created!\n\n' +
      `Token: ${parsed.tokenInfo?.symbol || parsed.token}\n` +
      `Action: ${parsed.action}\n` +
      `Amount: ${parsed.amount}\n` +
      `Execute at: ${format(order.executeAt, 'PPpp')}\n` +
      `Network: ${networkState.getNetworkDisplay(order.network)}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 View Orders', callback_data: 'view_active_orders' },
            { text: '↩️ Back', callback_data: 'back_to_notifications' }
          ]]
        }
      }
    );
  } catch (error) {
    ErrorHandler.logAndNotify('Error handling timed order', error);
  }
}

async function handleRiskMonitoring(bot, chatId, userInfo, parsed, user) {
  try {
    // Handle risk conditions like rug pulls and flash crashes
    const monitoringMessage = `✅ Monitoring for ${parsed.riskCondition} on token: ${parsed.tokenInfo?.symbol || parsed.token}`;

    // Assume dextools or a monitoring service has the appropriate method
    await dextools.monitorRisk(parsed.token, parsed.riskCondition);

    await bot.sendMessage(
      chatId,
      monitoringMessage,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 View Monitors', callback_data: 'view_risk_monitors' },
            { text: '↩️ Back', callback_data: 'back_to_notifications' }
          ]]
        }
      }
    );
  } catch (error) {
    ErrorHandler.logAndNotify('Error handling risk monitoring', error);
  }
}
