import { Command } from './Command.js';
import { walletService } from '../../services/wallet/index.js';
import { networkState } from '../../services/networkState.js';

export class WalletCommand extends Command {
  constructor(bot) {
    super(bot);
  }

  async validateNetwork(chatId) {
    const currentNetwork = await networkState.getCurrentNetwork(chatId);
    if (!currentNetwork) {
      await this.bot.sendMessage(
        chatId,
        '❌ Please select a network first.',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Select Network', callback_data: 'switch_network' }
            ]]
          }
        }
      );
      return false;
    }
    return true;
  }

  async showWalletList(chatId, userInfo) {
    const wallets = await walletService.getWallets(userInfo.id);
    const currentNetwork = await networkState.getCurrentNetwork(userInfo.id);
    const networkWallets = wallets.filter(w => w.network === currentNetwork);

    if (networkWallets.length === 0) {
      await this.showEmptyWalletMessage(chatId, currentNetwork);
      return;
    }

    const keyboard = this.createKeyboard([
      ...networkWallets.map(wallet => [{
        text: this.formatWalletAddress(wallet.address),
        callback_data: `wallet_${wallet.address}`
      }]),
      [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      `*Your ${networkState.getNetworkDisplay(currentNetwork)} Wallets* 👛\n\n` +
      'Select a wallet to view details:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  formatWalletAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  async showEmptyWalletMessage(chatId, network) {
    const keyboard = this.createKeyboard([
      [{ text: '➕ Create Wallet', callback_data: 'create_wallet' }],
      [{ text: '🔄 Switch Network', callback_data: 'switch_network' }],
      [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
    ]);

    await this.bot.sendMessage(
      chatId,
      `No wallets found for ${networkState.getNetworkDisplay(network)}. Create one first!`,
      { reply_markup: keyboard }
    );
  }
}