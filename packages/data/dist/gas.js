/**
 * @file gas.ts
 * @description Gas price estimation and EIP-1559 fee modeling.
 *
 * The agent uses gas costs to:
 *   1. Calculate the true cost of an action (EV denominator)
 *   2. Decide whether a profitable trade is still worth executing
 *      when network fees are high
 *   3. Select "normal" vs "fast" fee tiers based on urgency
 *
 * @license Apache-2.0
 */
import { ethers } from "ethers";
/** Gas units consumed by common operation types. */
export const GAS_UNITS = {
    /** ERC-20 transfer (approve + transfer). */
    erc20Transfer: 65000n,
    /** Entering a prediction market position. */
    marketEnter: 150000n,
    /** Exiting / redeeming a prediction market position. */
    marketExit: 100000n,
    /** Rebalancing (two transfers). */
    rebalance: 130000n,
    /** Cross-chain USDT0 bridge via LayerZero. */
    bridge: 300000n,
};

function weiToGwei(wei) {
    return Number(wei) / 1e9;
}
function gweiToUsd(gwei, gasUnits, ethPriceUsd) {
    const weiCost = gwei * 1e9 * Number(gasUnits);
    return (weiCost / 1e18) * ethPriceUsd;
}

/**
 * Fetches current gas prices from the network and calculates cost estimates.
 *
 * @param rpcUrl      - JSON-RPC endpoint
 * @param ethPriceUsd - Current ETH/USD price (from oracle)
 */
export async function fetchGasSnapshot(rpcUrl, ethPriceUsd) {
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const feeData = await provider.getFeeData();
        const baseFeeWei = feeData.gasPrice ?? 20000000000n; // fallback: 20 gwei
        const maxFeeWei = feeData.maxFeePerGas ?? baseFeeWei * 2n;
        const priorityFeeWei = feeData.maxPriorityFeePerGas ?? 1500000000n;
        const baseFeeGwei = weiToGwei(baseFeeWei);
        const maxFeeGwei = weiToGwei(maxFeeWei);
        const priorityFeeGwei = weiToGwei(priorityFeeWei);
        const fastMaxFeeGwei = maxFeeGwei * 1.2;
        return {
            baseFeeGwei,
            priorityFeeGwei,
            maxFeeGwei,
            fastMaxFeeGwei,
            erc20TransferCostUsd: gweiToUsd(maxFeeGwei, GAS_UNITS.erc20Transfer, ethPriceUsd),
            snapshotAt: Date.now(),
        };
    }
    catch {
        // Conservative fallback if RPC is unavailable
        const baseFeeGwei = 25;
        return {
            baseFeeGwei,
            priorityFeeGwei: 1.5,
            maxFeeGwei: baseFeeGwei * 2,
            fastMaxFeeGwei: baseFeeGwei * 2.4,
            erc20TransferCostUsd: gweiToUsd(baseFeeGwei * 2, GAS_UNITS.erc20Transfer, ethPriceUsd),
            snapshotAt: Date.now(),
        };
    }
}
/**
 * Calculates the USD cost of executing a specific operation at current gas prices.
 *
 * @param gas           - Gas snapshot
 * @param operation     - Type of operation (determines gas units)
 * @param ethPriceUsd   - Current ETH/USD price
 * @param useFastFees   - Whether to use fast fee tier (default: false)
 */
export function estimateOperationCostUsd(gas, operation, ethPriceUsd, useFastFees = false) {
    const feeGwei = useFastFees ? gas.fastMaxFeeGwei : gas.maxFeeGwei;
    return gweiToUsd(feeGwei, GAS_UNITS[operation], ethPriceUsd);
}
/**
 * Returns true if the network is congested (base fee above threshold).
 * The agent uses this to delay non-urgent executions.
 *
 * @param gas              - Gas snapshot
 * @param maxBaseFeeGwei   - Congestion threshold in gwei (default: 50)
 */
export function isNetworkCongested(gas, maxBaseFeeGwei = 50) {
    return gas.baseFeeGwei > maxBaseFeeGwei;
}
/**
 * Returns the minimum USD profit required for a trade to be net-positive
 * after gas costs (i.e. the break-even profit).
 *
 * @param gas         - Gas snapshot
 * @param operation   - Operation type
 * @param ethPriceUsd - ETH/USD price
 */
export function breakEvenProfitUsd(gas, operation, ethPriceUsd) {
    // Entry + exit costs (worst case: both operations needed to realise profit)
    const entryCost = estimateOperationCostUsd(gas, operation, ethPriceUsd);
    const exitCost = estimateOperationCostUsd(gas, "marketExit", ethPriceUsd);
    return entryCost + exitCost;
}
