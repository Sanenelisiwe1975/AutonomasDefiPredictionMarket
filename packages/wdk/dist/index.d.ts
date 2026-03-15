/**
 * @file index.ts
 * @description Public API surface of @repo/wdk.
 *
 * All wallet management, transaction execution, and account abstraction
 * utilities are re-exported from here so consuming packages only need
 * a single import path.
 *
 * @example
 * ```ts
 * import { createAgentWallet, transferUSDT, getPortfolioSnapshot } from "@repo/wdk";
 * ```
 *
 * @license Apache-2.0
 */
export { AgentWallet, createAgentWallet, type WalletConfig, type AccountInfo, } from "./wallet.js";
export { transferToken, transferUSDT, transferXAUT, quoteTransfer, getTokenAddress, type TokenSymbol, type TransferParams, type TransferResult, type TransferQuote, } from "./transactions.js";
export { getEthBalance, getUsdtBalance, getXautBalance, getPortfolioSnapshot, formatEth, formatUsdt, formatXaut, formatPortfolio, hasEnoughGas, MIN_ETH_FOR_GAS, type PortfolioSnapshot, type PortfolioDisplay, } from "./accounts.js";
//# sourceMappingURL=index.d.ts.map