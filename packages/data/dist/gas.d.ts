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
export interface GasSnapshot {
    /** Base fee of the latest block, in gwei. */
    baseFeeGwei: number;
    /** Recommended priority tip for normal inclusion, in gwei. */
    priorityFeeGwei: number;
    /** Total recommended max fee per gas (EIP-1559), in gwei. */
    maxFeeGwei: number;
    /** Gas snapshot for "fast" (next block) inclusion, in gwei. */
    fastMaxFeeGwei: number;
    /** Estimated cost of a simple ERC-20 transfer at normal fees, in USD. */
    erc20TransferCostUsd: number;
    /** Unix timestamp of snapshot (ms). */
    snapshotAt: number;
}
/** Gas units consumed by common operation types. */
export declare const GAS_UNITS: {
    /** ERC-20 transfer (approve + transfer). */
    readonly erc20Transfer: 65000n;
    /** Entering a prediction market position. */
    readonly marketEnter: 150000n;
    /** Exiting / redeeming a prediction market position. */
    readonly marketExit: 100000n;
    /** Rebalancing (two transfers). */
    readonly rebalance: 130000n;
    /** Cross-chain USDT0 bridge via LayerZero. */
    readonly bridge: 300000n;
};
export type OperationType = keyof typeof GAS_UNITS;
/**
 * Fetches current gas prices from the network and calculates cost estimates.
 *
 * @param rpcUrl      - JSON-RPC endpoint
 * @param ethPriceUsd - Current ETH/USD price (from oracle)
 */
export declare function fetchGasSnapshot(rpcUrl: string, ethPriceUsd: number): Promise<GasSnapshot>;
/**
 * Calculates the USD cost of executing a specific operation at current gas prices.
 *
 * @param gas           - Gas snapshot
 * @param operation     - Type of operation (determines gas units)
 * @param ethPriceUsd   - Current ETH/USD price
 * @param useFastFees   - Whether to use fast fee tier (default: false)
 */
export declare function estimateOperationCostUsd(gas: GasSnapshot, operation: OperationType, ethPriceUsd: number, useFastFees?: boolean): number;
/**
 * Returns true if the network is congested (base fee above threshold).
 * The agent uses this to delay non-urgent executions.
 *
 * @param gas              - Gas snapshot
 * @param maxBaseFeeGwei   - Congestion threshold in gwei (default: 50)
 */
export declare function isNetworkCongested(gas: GasSnapshot, maxBaseFeeGwei?: number): boolean;
/**
 * Returns the minimum USD profit required for a trade to be net-positive
 * after gas costs (i.e. the break-even profit).
 *
 * @param gas         - Gas snapshot
 * @param operation   - Operation type
 * @param ethPriceUsd - ETH/USD price
 */
export declare function breakEvenProfitUsd(gas: GasSnapshot, operation: OperationType, ethPriceUsd: number): number;
//# sourceMappingURL=gas.d.ts.map