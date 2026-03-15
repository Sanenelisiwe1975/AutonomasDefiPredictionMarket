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
import { ethers } from "ethers";

const UNISWAP_POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function liquidity() external view returns (uint128)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
];

const USDT_ETH_POOLS = {
    mainnet: "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36", // USDT/WETH 0.05%
    sepolia: "", // No official Uniswap V3 on Sepolia — use mock
};

/**
 * Fetches on-chain pool state for a Uniswap V3 pool.
 * Returns null if the pool address is not set (testnet).
 */
async function fetchPoolInfo(provider, poolAddress) {
    if (!poolAddress)
        return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pool = new ethers.Contract(poolAddress, UNISWAP_POOL_ABI, provider);
        const slot0 = (await pool.slot0());
        const liquidity = (await pool.liquidity());
        const token0 = (await pool.token0());
        const token1 = (await pool.token1());
        const fee = (await pool.fee());
        return {
            address: poolAddress,
            token0: token0,
            token1: token1,
            fee: Number(fee),
            sqrtPriceX96: slot0[0],
            liquidity: liquidity,
            tick: Number(slot0[1]),
        };
    }
    catch {
        return null;
    }
}
/**
 * Estimates USD TVL from Uniswap V3 pool liquidity.
 * This is a rough approximation — accurate TVL requires full tick math.
 *
 * @param liquidity - Raw pool liquidity (uint128)
 * @param ethPriceUsd - Current ETH/USD price
 */
function estimateTvlUsd(liquidity, ethPriceUsd) {
    // Simplified: treat liquidity units as proportional to TVL
    // Real implementation would use the full concentrated liquidity formula
    return (Number(liquidity) / 1e12) * ethPriceUsd * 2;
}

/**
 * Fetches a liquidity snapshot for the USDT/ETH Uniswap V3 pool.
 * Falls back to mock data on testnet.
 *
 * @param rpcUrl      - JSON-RPC endpoint
 * @param network     - "mainnet" | "sepolia"
 * @param ethPriceUsd - Current ETH price in USD (from oracle)
 */
export async function fetchUsdtEthLiquidity(rpcUrl, network, ethPriceUsd) {
    const poolAddress = USDT_ETH_POOLS[network] ?? "";
    const now = Date.now();
    if (!poolAddress) {
        // Return plausible mock data for testnet development
        return {
            id: "usdt-eth-uniswap-v3",
            tvlUsd: 150_000_000,
            availableLiquidityUsd: 80_000_000,
            priceImpact100Usd: 0.001,
            aprPct: 12.4,
            snapshotAt: now,
        };
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const pool = await fetchPoolInfo(provider, poolAddress);
    if (!pool) {
        return {
            id: "usdt-eth-uniswap-v3",
            tvlUsd: 0,
            availableLiquidityUsd: 0,
            priceImpact100Usd: 999,
            aprPct: 0,
            snapshotAt: now,
        };
    }
    const tvlUsd = estimateTvlUsd(pool.liquidity, ethPriceUsd);
    return {
        id: "usdt-eth-uniswap-v3",
        tvlUsd,
        availableLiquidityUsd: tvlUsd * 0.5,
        priceImpact100Usd: tvlUsd > 0 ? (100 / tvlUsd) * 100 : 999,
        aprPct: pool.fee / 100, // very rough APR proxy from fee tier
        snapshotAt: now,
    };
}
/**
 * Returns mock prediction market liquidity snapshots.
 * In production this queries the deployed MarketFactory contract
 * and enumerates active prediction markets.
 *
 * @param marketIds - List of market IDs to query
 */
export async function fetchPredictionMarketLiquidity(marketIds) {
    // TODO: Replace with real on-chain calls to MarketFactory / PredictionMarket
    return marketIds.map((id) => ({
        id,
        tvlUsd: Math.random() * 500_000 + 10_000,
        availableLiquidityUsd: Math.random() * 100_000 + 1_000,
        priceImpact100Usd: Math.random() * 0.5,
        aprPct: 0,
        snapshotAt: Date.now(),
    }));
}
/**
 * Checks whether a market has sufficient liquidity to absorb the agent's position.
 *
 * @param snapshot       - Liquidity snapshot for the market
 * @param positionSizeUsd - Intended position size in USD
 * @param maxImpactPct    - Maximum acceptable price impact (default: 1%)
 */
export function hasSufficientLiquidity(snapshot, positionSizeUsd, maxImpactPct = 1.0) {
    if (snapshot.availableLiquidityUsd < positionSizeUsd)
        return false;
    const estimatedImpact = (positionSizeUsd / snapshot.tvlUsd) * 100 * snapshot.priceImpact100Usd;
    return estimatedImpact <= maxImpactPct;
}
