/**
 * @file wallet.ts
 * @description WDK wallet creation and lifecycle management.
 *
 * Wraps @tetherto/wdk-wallet-evm to provide a clean, typed interface
 * for creating and managing non-custodial EVM wallets from BIP-39 seed
 * phrases. All signing stays client-side — keys never leave this process.
 *
 * @license Apache-2.0
 */
import { type WalletAccountEvm } from "@tetherto/wdk-wallet-evm";
/** Configuration for the WDK wallet manager. */
export interface WalletConfig {
    /** JSON-RPC endpoint URL (e.g. Alchemy / Infura / public node). */
    rpcUrl: string;
    /**
     * Maximum fee the agent will pay per transaction, in wei.
     * Acts as a hard safety cap — transactions exceeding this are rejected.
     * Default: 0.001 ETH (1_000_000_000_000_000n wei).
     */
    transferMaxFee?: bigint;
}
/** Snapshot of an account's on-chain state. */
export interface AccountInfo {
    address: string;
    /** Native ETH balance in wei. */
    ethBalance: bigint;
    /** USD₮ balance in micro-USDT (6 decimals). */
    usdtBalance: bigint;
    /** XAU₮ balance in smallest unit (6 decimals). */
    xautBalance: bigint;
    derivationIndex: number;
}
/**
 * AgentWallet wraps WalletManagerEvm and provides the agent with
 * a single high-level interface for account access and balance queries.
 *
 * @example
 * ```ts
 * const wallet = new AgentWallet(process.env.AGENT_SEED_PHRASE!, {
 *   rpcUrl: process.env.RPC_URL!,
 * });
 * const account = await wallet.getAccount(0);
 * const address = await account.getAddress();
 * ```
 */
export declare class AgentWallet {
    private readonly manager;
    private readonly config;
    constructor(seedPhrase: string, config: WalletConfig);
    /**
     * Returns the WalletAccountEvm at the given BIP-44 derivation index.
     * Index 0 is the primary agent account used for all operations.
     *
     * @param index - BIP-44 account index (default: 0)
     */
    getAccount(index?: number): Promise<WalletAccountEvm>;
    /**
     * Returns the primary agent account (index 0).
     */
    getPrimaryAccount(): Promise<WalletAccountEvm>;
    /**
     * Returns the Ethereum address for an account index.
     *
     * @param index - BIP-44 account index (default: 0)
     */
    getAddress(index?: number): Promise<string>;
    /**
     * Returns current fee rates from the network.
     * Used by the decision engine to factor gas costs into EV calculations.
     */
    getFeeRates(): Promise<{
        normal: bigint;
        fast: bigint;
    }>;
    /**
     * Disposes all wallet accounts, wiping private keys from memory.
     * MUST be called on agent shutdown to prevent key leakage.
     */
    dispose(): void;
}
/**
 * Factory: creates an AgentWallet from environment variables.
 * Throws clearly if required vars are missing.
 */
export declare function createAgentWallet(): AgentWallet;
//# sourceMappingURL=wallet.d.ts.map