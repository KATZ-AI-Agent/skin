import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { EventEmitter } from "events";
import { User } from "../../models/User.js";
import { ErrorHandler } from "../../core/errors/index.js";
console.log('✅ WalletConnectService module is being loaded...');
class WalletConnectService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.signClient = null;
    this.walletModal = null;
  }

  async initializeWalletConnect() {
    try {
      this.signClient = await SignClient.init({
        projectId: "<katz_project_id>",
        metadata: {
          name: "KATZ! Autonomous Agent",
          description: "Personalized trench pawtner for meme investing",
          url: "https://katz-ai.io",
          icons: ["https://katz-ai.io/katz.png"],
        },
      });

      this.walletModal = new WalletConnectModal({
        projectId: "<your_project_id>",
      });

      console.log("✅ WalletConnect initialized successfully.");
    } catch (error) {
      await ErrorHandler.handle(error, null, null);
      throw new Error("Failed to initialize WalletConnect.");
    }
  }

  async createConnection(userId) {
    try {
      if (!this.signClient || !this.walletModal) {
        throw new Error("WalletConnect is not initialized.");
      }

      const { uri, approval } = await this.signClient.connect({
        requiredNamespaces: this._getRequiredNamespaces(),
      });

      if (uri) {
        this.walletModal.openModal({ uri });
      }

      const session = await approval();
      const accounts = this._getAccountsFromSession(session);
      const chainId = this._getChainIdFromSession(session);

      await this.handleConnect(userId, accounts, chainId);
      return session;
    } catch (error) {
      await ErrorHandler.handle(error, null, userId);
      this.emit("error", { userId, error });
      throw error;
    }
  }

  async handleConnect(userId, accounts, chainId) {
    try {
      const user = await User.findOne({ telegramId: userId.toString() }).lean();
      if (!user) throw new Error("User not found.");

      const network = this._getNetworkFromChainId(chainId);
      const walletData = {
        address: accounts[0],
        type: "walletconnect",
        chainId,
        connected: true,
      };

      this.sessions.set(userId, walletData);
      await user.setAutonomousWallet(network, accounts[0]);

      this.emit("connected", { userId, address: accounts[0], network });
      console.log(`✅ User ${userId} connected to WalletConnect.`);
    } catch (error) {
      await ErrorHandler.handle(error, null, userId);
      this.emit("error", { userId, error });
    }
  }

  async handleSessionUpdate(userId, accounts, chainId) {
    try {
      const session = this.sessions.get(userId);
      if (!session) throw new Error("Session not found for user.");

      session.address = accounts[0];
      session.chainId = chainId;
      this.sessions.set(userId, session);

      this.emit("sessionUpdated", {
        userId,
        address: accounts[0],
        network: this._getNetworkFromChainId(chainId),
      });

      if (this._isSolanaNetwork(chainId)) {
        const solanaNetwork = this._getSolanaNetworkFromChainId(chainId);
        await this._updateSolanaWalletPreferences(userId, accounts[0], solanaNetwork);
      }
    } catch (error) {
      await ErrorHandler.handle(error, null, userId);
      this.emit("error", { userId, error });
    }
  }

  async handleDisconnect(userId) {
    try {
      this.sessions.delete(userId);
      this.emit("disconnected", { userId });
      console.log(`✅ User ${userId} disconnected from WalletConnect.`);
    } catch (error) {
      await ErrorHandler.handle(error, null, userId);
      this.emit("error", { userId, error });
    }
  }

  async disconnect(userId) {
    try {
      if (!this.signClient) throw new Error("WalletConnect is not initialized.");

      const sessions = this.signClient.session.getAll();
      for (const session of sessions) {
        if (session.topic === userId) {
          await this.signClient.disconnect({ topic: session.topic });
        }
      }

      this.handleDisconnect(userId);
    } catch (error) {
      await ErrorHandler.handle(error, null, userId);
      this.emit("error", { userId, error });
    }
  }

  cleanup() {
    this.sessions.clear();
    this.removeAllListeners();
    console.log("WalletConnectService cleanup completed.");
  }

  // Helper methods
  _getRequiredNamespaces() {
    return {
      eip155: {
        methods: ["eth_sendTransaction", "personal_sign"],
        chains: ["eip155:1"],
        events: ["accountsChanged", "chainChanged"],
      },
      solana: {
        methods: ["solana_signTransaction", "solana_signMessage"],
        chains: ["solana:1", "solana:4"],
        events: ["accountsChanged", "chainChanged"],
      },
    };
  }

  _getAccountsFromSession(session) {
    return session.namespaces["eip155"]?.accounts || session.namespaces["solana"]?.accounts || [];
  }

  _getChainIdFromSession(session) {
    return Object.keys(session.namespaces)[0];
  }

  _getNetworkFromChainId(chainId) {
    const networkMap = {
      1: "ethereum",
      8453: "base",
      "solana:1": "mainnet-beta",
      "solana:4": "devnet",
    };
    return networkMap[chainId] || "unknown";
  }

  _isSolanaNetwork(chainId) {
    return ["solana:1", "solana:4"].includes(chainId);
  }

  _getSolanaNetworkFromChainId(chainId) {
    return {
      "solana:1": "mainnet-beta",
      "solana:4": "devnet",
    }[chainId] || "unknown";
  }

  async _updateSolanaWalletPreferences(userId, address, solanaNetwork) {
    try {
      console.log(`Updating Solana wallet preferences for user ${userId}.`);
      const user = await User.findOne({ telegramId: userId.toString() }).lean();
      if (user) {
        await user.setSolanaPreferences({ network: solanaNetwork, address });
      }
    } catch (error) {
      await ErrorHandler.handle(error, null, userId);
      console.error(`Error updating Solana preferences for user ${userId}:`, error);
    }
  }
}

export const walletConnectService = new WalletConnectService();
