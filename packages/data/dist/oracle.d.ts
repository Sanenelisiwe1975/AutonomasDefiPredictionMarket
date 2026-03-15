/**
 * @file oracle.ts
 * @description On-chain price oracle via Chainlink AggregatorV3 feeds,
 * with a CoinGecko REST API fallback for when on-chain calls fail.
 *
 * Supported feeds (Ethereum / Sepolia):
 *   - ETH / USD
 *   - USDT / USD  (for depeg detection)
 *   - XAU / USD   (spot gold ,proxy for XAU₮)
 *
 * All returned prices are plain JavaScript numbers in USD.
 *
 * @license Apache-2.0
 */
export interface PriceData {
    /** Asset symbol (ETH, USDT, XAU). */
    symbol: string;
    /** Price in USD. */
    priceUsd: number;
    /** Unix timestamp of the feed round (seconds). */
    updatedAt: number;
    /** Data source: "chainlink" | "coingecko" | "fallback". */
    source: "chainlink" | "coingecko" | "fallback";
}
export interface OraclePrices {
    eth: PriceData;
    usdt: PriceData;
    xau: PriceData;
    fetchedAt: number;
}
/**
 * Fetches current prices for ETH, USDT, and XAU.
 *
 * Tries Chainlink on-chain feeds first; falls back to CoinGecko if the
 * RPC call fails (network issues, wrong chain, missing feed on testnet).
 *
 * @param rpcUrl  - JSON-RPC endpoint (same as WALLET_RPC_URL)
 * @param network - "mainnet" | "sepolia" (default: "sepolia")
 */
export declare function fetchPrices(rpcUrl: string, network?: string): Promise<OraclePrices>;
/**
 * Checks for a USD₮ depeg (price deviating >0.5% from $1.00).
 * Used as a risk gate: the agent skips execution if USDT is depegged.
 */
export declare function isUsdtDepegged(prices: OraclePrices, thresholdPct?: number): boolean;
//# sourceMappingURL=oracle.d.ts.map