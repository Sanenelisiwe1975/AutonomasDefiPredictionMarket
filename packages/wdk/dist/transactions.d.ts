/**
 * @file transactions.ts
 * @description USD₮ and XAU₮ ERC-20 transfer execution via WDK.
 *
 * All on-chain writes go through WalletAccountEvm.transfer() which:
 *   1. Estimates gas before signing
 *   2. Enforces the transferMaxFee cap set on the wallet
 *   3. Returns a tx hash + actual fee paid
 *
 * Token addresses are resolved from environment variables so the same
 * code runs on Sepolia (testnet) and Ethereum mainnet without changes.
 *
 * @license Apache-2.0
 */
import type { WalletAccountEvm } from "@tetherto/wdk-wallet-evm";
/** Supported settlement tokens. */
export type TokenSymbol = "USDT" | "XAUT";
/** Parameters for a token transfer. */
export interface TransferParams {
    /** Recipient checksummed Ethereum address. */
    to: string;
    /** Amount in token's smallest unit (USDT: 6 decimals, XAUT: 6 decimals). */
    amount: bigint;
    /** Token to transfer. */
    token: TokenSymbol;
}
/** Result returned after a successful transfer. */
export interface TransferResult {
    /** Transaction hash (0x-prefixed hex). */
    hash: string;
    /** Gas fee actually paid, in wei. */
    fee: bigint;
    /** Token transferred. */
    token: TokenSymbol;
    /** Amount transferred in smallest unit. */
    amount: bigint;
    /** Recipient address. */
    to: string;
    /** Unix timestamp (ms) when the result was returned. */
    timestamp: number;
}
/** Quote returned before executing a transfer. */
export interface TransferQuote {
    /** Estimated gas fee in wei. */
    estimatedFee: bigint;
    /** Whether the fee is within the wallet's transferMaxFee cap. */
    withinFeeLimit: boolean;
}
/**
 * Returns the ERC-20 contract address for a token symbol.
 * Reads from environment variables so testnet/mainnet addresses
 * can be configured without code changes.
 *
 * @throws If the env var for the requested token is not set.
 */
export declare function getTokenAddress(token: TokenSymbol): string;
/**
 * Estimates the gas fee for a token transfer WITHOUT submitting a transaction.
 * Use this in the decision engine to factor costs into EV calculations.
 *
 * @param account - The WDK wallet account that will sign the transfer
 * @param params  - Transfer parameters
 */
export declare function quoteTransfer(account: WalletAccountEvm, params: TransferParams): Promise<TransferQuote>;
/**
 * Transfers an ERC-20 token (USD₮ or XAU₮) using the WDK wallet.
 *
 * The WDK library handles:
 *   - ERC-20 approve + transfer flow
 *   - EIP-1559 fee estimation
 *   - transferMaxFee enforcement
 *
 * @param account - The WDK wallet account that will sign
 * @param params  - Transfer parameters
 * @returns       - Transaction hash, actual fee, and metadata
 * @throws        If the transfer fails (insufficient balance, fee cap exceeded, etc.)
 */
export declare function transferToken(account: WalletAccountEvm, params: TransferParams): Promise<TransferResult>;
/**
 * Transfers USD₮ — convenience wrapper around transferToken.
 *
 * @param account    - The WDK wallet account
 * @param to         - Recipient address
 * @param amountUsdt - Amount in micro USDT (1 USDT = 1000000)
 */
export declare function transferUSDT(account: WalletAccountEvm, to: string, amountUsdt: bigint): Promise<TransferResult>;
/**
 * Transfers XAU₮ — convenience wrapper around transferToken.
 *
 * @param account    - The WDK wallet account
 * @param to         - Recipient address
 * @param amountXaut - Amount in smallest XAU₮ unit (1 XAUT = 1000000)
 */
export declare function transferXAUT(account: WalletAccountEvm, to: string, amountXaut: bigint): Promise<TransferResult>;
//# sourceMappingURL=transactions.d.ts.map