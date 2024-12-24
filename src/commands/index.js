import { eventHandler } from '../events/EventHandler.js'; 
import { CommandRegistry } from './registry.js';
import { StartCommand } from './start/handlers/StartCommand.js';
import { HelpCommand } from './help/HelpCommand.js';
import { ProfileCommand } from './profile/ProfileCommand.js';
import { VoiceHelperCommand } from './help/VoiceHelperCommand.js';
import { MemeCommand } from './meme/MemeCommand.js';
import { InvestmentCommand } from './investment/InvestmentCommand.js';
import { LoansCommand } from './loans/LoansCommand.js';
import { TrendingCommand } from './trending/TrendingCommand.js';
import { ScanCommand } from './scan/ScanCommand.js';
import { GemsCommand } from './scan/GemsCommand.js';
import { TimedOrdersCommand } from './timedOrders/TimedOrdersCommand.js';
import { PriceAlertsCommand } from './alerts/PriceAlertsCommand.js';
import { PumpFunCommand } from './pumpfun/PumpFunCommand.js';
import { WalletsCommand } from './wallets/WalletsCommand.js';
import { ConnectWalletCommand } from './wallets/ConnectWalletCommand.js';
import { SettingsCommand } from './settings/SettingsCommand.js';

export async function setupCommands(bot) {
  // Create registry
  const registry = new CommandRegistry(bot);

  // Register all commands
  const commands = [
    new StartCommand(bot, eventHandler),
    new HelpCommand(bot),
    new ProfileCommand(bot),
    new VoiceHelperCommand(bot),
    new MemeCommand(bot, eventHandler),
    new InvestmentCommand(bot),
    new LoansCommand(bot),
    new TrendingCommand(bot, eventHandler),
    new ScanCommand(bot, eventHandler),
    new GemsCommand(bot, eventHandler),
    new TimedOrdersCommand(bot, eventHandler),
    new PriceAlertsCommand(bot, eventHandler),
    new PumpFunCommand(bot, eventHandler),
    new WalletsCommand(bot),
    new ConnectWalletCommand(bot, eventHandler),
    new SettingsCommand(bot, eventHandler),
  ];

  // Register commands and log each registration
  for (const command of commands) {
    console.log(`🔄 Registering command: ${command.command}`);
    registry.registerCommand(command);
  }

  // Log total registered commands
  console.log(`✅ Registered ${commands.length} commands successfully`);

  return registry;
}