import { Connection, PublicKey } from '@solana/web3.js';

export async function getSolanaTokenInfo(tokenAddress) {
  const connection = new Connection('https://api.mainnet-beta.solana.com'); // Use Solana mainnet endpoint
  try {
    // Fetch the token's mint account details
    const publicKey = new PublicKey(tokenAddress);
    const accountInfo = await connection.getParsedAccountInfo(publicKey);

    // Ensure the account exists and is a token account
    if (!accountInfo || !accountInfo.value) {
      throw new Error('Invalid or non-existent token address');
    }

    const data = accountInfo.value.data;
    if (data.program !== 'spl-token') {
      throw new Error('Provided address is not a valid SPL token');
    }

    // Parse token details
    const parsedData = data.parsed.info;
    const { symbol, name } = parsedData; // Adjust if additional fields are needed

    return { symbol, name };
  } catch (error) {
    console.error('Error fetching Solana token info:', error.message);
    throw new Error('Failed to fetch Solana token info');
  }
}
