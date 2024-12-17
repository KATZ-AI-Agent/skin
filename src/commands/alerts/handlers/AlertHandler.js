import { PriceAlert } from '../../../models/PriceAlert.js';
import { networkState } from '../../../services/networkState.js';
import { dextools } from '../../../services/dextools/index.js';
import { walletService } from '../../../services/wallet/index.js';

export class AlertHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handlePriceInput(chatId, input, userInfo) {
    try {
      const [address, price, condition = 'above'] = input.split(' ');
      const network = await networkState.getCurrentNetwork(userInfo.id);

      if (!address || !price || isNaN(price)) {
        throw new Error('Invalid input format');
      }

      const tokenInfo = await dextools.getTokenInfo(network, address.trim());
      const currentPrice = await dextools.getTokenPrice(network, address.trim());

      const pendingAlert = {
        tokenAddress: address.trim(),
        tokenInfo,
        targetPrice: parseFloat(price),
        condition: condition.toLowerCase(),
        network,
        currentPrice
      };

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Enable Auto-Swap', callback_data: 'enable_swap' },
            { text: '⏭️ Skip', callback_data: 'skip_swap' }
          ],
          [{ text: '❌ Cancel', callback_data: 'back_to_price_alerts' }]
        ]
      };

      await this.bot.sendMessage(
        chatId,
        '*Price Alert Details* 📊\n\n' +
        `Token: ${tokenInfo.symbol}\n` +
        `Current Price: $${currentPrice}\n` +
        `Target Price: $${price}\n` +
        `Condition: ${condition}\n\n` +
        'Would you like to enable auto-swap when the alert triggers?',
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        }
      );

      return pendingAlert;
    } catch (error) {
      console.error('Error handling price input:', error);
      throw error;
    }
  }

  async handleEnableSwap(chatId, userInfo, tokenAddress, walletAddress, amount) {
    const wallet = await walletService.getActiveWallet(userInfo.id);
    
    if (!wallet) {
      await this.bot.sendMessage(
        chatId,
        '❌ Please select or create a wallet first.',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '👛 Go to Wallets', callback_data: '/wallets' }
            ]]
          }
        }
      );
      return;
    }

    if (wallet.type === 'walletconnect') {
      const approvalStatus = await walletService.checkAndRequestApproval(
        tokenAddress,
        walletAddress,
        amount
      );
      if (!approvalStatus.approved) {
        throw new Error('Token approval required');
      }
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📈 Buy', callback_data: 'swap_buy' },
          { text: '📉 Sell', callback_data: 'swap_sell' }
        ],
        [{ text: '❌ Cancel', callback_data: 'back_to_price_alerts' }]
      ]
    };

    await this.bot.sendMessage(
      chatId,
      '*Auto-Swap Settings* ⚙️\n\n' +
      'Choose the swap action that will be performed when price triggers:',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }

  async savePriceAlert(chatId, userInfo, alertData) {
    try {
      const alert = new PriceAlert({
        userId: userInfo.id.toString(),
        tokenAddress: alertData.tokenAddress,
        network: alertData.network,
        targetPrice: alertData.targetPrice,
        condition: alertData.condition,
        isActive: true,
        swapAction: alertData.swapAction,
        walletAddress: alertData.walletAddress,
        walletType: alertData.walletType
      });

      await alert.save();

      let message = '✅ Price alert created!\n\n' +
                   `Token: ${alertData.tokenInfo.symbol}\n` +
                   `Target Price: $${alertData.targetPrice}\n` +
                   `Condition: ${alertData.condition}\n` +
                   `Network: ${networkState.getNetworkDisplay(alert.network)}`;

      if (alert.swapAction?.enabled) {
        message += `\n\nAuto-${alert.swapAction.type} will execute when triggered`;
        if (alertData.walletType === 'walletconnect') {
          message += '\n\n⚠️ _You will need to approve the transaction when triggered_';
        }
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 View Alerts', callback_data: 'view_price_alerts' },
            { text: '↩️ Back', callback_data: 'back_to_notifications' }
          ]]
        }
      });

      return alert;
    } catch (error) {
      console.error('Error saving price alert:', error);
      throw error;
    }
  }
}