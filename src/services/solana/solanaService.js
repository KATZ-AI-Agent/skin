import axios from 'axios';

export async function getSolanaTokenInfo(tokenAddress) {
  const solanaEndpoint = 'https://api.mainnet-beta.solana.com'; // Solana mainnet endpoint

  try {
    // Define the JSON-RPC payload to fetch token account details
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [
        tokenAddress,
        {
          encoding: 'jsonParsed', // Request parsed account info
        },
      ],
    };

    // Make the request to the Solana RPC endpoint
    const response = await axios.post(solanaEndpoint, payload);

    // Extract account info
    const accountInfo = response.data?.result?.value;
    if (!accountInfo) {
      throw new Error('Invalid or non-existent token address');
    }

    const { program, parsed } = accountInfo?.data || {};
    if (program !== 'spl-token') {
      throw new Error('Provided address is not a valid SPL token');
    }

    // Parse token details
    const { info } = parsed;
    const { symbol, name, decimals } = info;

    // Log decimals for internal debugging
    console.log(`Decimals for token ${symbol || 'unknown'}: ${decimals}`);

    return { symbol, name }; // Return only symbol and name for now
  } catch (error) {
    console.error('Error fetching Solana token info:', error.message);
    throw new Error('Failed to fetch Solana token info');
  }
}
