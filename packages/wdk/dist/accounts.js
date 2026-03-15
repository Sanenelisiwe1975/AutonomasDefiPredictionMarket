/**
 * @file accounts.ts
 * @description Account abstraction layer — balance queries and portfolio snapshots.
 *
 * Provides a unified view of an agent account's on-chain state:
 *   - Native ETH balance (for gas)
 *   - USD₮ balance (base trading asset)
 *   - XAU₮ balance (gold hedge reserve)
 *
 * Balance values are returned as bigint in the token's smallest unit.
 * Human-readable formatting helpers are included for logging and UI.
 *
 * @license Apache-2.0
 */
import { getTokenAddress } from "./transactions.js";
/**
 * Returns the native ETH balance of an account in wei.
 *
 * @param account - WDK wallet account
 */
export async function getEthBalance(account) {
    return account.getBalance();
}
/**
 * Returns the USD₮ token balance in micro-USDT (6 decimal places).
 *
 * @param account - WDK wallet account
 */
export async function getUsdtBalance(account) {
    const contractAddress = getTokenAddress("USDT");
    return account.getTokenBalance(contractAddress);
}
/**
 * Returns the XAU₮ token balance in smallest unit (6 decimal places).
 *
 * @param account - WDK wallet account
 */
export async function getXautBalance(account) {
    const contractAddress = getTokenAddress("XAUT");
    return account.getTokenBalance(contractAddress);
}

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
export async function getPortfolioSnapshot(account, xautSpotUsdt) {
    const [address, ethWei, usdtMicro, xautMicro] = await Promise.all([
        account.getAddress(),
        getEthBalance(account),
        getUsdtBalance(account),
        getXautBalance(account),
    ]);
    const xautValueUsdt = xautSpotUsdt !== undefined ? (xautMicro * xautSpotUsdt) / 1000000n : 0n;
    return {
        address,
        ethWei,
        usdtMicro,
        xautMicro,
        totalValueUsdt: usdtMicro + xautValueUsdt,
        snapshotAt: Date.now(),
    };
}

/**
 * Formats a wei amount as a human-readable ETH string.
 * e.g. 1_000_000_000_000_000_000n → "1.000000 ETH"
 */
export function formatEth(wei) {
    const eth = Number(wei) / 1e18;
    return `${eth.toFixed(6)} ETH`;
}
/**
 * Formats a micro-USDT amount as a human-readable USD₮ string.
 * e.g. 1_000_000n → "1.000000 USD₮"
 */
export function formatUsdt(microUsdt) {
    const usdt = Number(microUsdt) / 1e6;
    return `${usdt.toFixed(6)} USD₮`;
}
/**
 * Formats a micro-XAUT amount as a human-readable XAU₮ string.
 * e.g. 1_000_000n → "1.000000 XAU₮"
 */
export function formatXaut(microXaut) {
    const xaut = Number(microXaut) / 1e6;
    return `${xaut.toFixed(6)} XAU₮`;
}
/**
 * Converts a PortfolioSnapshot to a human-readable PortfolioDisplay.
 */
export function formatPortfolio(snapshot) {
    return {
        address: snapshot.address,
        ethBalance: formatEth(snapshot.ethWei),
        usdtBalance: formatUsdt(snapshot.usdtMicro),
        xautBalance: formatXaut(snapshot.xautMicro),
        snapshotAt: new Date(snapshot.snapshotAt).toISOString(),
    };
}

/** Minimum ETH balance required to pay gas fees (0.005 ETH in wei). */
export const MIN_ETH_FOR_GAS = 5000000000000000n;
/**
 * Returns true if the account has enough ETH to pay for at least one
 * typical ERC-20 transfer (0.005 ETH at 50 gwei, 100k gas).
 */
export function hasEnoughGas(ethWei) {
    return ethWei >= MIN_ETH_FOR_GAS;
}
