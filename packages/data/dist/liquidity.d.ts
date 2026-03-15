/**
 * @file liquidity.ts
 * @description On-chain liquidity depth queries for prediction markets
 * and Uniswap V3 pools.
 *
 * Used in the Observe phase to determine:
 *   - Whether a market has sufficient liquidity to enter/exit
 *   - Estimated price impact for the agent's position size
 *   - Available yield opportunities in LP pools
 *
 * @license Apache-2.0
 */
export interface LiquiditySnapshot {
    /** Market or pool identifier. */
    id: string;
    /** Total locked value in USD (approximation). */
    tvlUsd: number;
    /** Available liquidity for swaps/bets in USD. */
    availableLiquidityUsd: number;
    /** Estimated price impact (%) for a $100 trade. */
    priceImpact100Usd: number;
    /** Annual percentage yield (for LP positions, 0 if not applicable). */
    aprPct: number;
    /** Unix timestamp of snapshot. */
    snapshotAt: number;
}
export interface PoolInfo {
    address: string;
    token0: string;
    token1: string;
    fee: number;
    sqrtPriceX96: bigint;
    liquidity: bigint;
    tick: number;
}
/**
 * Fetches a liquidity snapshot for the USDT/ETH Uniswap V3 pool.
 * Falls back to mock data on testnet.
 *
 * @param rpcUrl      - JSON-RPC endpoint
 * @param network     - "mainnet" | "sepolia"
 * @param ethPriceUsd - Current ETH price in USD (from oracle)
 */
export declare function fetchUsdtEthLiquidity(rpcUrl: string, network: string, ethPriceUsd: number): Promise<LiquiditySnapshot>;
/**
 * Returns mock prediction market liquidity snapshots.
 * In production this queries the deployed MarketFactory contract
 * and enumerates active prediction markets.
 *
 * @param marketIds - List of market IDs to query
 */
export declare function fetchPredictionMarketLiquidity(marketIds: string[]): Promise<LiquiditySnapshot[]>;
/**
 * Checks whether a market has sufficient liquidity to absorb the agent's position.
 *
 * @param snapshot       - Liquidity snapshot for the market
 * @param positionSizeUsd - Intended position size in USD
 * @param maxImpactPct    - Maximum acceptable price impact (default: 1%)
 */
export declare function hasSufficientLiquidity(snapshot: LiquiditySnapshot, positionSizeUsd: number, maxImpactPct?: number): boolean;
//# sourceMappingURL=liquidity.d.ts.map