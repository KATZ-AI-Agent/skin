// Future use to enable broadcasts. Import WebSocket broadcasting utility
//import { broadcastUpdate } from '../websocketServer.js'; 

export const TRADING_INTENTS = {
  // Market Analysis
  TRENDING_CHECK: 'TRENDING_CHECK',
  TOKEN_SCAN: 'TOKEN_SCAN',
  MARKET_ANALYSIS: 'MARKET_ANALYSIS',
  KOL_CHECK: 'KOL_CHECK',
  GEMS_TODAY: 'GEMS_TODAY',
  INTERNET_SEARCH: 'INTERNET_SEARCH',

  // Trading Actions
  QUICK_TRADE: 'QUICK_TRADE',
  PRICE_CHECK: 'PRICE_CHECK',
  
  // Automation
  PRICE_ALERT: 'PRICE_ALERT',
  TIMED_ORDER: 'TIMED_ORDER',
  FLIPPER_MODE: 'FLIPPER_MODE',
  
  // Portfolio Management
  PORTFOLIO_VIEW: 'PORTFOLIO_VIEW',
  POSITION_MANAGE: 'POSITION_MANAGE',
  
  // Monitoring
  ALERT_MONITOR: 'ALERT_MONITOR',
  TRADE_HISTORY: 'TRADE_HISTORY',
};

export const INTENT_PATTERNS = {
  [TRADING_INTENTS.TRENDING_CHECK]: [
    'what\'s trending',
    'show trending tokens',
    'top tokens',
    'trending now',
    'hot tokens'
  ],

  [TRADING_INTENTS.TOKEN_SCAN]: [
    'scan token',
    'analyze token',
    'check token',
    'token info',
    'token details'
  ],

  [TRADING_INTENTS.KOL_CHECK]: [
    'check kol',
    'show tweets',
    'twitter check',
    'kol mentions',
    'influencer posts'
  ],

  [TRADING_INTENTS.QUICK_TRADE]: [
    'buy',
    'sell',
    'swap',
    'trade now',
    'execute trade'
  ],

  [TRADING_INTENTS.PRICE_CHECK]: [
    'price of',
    'token price',
    'how much is',
    'current price',
    'check price'
  ],

  [TRADING_INTENTS.PRICE_ALERT]: [
    'alert me',
    'notify when',
    'set alert',
    'price alert',
    'when price'
  ],

  [TRADING_INTENTS.TIMED_ORDER]: [
    'schedule trade',
    'set order',
    'trade at',
    'buy at',
    'sell at'
  ],

  [TRADING_INTENTS.FLIPPER_MODE]: [
    'start flipper',
    'run flipper',
    'enable flipper',
    'stop flipper',
    'flipper mode'
  ],

  [TRADING_INTENTS.PORTFOLIO_VIEW]: [
    'show positions',
    'view portfolio',
    'my trades',
    'open positions',
    'active trades'
  ],

  [TRADING_INTENTS.POSITION_MANAGE]: [
    'close position',
    'update stop loss',
    'change take profit',
    'modify position',
    'adjust trade'
  ],

  [TRADING_INTENTS.ALERT_MONITOR]: [
    'show alerts',
    'check orders',
    'pending trades',
    'active alerts',
    'scheduled orders'
  ],

  [TRADING_INTENTS.TRADE_HISTORY]: [
    'trade history',
    'past trades',
    'closed positions',
    'trading performance',
    'profit loss'
  ],

  [TRADING_INTENTS.GEMS_TODAY]: [
    'show gems',
    'gems today',
    'trending gems',
    'show me gems',
    'hot gems',
    'new gems',
    'social gems',
    'best gems today',
    'what gems are trending',
    'scan for gems'
  ],

  [TRADING_INTENTS.INTERNET_SEARCH]: [
    'search for',
    'find information about',
    'look up',
    'research',
    'what is',
    'tell me about',
    'search the web for',
    'find news about'
  ]
};

/**
 * Match user input to an intent based on defined patterns.
 * @param {string} userInput - The user input to match.
 * @returns {string|null} - The matching intent or null if no match is found.
 */
export function matchIntent(userInput) {
  const normalizedInput = userInput.toLowerCase();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalizedInput.includes(pattern.toLowerCase())) {
        return intent;
      }
    }
  }
  return null;
}

/**
 * Format the intent response based on intent type and data.
 */
export function formatIntentResponse(intent, data, username) {
  switch (intent) {
    case TRADING_INTENTS.TRENDING_CHECK:
      return formatTrendingResponse(data);
    
    case TRADING_INTENTS.TOKEN_SCAN:
      return formatScanResponse(data, username);
    
    case TRADING_INTENTS.KOL_CHECK:
      return formatKOLResponse(data);
    
    case TRADING_INTENTS.QUICK_TRADE:
      return formatTradeResponse(data);
    
    case TRADING_INTENTS.PORTFOLIO_VIEW:
      return formatPortfolioResponse(data);
    
    case TRADING_INTENTS.FLIPPER_MODE:
      return formatFlipperResponse(data);
    
    case TRADING_INTENTS.POSITION_MANAGE:
      return formatPositionResponse(data);
    
    case TRADING_INTENTS.ALERT_MONITOR:
      return formatMonitoringResponse(data);

    case TRADING_INTENTS.GEMS_TODAY:
      return formatGemsResponse(data);

    case TRADING_INTENTS.INTERNET_SEARCH:
      return formatSearchResponse(data);
    default:
      return 'I couldn’t process that request. Please try again.';
  }
}

