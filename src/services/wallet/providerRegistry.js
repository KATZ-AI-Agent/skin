export const providerRegistry = {
    evm: {},
    solana: null,
  };
  
  // Initialize EVM providers for supported networks
  export const initializeProviders = async () => {
    const networks = {
      ethereum: config.networks.ethereum,
      base: config.networks.base,
    };
  
    for (const [network, networkConfig] of Object.entries(networks)) {
      const evmProvider = new EVMProvider(networkConfig);
      await evmProvider.initialize();
      providerRegistry.evm[network] = evmProvider;
    }
  
    // Initialize Solana provider
    providerRegistry.solana = new SolanaWallet(config.networks.solana);
    await providerRegistry.solana.initialize();
  
    console.log('✅ Providers initialized');
  };
  