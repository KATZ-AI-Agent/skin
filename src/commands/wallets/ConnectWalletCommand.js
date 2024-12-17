import { Command } from '../base/Command.js';
import { walletConnectService } from '../../services/wallet/WalletConnect.js';
import { ErrorHandler } from '../../core/errors/index.js';

/**
 * JWT Tokens for Secure Session Management:
 *
 * - Every user session is protected with a JWT (JSON Web Token).
 * - Tokens are signed using a secret key and contain user-specific payloads.
 * - Tokens have a time-bound validity (e.g., 1 hour) to prevent session hijacking.
 * - Refresh mechanisms ensure valid tokens without user re-authentication.
 * - JWTs are validated at every critical operation for added security.
 */
export class ConnectWalletCommand extends Command {
  constructor(bot, eventHandler) {
    super(bot, eventHandler);
    this.command = '/connectwallet';
    this.description = 'Connect external wallet';
    this.pattern = /^(\/connectwallet|🔗 Connect Wallet)$/;
  }

  registerHandlers() {
    this.eventHandler.on('connect_wallet', async (data) => {
      const { chatId, userInfo } = data;
      try {
        await this.initiateWalletConnect(chatId, userInfo);
      } catch (error) {
        await ErrorHandler.handle(error, this.bot, chatId);
      }
    });

    this.eventHandler.on('disconnect_wallet', async (data) => {
      const { chatId, userInfo } = data;
      try {
        await this.disconnectWallet(chatId, userInfo);
      } catch (error) {
        await ErrorHandler.handle(error, this.bot, chatId);
      }
    });
  }

  async execute(msg) {
    const chatId = msg.chat.id;
    try {
      await this.showConnectOptions(chatId, msg.from);
    } catch (error) {
      await ErrorHandler.handle(error, this.bot, chatId);
    }
  }

  async showConnectOptions(chatId, userInfo) {
    const keyboard = this.createKeyboard([
      [{ text: '🔗 Connect with Reown', callback_data: 'connect_wallet' }],
      [{ text: '❌ Cancel', callback_data: 'back_to_wallets' }],
    ]);

    await this.bot.sendMessage(
      chatId,
      '*Connect External Wallet* 🔗\n\n' +
        'Connect your existing wallet:\n\n' +
        '• MetaMask\n' +
        '• Trust Wallet\n' +
        '• Solana-Compatible Wallets\n' +
        '• Any Reown-compatible wallet\n\n' +
        'Choose your connection method:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const action = query.data;
    const userInfo = query.from;

    if (action === 'connect_wallet' || action === 'disconnect_wallet') {
      this.eventHandler.emit(action, { chatId, userInfo });
      return true;
    }
    return false;
  }

  async initiateWalletConnect(chatId, userInfo) {
    const loadingMsg = await this.showLoadingMessage(chatId, '🔗 Initiating connection...');

    try {
      // Initialize WalletConnect
      if (!walletConnectService.signClient || !walletConnectService.walletModal) {
        await walletConnectService.initializeWalletConnect();
      }

      // Create connection and generate JWT
      const session = await walletConnectService.createConnection(userInfo.id);
      const jwtToken = walletConnectService.sessions.get(userInfo.id)?.token;

      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Handle connection events
      walletConnectService.once('connected', async ({ address, network }) => {
        try {
          await this.bot.sendMessage(
            chatId,
            '✅ *Wallet Connected Successfully!*\n\n' +
              `Address: \`${address}\`\n` +
              `Network: ${network}\n\n` +
              'Your wallet is now connected and can be used for trading.\n\n' +
              `🔐 *Session Token:* \`${jwtToken}\` (expires in 1 hour)`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '👛 View Wallets', callback_data: 'view_wallets' }],
                  [{ text: '🔄 Disconnect', callback_data: 'disconnect_wallet' }],
                ],
              },
            }
          );
        } catch (error) {
          await ErrorHandler.handle(error, this.bot, chatId);
        }
      });

      console.log(`WalletConnect session established for user ${userInfo.id}.`);
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      throw error;
    }
  }

  async disconnectWallet(chatId, userInfo) {
    const loadingMsg = await this.showLoadingMessage(chatId, '🔄 Disconnecting wallet...');

    try {
      // Disconnect WalletConnect session
      await walletConnectService.disconnect(userInfo.id);

      await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      await this.bot.sendMessage(
        chatId,
        '✅ Wallet disconnected successfully!',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔗 Connect Another', callback_data: 'connect_wallet' }],
              [{ text: '↩️ Back', callback_data: 'back_to_wallets' }],
            ],
          },
        }
      );
    } catch (error) {
      if (loadingMsg) {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      }
      throw error;
    }
  }
}
