# Autonomous DeFi Agent

An autonomous on-chain agent that continuously observes DeFi markets, reasons about opportunities using GPT-4o, decides risk-adjusted positions, executes trades via the Tether WDK, and learns from every cycle — all without human intervention.

Built for the **Tether Hackathon Galáctica: WDK Edition 1** — Track: Autonomous DeFi Agent.

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                        Agent Loop                            │
│                                                              │
│  Observe  →  Reason  →  Decide  →  Execute  →  Learn        │
│    │            │           │          │           │         │
│  Prices      GPT-4o      EV + Risk   WDK +      Postgres    │
│  Gas         Planning    Gates       Contracts   Redis       │
│  Liquidity   (OpenClaw)              Transfers   JSON log    │
└──────────────────────────────────────────────────────────────┘
```

1. **Observe** — fetches ETH/USDT/XAUT prices (Chainlink + CoinGecko fallback), gas snapshot, Uniswap V3 liquidity, and active prediction market opportunities.
2. **Reason** — sends the full market state to GPT-4o via LangChain.js; receives a ranked list of `AgentAction` objects (OpenClaw engine).
3. **Decide** — applies global risk gates (USDT depeg halt, gas congestion halt) and per-action filters (min EV > 2%, max position size 5%, risk score ≤ 70).
4. **Execute** — routes approved actions to on-chain operations via the Tether WDK (`transferUSDT`, `transferXAUT`) and Solidity contract calls.
5. **Learn** — persists cycle outcomes to a JSON log, PostgreSQL, and Redis (publishes `agent:events`, sets `agent:latest` for the dashboard).

---

## Monorepo Structure

```
autonomous-defi-agent/
├── apps/
│   └── web/                  # Next.js 14 real-time dashboard
├── packages/
│   ├── agent/                # Autonomous loop (observe→learn)
│   ├── contracts/            # Solidity: AgentVault, PredictionMarket, MarketFactory
│   ├── data/                 # Oracle, Uniswap V3 liquidity, gas feeds
│   ├── planner/              # OpenClaw reasoning engine (LangChain.js + GPT-4o)
│   ├── wdk/                  # Tether WDK wallet wrapper
│   ├── ui/                   # Shared React components
│   ├── eslint-config/        # Shared ESLint presets
│   └── typescript-config/    # Shared tsconfig bases
├── infra/
│   ├── docker-compose.yml    # Postgres 16 + Redis 7
│   └── init.sql              # Database schema
└── .env.example              # All required environment variables
```

Each package has its own README with detailed API docs.

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis)
- An Ethereum RPC endpoint (Alchemy, Infura, or local node)
- OpenAI API key (optional — falls back to mock planner)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Fill in SEED_PHRASE, ETH_RPC_URL, OPENAI_API_KEY, etc.
```

### 4. Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 5. Build all packages

```bash
npm run build
```

### 6. Deploy contracts (Sepolia)

```bash
cd packages/contracts
npx hardhat run scripts/deploy.ts --network sepolia
# Copy the MarketFactory address into .env as MARKET_FACTORY_ADDRESS
```

### 7. Run the agent

```bash
npm run dev -w packages/agent   # development (hot-reload)
# or
npm run start -w packages/agent # production (requires build)
```

### 8. Open the dashboard

```bash
npm run dev -w apps/web
# → http://localhost:3000/dashboard
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SEED_PHRASE` | Yes | BIP-39 wallet mnemonic (12 or 24 words) |
| `ETH_RPC_URL` | Yes | Ethereum JSON-RPC endpoint |
| `OPENAI_API_KEY` | No | GPT-4o key (mock planner used if absent) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `USDT_CONTRACT_ADDRESS` | Yes | USD₮ ERC-20 contract address |
| `XAUT_CONTRACT_ADDRESS` | Yes | XAU₮ ERC-20 contract address |
| `MARKET_FACTORY_ADDRESS` | Yes | Deployed MarketFactory address |
| `TRANSFER_MAX_FEE` | No | Max gas per transfer in wei (default `5000000000000000`) |
| `CYCLE_INTERVAL_MS` | No | Agent loop interval in ms (default `60000`) |
| `CHAINLINK_ETH_USD` | No | Chainlink ETH/USD price feed address |
| `CHAINLINK_XAUT_USD` | No | Chainlink XAU/USD price feed address |
| `UNISWAP_USDT_ETH_POOL` | No | Uniswap V3 USDT/ETH pool address |

See `.env.example` for the full list with default values.

---

## Smart Contracts

| Contract | Purpose |
|---|---|
| `AgentVault` | Holds USD₮ deposits; exposes `agentWithdrawUsdt()` for the agent |
| `PredictionMarket` | Binary AMM — YES/NO outcome token market |
| `OutcomeToken` | ERC-20 representing a single market outcome |
| `MarketFactory` | Creates and registers `PredictionMarket` instances |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Wallet | Tether WDK (`@tetherto/wdk-wallet-evm`) |
| AI Planning | LangChain.js + GPT-4o (JSON mode) |
| Price Feeds | Chainlink AggregatorV3 + CoinGecko fallback |
| DEX Data | Uniswap V3 pool queries via ethers.js |
| Smart Contracts | Solidity 0.8 + Hardhat + TypeChain |
| Dashboard | Next.js 14 App Router + Recharts |
| Database | PostgreSQL 16 |
| Cache / PubSub | Redis 7 |
| Monorepo | Turborepo + npm workspaces |
| Language | TypeScript ESM throughout |

---

## Development Commands

```bash
npm run build          # Build all packages (respects dependency order)
npm run dev            # Start all packages in watch mode
npm run lint           # Lint all packages
npm run check-types    # Type-check all packages
npm run clean          # Remove all dist/ directories
```

Run a single package with `--filter`:

```bash
npm run build -- --filter=@repo/agent
npm run dev   -- --filter=@repo/planner
```
