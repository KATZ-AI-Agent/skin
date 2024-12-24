export async function handleTrendingActions(bot, action, chatId, fetchCallback) {
    switch (action) {
      case 'refresh_trending':
        await handleRefresh(bot, chatId, fetchCallback);
        return true;
      case 'retry_trending':
        await fetchCallback();
        return true;
      default:
        return false;
    }
  }
  
  async function handleRefresh(bot, chatId, fetchCallback) {
    try {
      const messages = await bot.getChat(chatId);
      if (messages.last_message_id) {
        await bot.deleteMessage(chatId, messages.last_message_id);
      }
      await fetchCallback();
    } catch (error) {
      console.error('Error refreshing trending:', error);
      throw error;
    }
  }