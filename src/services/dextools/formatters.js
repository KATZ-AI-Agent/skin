export function formatTrendingToken(networkSegment) {
  return token => ({
    rank: token.rank,
    address: token.mainToken.address,
    symbol: token.mainToken.symbol || 'Unknown',
    name: token.mainToken.name || 'Unknown',
    dextoolsUrl: `https://www.dextools.io/app/en/${networkSegment}/pair-explorer/${token.mainToken.address}`
  });
}

export function formatAnalysisMessage(tokenInfo, score, audit, price, liquidity, poolData, network) {
  const message = `
*Token Analysis* 🔍

*Token Info:*
• Name: ${tokenInfo?.name || 'Unknown'}
• Symbol: ${tokenInfo?.symbol || 'Unknown'}
${tokenInfo?.logo ? '• Logo: [View]('+tokenInfo.logo+')' : ''}

*Contract Address:*
\`${tokenInfo?.address}\`

*Security Score:*
• Total Score: ${score?.dextScore?.total || 0}/100
• Information: ${score?.dextScore?.information || 0}/100
• Pool: ${score?.dextScore?.pool || 0}/100
• Holders: ${score?.dextScore?.holders || 0}/100

*Security Audit:*
• Open Source: ${formatAuditValue(audit?.isOpenSource)}
• Honeypot Risk: ${formatAuditValue(audit?.isHoneypot)}
• Mintable: ${formatAuditValue(audit?.isMintable)}
• Buy Tax: ${formatTaxValue(audit?.buyTax)}
• Sell Tax: ${formatTaxValue(audit?.sellTax)}
• Contract Renounced: ${formatAuditValue(audit?.isContractRenounced)}

*Price Info (24h):*
• Current: $${formatNumber(price?.price)}
• Change: ${formatNumber(price?.variation24h)}%
• Volume: $${formatNumber(price?.volume24h)}
• Buys/Sells: ${price?.buys24h || 0}/${price?.sells24h || 0}

*Liquidity Info:*
• Total Value: $${formatNumber(liquidity?.liquidity)}
• Token Reserve: ${formatNumber(liquidity?.reserves?.mainToken)}
• Pair Reserve: ${formatNumber(liquidity?.reserves?.sideToken)}

*Pool Info:*
• Exchange: ${poolData?.exchangeName || 'Unknown'}
• Created: ${new Date(poolData?.creationTime).toLocaleString()}
• Fee: ${poolData?.fee || 0}%

*Social Links:*
${formatSocialLinks(tokenInfo?.socialInfo)}

*View on DexTools:*
[Open in DexTools](https://www.dextools.io/app/en/${network}/pair-explorer/${tokenInfo?.address})

_Last Updated: ${new Date().toLocaleString()}_
`.trim();

  if (!message) {
    throw new Error('Failed to format analysis message');
  }

  return message;
}

export function formatSocialLinks(socialInfo) {
  if (!socialInfo) return 'No social links available';
  
  const links = [];
  if (socialInfo.twitter) links.push(`• [Twitter](${socialInfo.twitter})`);
  if (socialInfo.telegram) links.push(`• [Telegram](${socialInfo.telegram})`);
  if (socialInfo.website) links.push(`• [Website](${socialInfo.website})`);
  
  return links.length > 0 ? links.join('\n') : 'No social links available';
}

export function formatAuditValue(value) {
  if (!value) return '❓';
  return value.toLowerCase() === 'true' ? '✅' : '❌';
}

export function formatTaxValue(tax) {
  if (!tax) return 'N/A';
  return `${tax.min || 0}-${tax.max || 0}%`;
}

export function formatNumber(num) {
  if (!num) return '0.00';
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}