import { Command } from './Command.js';

export class MenuCommand extends Command {
  constructor(bot) {
    super(bot);
    this.menuItems = [];
  }

  addMenuItem(item) {
    this.menuItems.push(item);
  }

  async showMenu(chatId, title, message) {
    const keyboard = this.createKeyboard(
      this.menuItems.map(item => [{
        text: item.text,
        callback_data: item.action
      }])
    );

    await this.bot.sendMessage(chatId, 
      `*${title}*\n\n${message}`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  async handleMenuSelection(action, query) {
    const item = this.menuItems.find(i => i.action === action);
    if (item?.handler) {
      return item.handler(query);
    }
    return false;
  }
}