function formatTrendingResponse(tokens) {
  if (!tokens?.length) return 'No trending tokens found.';
  return '*Trending Tokens* 🔥\n\n' + 
    tokens.map((token, i) => 
      `${i + 1}. *${token.symbol}*\n` +
      `• Price: $${token.price}\n` +
      `• Volume: $${token.volume24h}\n`
    ).join('\n');
}

function formatScanResponse(data, username) {
  if (!data) {
    return `Anon ${username} wants to scan tokens? *sigh* Fine...but don't blame me when you get rekt! 😼`;
  }

  return `*Token Analysis* 🔍\n\n` +
         `Hey ${username}, here's your dextools link ser... news flash tomorrow: "${username} got rekt" 😹\n\n` +
         `Symbol: ${data.symbol}\n` +
         `Price: $${data.price}\n` +
         `Liquidity: $${data.liquidity}\n` +
         `Holders: ${data.holders}\n\n` +
         `Security Score: ${data.score}/100\n` +
         `Risk Level: ${data.riskLevel}\n\n` +
         `[View on Dextools](${data.dextoolsUrl})\n\n` +
         `_Don't say I didn't warn you anon..._`;
}

function formatKOLResponse(tweets) {
  if (!tweets?.length) return 'No KOL mentions found.';

  return '*KOL Mentions* 🐦\n\n' +
    tweets.map((tweet, i) =>
      `${i+1}. *${tweet.author.name}* ${tweet.author.verified ? '✅' : ''}\n` +
      `@${tweet.author.username} (${tweet.author.followers} followers)\n\n` +
      `${tweet.text}\n\n` +
      `❤️ ${tweet.stats.likes} | 🔄 ${tweet.stats.retweets}\n`
    ).join('\n');
}

function formatTradeResponse(result) {
  return '*Trade Executed* ✅\n\n' +
    `Type: ${result.action}\n` +
    `Token: ${result.token}\n` +
    `Amount: ${result.amount}\n` +
    `Price: $${result.price}\n` +
    `Hash: \`${result.hash}\``;
}

function formatPortfolioResponse(positions) {
  if (!positions?.length) return 'No open positions found.';

  return '*Portfolio Overview* 📊\n\n' +
    positions.map((pos, i) =>
      `${i+1}. *${pos.token.symbol}*\n` +
      `• Entry: $${pos.entryPrice}\n` +
      `• Current: $${pos.currentPrice}\n` +
      `• P/L: ${pos.profitLoss}%\n`
    ).join('\n');
}

function formatFlipperResponse(data) {
  if (data.action === 'start') {
    return '*FlipperMode Started* 🤖\n\n' +
      `Max Positions: ${data.config.maxPositions}\n` +
      `Take Profit: ${data.config.profitTarget}%\n` +
      `Stop Loss: ${data.config.stopLoss}%\n` +
      `Time Limit: ${data.config.timeLimit/60000}min`;
  }

  return '*FlipperMode Stopped* ⏹\n\n' +
    `Total Trades: ${data.stats.totalTrades}\n` +
    `Profitable: ${data.stats.profitable}\n` +
    `Total P/L: ${data.stats.totalProfit}%`;
}

function formatPositionResponse(data) {
  return '*Position Updated* ✅\n\n' +
    `Token: ${data.token}\n` +
    `Action: ${data.action}\n` +
    `New TP: ${data.takeProfit}%\n` +
    `New SL: ${data.stopLoss}%`;
}

function formatMonitoringResponse(data) {
  let message = '*Active Monitoring* 📊\n\n';

  if (data.alerts?.length) {
    message += '*Price Alerts:*\n' +
      data.alerts.map(alert => 
        `• ${alert.token} @ $${alert.targetPrice}`
      ).join('\n') + '\n\n';
  }

  if (data.orders?.length) {
    message += '*Scheduled Orders:*\n' +
      data.orders.map(order =>
        `• ${order.action} ${order.token} @ ${order.executeAt}`
      ).join('\n');
  }

  return message;
}

function formatGemsResponse(gems) {
  if (!gems?.length) {
    return 'No trending gems found for today ser. Check back later!';
  }

  return '*Today\'s Top Gems* 💎\n\n' +
    gems.slice(0, 5).map((gem, i) => 
      `${i+1}. *${gem.symbol}*\n` +
      `• Rating: ${gem.metrics.rating}/10\n` +
      `• Network: ${gem.network}\n` +
      `• Social Interest: ${formatSocialMetrics(gem.metrics)}\n`
    ).join('\n') +
    '\n_Ratings based on social metrics & interest_';
}

function formatSocialMetrics(metrics) {
  return `👁 ${metrics.impressions} | ♥️ ${metrics.likes} | 🔄 ${metrics.retweets}`;
}

function formatSearchResponse(results) {
  if (!results?.length) {
    return 'No relevant information found.';
  }

  return '*Search Results* 🔍\n\n' +
    results.map((result, i) => 
      `${i+1}. *${result.title}*\n` +
      `${result.description}\n` +
      `[Read more](${result.url})\n`
    ).join('\n');
}

