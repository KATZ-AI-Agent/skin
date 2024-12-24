import { User } from '../../../models/User.js';
import { walletService } from '../../../services/wallet/index.js';
import { ErrorHandler } from '../../../core/errors/index.js';
import { networkState } from '../../../services/networkState.js';

export class SettingsHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async showWalletList(chatId, userInfo) {
        const loadingMsg = await this.bot.sendMessage(chatId, '👛 Loading wallets...');
    
        try {
            // Fetch all wallets for the user
            const wallets = await walletService.getWallets(userInfo.id);
    
            if (!wallets || wallets.length === 0) {
                await this.bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
                await this.showEmptyWalletMessage(chatId);
                return;
            }
    
            // Group wallets by network
            const walletsByNetwork = wallets.reduce((acc, wallet) => {
                if (!acc[wallet.network]) acc[wallet.network] = [];
                acc[wallet.network].push(wallet);
                return acc;
            }, {});
    
            // Construct inline keyboard
            const keyboard = {
                inline_keyboard: []
            };
    
            for (const [network, networkWallets] of Object.entries(walletsByNetwork)) {
                keyboard.inline_keyboard.push([
                    { text: `🌐 ${networkState.getNetworkDisplay(network)}`, callback_data: 'noop' }
                ]);
    
                networkWallets.forEach((wallet) => {
                    keyboard.inline_keyboard.push([{
                        text: `${wallet.type === 'walletconnect' ? '🔗' : '👛'} ${this.formatWalletAddress(wallet.address)}`,
                        callback_data: `wallet_${wallet.address}`
                    }]);
                });
            }
    
            keyboard.inline_keyboard.push([{ text: '↩️ Back', callback_data: 'back_to_wallets' }]);
    
            await this.bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    
            await this.bot.sendMessage(
                chatId,
                '*Your Wallets* 👛\n\nSelect a wallet to view details:',
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
    
            return true;
        } catch (error) {
            if (loadingMsg) {
                await this.bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
            }
            await ErrorHandler.handle(error, this.bot, chatId);
            return false;
        }
    }    

    async showSettings(chatId, userInfo) {
        try {
            const user = await User.findOne({ telegramId: userInfo.id.toString() });
            const isAutonomousEnabled = user?.settings?.trading?.autonomousEnabled;

            const keyboard = {
                inline_keyboard: [
                    [{ 
                        text: `${isAutonomousEnabled ? '🔴 Disable' : '🟢 Enable'} Autonomous Trading`,
                        callback_data: 'toggle_autonomous'
                    }],
                    [{ text: '⚙️ Adjust Slippage', callback_data: 'slippage_settings' }],
                    [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
                ]
            };

            await this.bot.sendMessage(
                chatId,
                '*Wallet Settings* ⚙️\n\n' +
                `Autonomous Trading: ${isAutonomousEnabled ? '✅' : '❌'}\n\n` +
                'Configure your wallet settings:',
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            return true;
        } catch (error) {
            await ErrorHandler.handle(error, this.bot, chatId);
            return false;
        }
    }

    async showSlippageSettings(chatId, userInfo) {
        try {
            const user = await User.findOne({ telegramId: userInfo.id.toString() });
            const slippage = user?.settings?.trading?.slippage || {
                ethereum: 3,
                base: 3,
                solana: 3
            };

            const keyboard = {
                inline_keyboard: [
                    [{ text: `ETH (${slippage.ethereum}%)`, callback_data: 'adjust_eth_slippage' }],
                    [{ text: `Base (${slippage.base}%)`, callback_data: 'adjust_base_slippage' }],
                    [{ text: `Solana (${slippage.solana}%)`, callback_data: 'adjust_sol_slippage' }],
                    [{ text: '↩️ Back', callback_data: 'wallet_settings' }]
                ]
            };

            await this.bot.sendMessage(
                chatId,
                '*Slippage Settings* ⚙️\n\n' +
                'Current slippage tolerance:\n\n' +
                `• Ethereum: ${slippage.ethereum}%\n` +
                `• Base: ${slippage.base}%\n` +
                `• Solana: ${slippage.solana}%\n\n` +
                'Select a network to adjust:',
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            return true;
        } catch (error) {
            await ErrorHandler.handle(error, this.bot, chatId);
            return false;
        }
    }

    async updateSlippage(chatId, userInfo, network, value) {
        try {
            const slippage = parseFloat(value);
            if (isNaN(slippage) || slippage < 0.1 || slippage > 50) {
                throw new Error('Invalid slippage value. Must be between 0.1 and 50.');
            }

            await User.updateOne(
                { telegramId: userInfo.id.toString() },
                { $set: { [`settings.trading.slippage.${network}`]: slippage } }
            );

            await this.bot.sendMessage(
                chatId,
                `✅ Slippage for ${network} updated to ${slippage}%`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '↩️ Back to Settings', callback_data: 'slippage_settings' }
                        ]]
                    }
                }
            );
            return true;
        } catch (error) {
            await ErrorHandler.handle(error, this.bot, chatId);
            return false;
        }
    }

    async toggleAutonomous(chatId, userInfo) {
        try {
            const user = await User.findOne({ telegramId: userInfo.id.toString() });
            const newState = !user?.settings?.trading?.autonomousEnabled;

            await User.updateOne(
                { telegramId: userInfo.id.toString() },
                { $set: { 'settings.trading.autonomousEnabled': newState } }
            );

            await this.bot.sendMessage(
                chatId,
                `✅ Autonomous trading ${newState ? 'enabled' : 'disabled'} successfully!`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '↩️ Back', callback_data: 'wallet_settings' }
                        ]]
                    }
                }
            );
            return true;
        } catch (error) {
            await ErrorHandler.handle(error, this.bot, chatId);
            return false;
        }
    }

    async handleSlippageAdjustment(query, network) {
        const chatId = query.message.chat.id;
        try {
          await this.setState(query.from.id, USER_STATES.WAITING_SLIPPAGE_INPUT);
          await this.setUserData(query.from.id, { pendingSlippage: { network } });
    
          await this.bot.sendMessage(
            chatId,
            '*Enter New Slippage* ⚙️\n\n' +
            'Enter a number between 0.1 and 50:',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '❌ Cancel', callback_data: 'slippage_settings' }
                ]]
              }
            }
          );
          return true;
        } catch (error) {
          await ErrorHandler.handle(error, this.bot, chatId);
          return false;
        }
    }
      

    formatWalletAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    async showEmptyWalletMessage(chatId, network) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '➕ Create Wallet', callback_data: 'create_wallet' }],
                [{ text: '🌐 Switch Network', callback_data: 'switch_network' }],
                [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
            ]
        };

        await this.bot.sendMessage(
            chatId,
            `No wallets found for ${networkState.getNetworkDisplay(network)}. Create one first!`,
            { reply_markup: keyboard }
        );
        return true;
    }
}