/**
 * @file accounts.ts
 * @description Account abstraction layer — balance queries and portfolio snapshots.
 *
 * Provides a unified view of an agent account's onchain state:
 *   - Native ETH balance (for gas)
 *   - USD₮ balance (base trading asset)
 *   - XAU₮ balance (gold hedge reserve)
 *
 * Balance values are returned as bigint in the token's smallest unit.
 * Human-readable formatting helpers are included for logging and UI.
 *
 * @license Apache-2.0
 */
import type { WalletAccountEvm } from "@tetherto/wdk-wallet-evm";
/** Full portfolio snapshot for one agent account. */
export interface PortfolioSnapshot {
    address: string;
    /** ETH balance in wei. */
    ethWei: bigint;
    /** USD₮ balance in micro-USDT (6 decimals: 1_000_000 = 1 USDT). */
    usdtMicro: bigint;
    /** XAU₮ balance in smallest unit (6 decimals: 1_000_000 = 1 XAUT). */
    xautMicro: bigint;
    /** Approximate total value in USD₮ micro-units (XAUT converted at spot). */
    totalValueUsdt: bigint;
    /** Unix timestamp (ms) of the snapshot. */
    snapshotAt: number;
}
/** Human-readable portfolio for logging / dashboard display. */
export interface PortfolioDisplay {
    address: string;
    ethBalance: string;
    usdtBalance: string;
    xautBalance: string;
    snapshotAt: string;
}
/**
 * Returns the native ETH balance of an account in wei.
 *
 * @param account - WDK wallet account
 */
export declare function getEthBalance(account: WalletAccountEvm): Promise<bigint>;
/**
 * Returns the USD₮ token balance in micro-USDT (6 decimal places).
 *
 * @param account - WDK wallet account
 */
export declare function getUsdtBalance(account: WalletAccountEvm): Promise<bigint>;
/**
 * Returns the XAU₮ token balance in smallest unit (6 decimal places).
 *
 * @param account - WDK wallet account
 */
export declare function getXautBalance(account: WalletAccountEvm): Promise<bigint>;
/**
 * Fetches a full portfolio snapshot for an account in one call.
 * All three balance queries run in parallel to minimise latency.
 *
 * The totalValueUsdt field is a rough estimate: it does NOT fetch live
 * XAUT/USD prices — that job belongs to the oracle in packages/data.
 * Pass `xautSpotUsdt` (micro-USDT per micro-XAUT) if you want an
 * accurate total; omit it to get USDT-only total.
 *
 * @param account       - WDK wallet account
 * @param xautSpotUsdt  - Optional: XAU₮ spot price expressed as micro-USDT
 *                        per micro-XAUT unit (e.g. 1_950_000_000 = $1,950/oz
 *                        for a token with 6 decimals scaled to 6-decimal USDT)
 */
export declare function getPortfolioSnapshot(account: WalletAccountEvm, xautSpotUsdt?: bigint): Promise<PortfolioSnapshot>;
/**
 * Formats a wei amount as a human-readable ETH string.
 * e.g. 1_000_000_000_000_000_000n → "1.000000 ETH"
 */
export declare function formatEth(wei: bigint): string;
/**
 * Formats a micro-USDT amount as a human-readable USD₮ string.
 * e.g. 1_000_000n → "1.000000 USD₮"
 */
export declare function formatUsdt(microUsdt: bigint): string;
/**
 * Formats a micro-XAUT amount as a human-readable XAU₮ string.
 * e.g. 1_000_000n → "1.000000 XAU₮"
 */
export declare function formatXaut(microXaut: bigint): string;
/**
 * Converts a PortfolioSnapshot to a human-readable PortfolioDisplay.
 */
export declare function formatPortfolio(snapshot: PortfolioSnapshot): PortfolioDisplay;
/** Minimum ETH balance required to pay gas fees (0.005 ETH in wei). */
export declare const MIN_ETH_FOR_GAS = 5000000000000000n;
/**
 * Returns true if the account has enough ETH to pay for at least one
 * typical ERC-20 transfer (~0.005 ETH at 50 gwei, 100k gas).
 */
export declare function hasEnoughGas(ethWei: bigint): boolean;
//# sourceMappingURL=accounts.d.ts.map