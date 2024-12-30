import { walletService } from '../../../services/wallet/index.js';
import { tokenService } from '../../../services/wallet/TokenService.js';
import { tradeService } from '../../../services/trading/TradeService.js';
import { formatBalance, formatAddress } from '../utils/formatters.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import { USER_STATES } from '../../../core/constants.js';

export class SendTokenHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async initiateSendToken(chatId, userInfo, tokenData) {
    try {
      const [tokenAddress, walletAddress] = tokenData.split('_');
      const wallet = await walletService.getWallet(userInfo.id, walletAddress);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const token = await tokenService.getTokenInfo(wallet.network, tokenAddress);
      let balance;

      if (wallet.network === 'solana') {
        const balances = await tokenService.getSolanaTokenBalances(walletAddress);
        const tokenBalance = balances.find(t => t.address === tokenAddress);
        balance = tokenBalance?.balance || '0';
      } else {
        const balances = await tokenService.getEvmTokenBalances(wallet.network, walletAddress);
        const tokenBalance = balances.find(t => t.address === tokenAddress);
        balance = tokenBalance?.balance || '0';
      }

      // Store send token data in user state
      await this.setUserData(userInfo.id, {
        sendToken: {
          tokenAddress,
          walletAddress,
          network: wallet.network,
          symbol: token.symbol,
          balance
        }
      });

      await this.setState(userInfo.id, USER_STATES.WAITING_SEND_ADDRESS);

      const message = `*Send ${token.symbol}* 📤\n\n` +
                     `Available Balance: ${formatBalance(balance)}\n\n` +
                     `Please enter the recipient's address:`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: `token_${tokenAddress}_${walletAddress}` }
          ]]
        }
      });

      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  async handleAddressInput(chatId, userInfo, address) {
    try {
      const userData = await this.getUserData(userInfo.id);
      if (!userData?.sendToken) {
        throw new Error('Send token data not found');
      }

      // Validate address based on network
      if (!this.isValidAddress(address, userData.sendToken.network)) {
        throw new Error('Invalid address format');
      }

      // Update send token data
      userData.sendToken.recipientAddress = address;
      await this.setUserData(userInfo.id, userData);

      // Ask for amount
      await this.setState(userInfo.id, USER_STATES.WAITING_SEND_AMOUNT);

      const message = `*Send ${userData.sendToken.symbol}* 📤\n\n` +
                     `To: \`${formatAddress(address)}\`\n` +
                     `Available: ${formatBalance(userData.sendToken.balance)}\n\n` +
                     `Please enter the amount to send:`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: `token_${userData.sendToken.tokenAddress}_${userData.sendToken.walletAddress}` }
          ]]
        }
      });

      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  async handleAmountInput(chatId, userInfo, amount) {
    try {
      const userData = await this.getUserData(userInfo.id);
      if (!userData?.sendToken) {
        throw new Error('Send token data not found');
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Invalid amount');
      }

      if (numAmount > parseFloat(userData.sendToken.balance)) {
        throw new Error('Insufficient balance');
      }

      // Update send token data
      userData.sendToken.amount = amount;
      await this.setUserData(userInfo.id, userData);

      // Show confirmation
      await this.showSendConfirmation(chatId, userData.sendToken);

      return true;
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  async showSendConfirmation(chatId, sendData) {
    const message = `*Confirm Transaction* ✅\n\n` +
                   `Token: ${sendData.symbol}\n` +
                   `Amount: ${formatBalance(sendData.amount)}\n` +
                   `To: \`${formatAddress(sendData.recipientAddress)}\`\n\n` +
                   `Please confirm the transaction:`;

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm_send_token' },
            { text: '❌ Cancel', callback_data: `token_${sendData.tokenAddress}_${sendData.walletAddress}` }
          ]
        ]
      }
    });
  }

  async executeSendToken(chatId, userInfo) {
    const loadingMsg = await this.bot.sendMessage(chatId, '📤 Sending tokens...');

    try {
      const userData = await this.getUserData(userInfo.id);
      if (!userData?.sendToken) {
        throw new Error('Send token data not found');
      }

      const { tokenAddress, walletAddress, recipientAddress, amount, network } = userData.sendToken;

      // Execute the transaction using the appropriate wallet service
      const result = await tradeService.executeTrade(network, {
        action: 'send',
        tokenAddress,
        amount,
        recipientAddress,
        walletAddress
      });

      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }

      // Show success message
      await this.bot.sendMessage(chatId,
        `✅ *Transaction Successful*\n\n` +
        `Sent ${formatBalance(amount)} ${userData.sendToken.symbol}\n` +
        `To: \`${formatAddress(recipientAddress)}\`\n\n` +
        `Hash: \`${result.hash}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '↩️ Back', callback_data: `token_${tokenAddress}_${walletAddress}` }
            ]]
          }
        }
      );

      // Clear user state
      await this.clearState(userInfo.id);

      return true;
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      await ErrorHandler.handle(error, this.bot, chatId);
      throw error;
    }
  }

  isValidAddress(address, network) {
    try {
      if (network === 'solana') {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      } else {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      }
    } catch {
      return false;
    }
  }
}