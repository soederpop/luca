# Polymarket Arbitrage & Whale Intelligence Bot

## Vision

A Luca-powered prediction market trading system that:

1. **Tracks whale activity** on Polymarket by ingesting on-chain trade events from Polygon
2. **Detects coordinated clusters** of wallets that consistently bet together (timing, direction, markets)
3. **Generates trading signals** from external data sources (NOAA weather, FRED economics, etc.) and compares model-implied probabilities to market prices
4. **Executes trades** on Polymarket's CLOB with pluggable strategy modules
5. **Cross-platform arbitrage** detection between Polymarket and Kalshi

This maps naturally to Luca's layered architecture: the clients, features, and observable state are exactly the primitives needed to build a real-time trading system with introspectable, composable parts.

---

## Architecture: How It Maps to Luca

### Layer 2: `PredictionMarketContainer`

A new second-layer container (like `AGIContainer`) that provides everything needed for prediction market trading as a reusable foundation.

```
src/prediction-market/
  container.ts              # PredictionMarketContainer extends NodeContainer
  index.ts                  # Re-exports container singleton
```

```ts
// container.ts
export class PredictionMarketContainer extends NodeContainer {
  polymarket!: PolymarketClient
  kalshi!: KalshiClient
  noaa!: NoaaClient
  polygon!: PolygonRpcClient

  // Features accessible after .use()
  whaleTracker!: WhaleTracker
  clusterDetector!: ClusterDetector
  strategyRunner!: StrategyRunner
  tradeExecutor!: TradeExecutor
}

const container = new PredictionMarketContainer()
  // Clients
  .use(PolymarketClient)       // CLOB API + Gamma API
  .use(KalshiClient)           // Kalshi REST + WebSocket
  .use(NoaaClient)             // Weather data
  .use(FredClient)             // Economic data
  .use(PolygonRpcClient)       // On-chain Polygon events
  // Features
  .use(WhaleTracker)           // Real-time whale monitoring
  .use(ClusterDetector)        // Graph-based cluster analysis
  .use(StrategyRunner)         // Pluggable strategy engine
  .use(TradeExecutor)          // Order management + risk controls
  .use(MarketScanner)          // Market discovery + filtering
  .use(ArbitrageDetector)      // Cross-platform price discrepancy finder
  .use(DataPipeline)           // Scheduler for data source polling
```

---

## Clients

### 1. `PolymarketClient` — CLOB + Gamma APIs

```
src/prediction-market/clients/polymarket/index.ts
```

Extends `RestClient`. Two logical sub-clients (CLOB for trading, Gamma for market metadata) behind one interface.

**State:**
```ts
interface PolymarketClientState extends ClientState {
  connected: boolean
  apiKey?: string
  walletAddress?: string
  activeOrders: number
  totalVolume: number
}
```

**Key Methods:**
```
Markets (Gamma API - https://gamma-api.polymarket.com):
  listMarkets(filters?)          — Browse/search active markets
  getMarket(conditionId)         — Market details, resolution source, outcomes
  getMarketBySlug(slug)          — Lookup by URL slug

Order Book (CLOB API - https://clob.polymarket.com):
  getOrderBook(tokenId)          — Full depth for a specific outcome token
  getMidpoint(tokenId)           — Current mid price
  getSpread(tokenId)             — Bid-ask spread
  getLastTradePrice(tokenId)     — Most recent fill

Trading:
  createOrder(params)            — Place limit order (signed with wallet)
  cancelOrder(orderId)           — Cancel open order
  cancelAll()                    — Cancel all open orders
  getOpenOrders()                — List active orders
  getTradeHistory(params?)       — Own trade history

Live Data (WebSocket):
  subscribeOrderBook(tokenId)    — Real-time order book updates
  subscribeTrades(tokenId)       — Real-time trade feed
  subscribePrice(tokenId)        — Price tick stream
```

**Auth:** Polygon wallet signing. Orders are signed EIP-712 messages. The `py-clob-client` reference implementation shows the signing flow — we'd port this to ethers.js / viem in TypeScript.

**Events emitted:**
- `orderPlaced`, `orderFilled`, `orderCancelled`
- `priceUpdate(tokenId, price)`
- `tradeReceived(trade)`

---

### 2. `KalshiClient` — REST + WebSocket

```
src/prediction-market/clients/kalshi/index.ts
```

Extends `RestClient`. For cross-platform arbitrage and price comparison.

**Key Methods:**
```
Markets:
  listEvents(params?)            — Browse event categories
  getEvent(eventTicker)          — Event details
  listMarkets(eventTicker?)      — Markets within an event
  getMarket(ticker)              — Single market details
  getOrderBook(ticker)           — Order book depth

Trading:
  createOrder(params)            — Place order
  cancelOrder(orderId)           — Cancel order
  getPositions()                 — Current positions
  getPortfolio()                 — Portfolio summary

Live Data:
  subscribeOrderBook(ticker)     — WebSocket order book
  subscribeTrades(ticker)        — WebSocket trade feed
```

**Auth:** API key + private key signing (RSA). Kalshi provides REST, WebSocket, and FIX 4.4 protocol APIs.

---

### 3. `PolygonRpcClient` — On-Chain Event Ingestion

```
src/prediction-market/clients/polygon-rpc/index.ts
```

Extends `Client` (not RestClient — uses ethers.js/viem directly). This is the backbone of whale tracking.

**Key Methods:**
```
Events:
  subscribeOrderFilled(exchangeAddr)   — Listen for OrderFilled events in real-time
  subscribeOrdersMatched(exchangeAddr) — Listen for batch match events
  getHistoricalFills(params)           — Query past OrderFilled events (block range)

Wallet Analysis:
  getTokenBalance(wallet, tokenId)     — Position size for a wallet in a market
  getTransactionHistory(wallet)        — All txns for a wallet
  getWalletAge(wallet)                 — First transaction timestamp
  getFundingSource(wallet)             — Trace where initial capital came from

Contracts (decoded):
  CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
  NEGRISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a'
```

**State:**
```ts
interface PolygonRpcState extends ClientState {
  blockHeight: number
  eventsProcessed: number
  lastProcessedBlock: number
}
```

**Events emitted:**
- `orderFilled(event)` — Every decoded fill from either exchange contract
- `whaleTrade(event)` — Fills above a configurable USD threshold (e.g. $10K)
- `newBlock(blockNumber)`

---

### 4. `NoaaClient` — Weather Data

```
src/prediction-market/clients/noaa/index.ts
```

Extends `RestClient`. Wraps both the NWS forecast API and the NCEI historical API.

**Key Methods:**
```
Forecasts (api.weather.gov — no auth required):
  getForecast(lat, lon)                — 7-day 12-hour period forecast
  getHourlyForecast(lat, lon)          — Hourly forecast
  getGridData(office, gridX, gridY)    — Raw numerical grid (temp, precip prob, wind, etc.)
  getLatestObservation(stationId)      — Current conditions at a station
  getActiveAlerts(state | point)       — Severe weather alerts

Historical (NCEI API — free token required):
  getDailyData(stationId, dateRange)   — Historical daily summaries (GHCND)
  getMonthlyNormals(stationId)         — 30-year climate normals
  getStations(bbox | locationId)       — Find weather stations near a point

Model Data:
  getGFSForecast(lat, lon)             — Latest GFS model run (via NOMADS)
  getECMWFForecast(lat, lon)           — ECMWF if accessible
```

**State:**
```ts
interface NoaaClientState extends ClientState {
  apiToken?: string           // NCEI token
  lastForecastFetch?: string  // ISO timestamp
  modelRunTime?: string       // Latest GFS run time (00z, 06z, 12z, 18z)
}
```

---

### 5. `FredClient` — Economic Data

```
src/prediction-market/clients/fred/index.ts
```

Extends `RestClient`. Federal Reserve Economic Data for economic prediction markets.

**Key Methods:**
```
  getSeries(seriesId)                — Metadata for a data series
  getObservations(seriesId, params?) — Actual data points (GDP, CPI, unemployment, etc.)
  searchSeries(query)                — Find relevant series
  getRecentUpdates()                 — Recently updated series (detect new releases)
```

---

## Features

### 1. `WhaleTracker` — Real-Time Whale Monitoring

```
src/prediction-market/features/whale-tracker.ts
```

Consumes `PolygonRpcClient` events. Maintains a live database of whale wallets and their activity.

**State:**
```ts
interface WhaleTrackerState extends FeatureState {
  trackedWallets: number
  totalTradesIngested: number
  whaleThresholdUsd: number        // Default: $10,000
  lastTradeTimestamp?: string
}
```

**Key Methods:**
```
Core:
  start()                            — Begin listening to on-chain events
  stop()                             — Pause monitoring

Wallet Intelligence:
  getWalletProfile(address)          — Full profile: total volume, win rate, markets traded, P&L
  getTopWallets(metric, limit?)      — Leaderboard by volume, profit, win rate
  getWalletPositions(address)        — Current open positions
  getWalletHistory(address, params?) — Trade history with P&L per trade

Alerts:
  watchWallet(address, label?)       — Add to watch list
  unwatchWallet(address)             — Remove from watch list
  getWatchedWallets()                — List watched wallets
  onWhaleTrade(callback)             — Register alert handler
```

**Events emitted:**
- `whaleTrade(wallet, market, side, amount, price)`
- `newWhaleDetected(wallet, firstTrade)`
- `walletAlert(wallet, trade)` — For watched wallets

**Storage:** SQLite (via Bun's native SQLite) for persistent wallet profiles, trade history, and computed metrics. The DB acts as a local indexed mirror of on-chain data.

---

### 2. `ClusterDetector` — Coordinated Trading Detection

```
src/prediction-market/features/cluster-detector.ts
```

The analytical brain. Consumes WhaleTracker data and builds a transaction graph to identify groups of wallets that trade together.

**State:**
```ts
interface ClusterDetectorState extends FeatureState {
  clustersFound: number
  walletsAnalyzed: number
  lastAnalysisTimestamp?: string
  graphNodes: number
  graphEdges: number
}
```

**Key Methods:**
```
Graph Construction:
  buildTransactionGraph(timeRange?)    — Construct wallet→wallet graph from trade data
  updateGraph(newTrades)               — Incrementally add new trades to existing graph

Cluster Analysis:
  detectClusters(algorithm?)           — Run community detection (default: Louvain)
  getCluster(clusterId)                — Get all wallets in a cluster
  getClusters(minSize?)                — List all detected clusters
  getClusterActivity(clusterId)        — Recent trades by cluster members

Scoring:
  closureScore(walletOrCluster)        — Columbia method: fraction of volume staying in-cluster
  coordinationScore(wallet1, wallet2)  — How synchronized are two wallets? (0-1)
  jaccardSimilarity(wallet1, wallet2)  — Market overlap between two wallets
  timingCorrelation(wallet1, wallet2)  — Trade timing correlation coefficient

Detection Signals:
  detectFreshWalletSnipers()           — New wallets (<5 txns) making large first trades
  detectPositionMirroring(market)      — Multiple wallets taking identical positions simultaneously
  detectFundingChains()                — Wallets funded from the same source address

Real-time:
  onClusterTrade(callback)             — Alert when any cluster makes a coordinated move
  getClusterConsensus(market)          — What are the clusters betting on for a given market?
```

**Algorithms (pluggable):**
- **Louvain** — Default. Community detection optimizing modularity.
- **DBSCAN** — Density-based clustering on behavioral feature vectors.
- **Label Propagation** — Faster alternative for large graphs.
- Custom — Implement the `ClusterAlgorithm` interface.

**Graph library:** Use `graphology` (npm) — lightweight, performant JS graph library. Louvain implementation exists as `graphology-communities-louvain`.

---

### 3. `StrategyRunner` — Pluggable Strategy Engine

```
src/prediction-market/features/strategy-runner.ts
```

The strategy execution framework. Strategies are pluggable modules that consume data and emit trade signals.

**State:**
```ts
interface StrategyRunnerState extends FeatureState {
  activeStrategies: string[]
  totalSignalsGenerated: number
  lastSignalTimestamp?: string
}
```

**Key Methods:**
```
Management:
  registerStrategy(name, strategy)    — Add a strategy module
  enableStrategy(name)                — Activate a strategy
  disableStrategy(name)               — Deactivate without removing
  listStrategies()                    — All registered strategies + status

Execution:
  runOnce(strategyName, market?)      — One-shot evaluation
  startContinuous(strategyName)       — Start polling/streaming loop
  stopAll()                           — Stop all continuous strategies

Signals:
  getSignals(params?)                 — Query generated signals
  onSignal(callback)                  — Subscribe to new signals
```

**Strategy Interface:**
```ts
interface Strategy {
  name: string
  description: string

  // What data sources does this strategy need?
  requiredClients: string[]       // e.g. ['noaa', 'polymarket']

  // What markets does this strategy apply to?
  marketFilter(market: Market): boolean

  // Core logic: given data, produce trading signals
  evaluate(context: StrategyContext): Promise<Signal[]>

  // How often should this run? (for continuous mode)
  interval?: number               // ms between evaluations
}

interface Signal {
  strategy: string
  market: string
  tokenId: string
  direction: 'buy' | 'sell'
  confidence: number              // 0-1
  targetPrice: number             // Model-implied fair value
  currentPrice: number            // Current market price
  edge: number                    // targetPrice - currentPrice
  sizing: number                  // Suggested position size (USD)
  reasoning: string               // Human-readable explanation
  timestamp: string
}
```

**Built-in Strategies (Phase 1):**

#### a. `WeatherEdgeStrategy`
```
src/prediction-market/strategies/weather-edge.ts
```
- Pulls latest NWS grid data + GFS model forecasts
- Converts forecast distributions into probability buckets matching Polymarket's temperature contract structure (30-34F, 35-39F, etc.)
- Compares model-implied probabilities to market prices
- Generates buy signals where model probability > market price by a configurable threshold
- Supports "temperature laddering" — spreading bets across adjacent buckets
- Uses NCEI historical data for climatological baselines and calibration

#### b. `WhaleFollowStrategy`
```
src/prediction-market/strategies/whale-follow.ts
```
- Monitors whale wallets and detected clusters via WhaleTracker + ClusterDetector
- When a cluster of historically profitable wallets takes a coordinated position, generate a follow signal
- Configurable: minimum cluster size, minimum historical win rate, position size relative to cluster
- Delay parameter: wait N seconds after cluster signal to avoid front-running detection

#### c. `CrossPlatformArbStrategy`
```
src/prediction-market/strategies/cross-platform-arb.ts
```
- Compares prices for the same event across Polymarket and Kalshi
- Maps markets between platforms (manual mappings + fuzzy title matching)
- Generates arb signals when combined cost of covering all outcomes < $1.00 (minus fees)
- Accounts for Kalshi fees (~1.2%) and capital lockup cost

#### d. `LongshotBiasStrategy`
```
src/prediction-market/strategies/longshot-bias.ts
```
- Identifies markets where extreme outcomes (1-5%) are systematically overpriced
- Uses historical resolution rates to calibrate: "Of all markets priced at 3%, what fraction actually resolved YES?"
- Generates sell signals on overpriced longshots

---

### 4. `TradeExecutor` — Order Management & Risk

```
src/prediction-market/features/trade-executor.ts
```

Converts signals into actual orders with risk controls.

**State:**
```ts
interface TradeExecutorState extends FeatureState {
  mode: 'paper' | 'live'          // Paper trading by default!
  openPositions: number
  totalPnl: number
  dailyPnl: number
  maxDrawdown: number
  dailyVolumeUsd: number
}
```

**Key Methods:**
```
Execution:
  executeSignal(signal)              — Convert signal to order, respecting risk limits
  executeOrder(params)               — Direct order placement
  cancelOrder(orderId)               — Cancel specific order
  cancelAll()                        — Emergency: cancel everything

Positions:
  getPositions()                     — All open positions with current P&L
  getPosition(market)                — Position in a specific market
  closePosition(market)              — Market-sell to exit

Risk Controls:
  setMaxPositionSize(usd)            — Per-market position limit
  setMaxDailyVolume(usd)             — Daily volume cap
  setMaxDrawdown(pct)                — Stop-loss on total portfolio
  setMaxOpenPositions(n)             — Max concurrent positions
  setMode('paper' | 'live')          — Switch between paper and live

Performance:
  getPnlHistory(timeRange?)          — Historical P&L curve
  getTradeLog(params?)               — All executed trades with outcomes
  getStrategyPerformance(name)       — Per-strategy metrics
```

**Risk rules (enforced, not optional):**
- `paper` mode by default — no real trades until explicitly switched
- Maximum position size per market (default: $100)
- Maximum daily volume (default: $1,000)
- Maximum drawdown stop (default: 10%) — auto-cancels all orders and stops strategies
- Maximum open positions (default: 10)
- All limits configurable but always enforced

---

### 5. `MarketScanner` — Market Discovery

```
src/prediction-market/features/market-scanner.ts
```

Finds and categorizes tradeable markets.

**Key Methods:**
```
  scan(filters?)                      — Refresh market list from Gamma API
  getWeatherMarkets()                 — Filter for weather/temperature markets
  getEconomicMarkets()                — Filter for economic data markets
  getPoliticalMarkets()               — Filter for election/political markets
  getSportsMarkets()                  — Filter for sports markets
  getMarketsByVolume(min?)            — Filter by liquidity
  getMarketsByExpiry(before, after?)  — Filter by resolution date
  mapToKalshi(polymarketId)           — Find equivalent market on Kalshi (if any)
```

---

### 6. `ArbitrageDetector` — Cross-Platform Price Monitor

```
src/prediction-market/features/arbitrage-detector.ts
```

Continuously compares prices across platforms.

**Key Methods:**
```
  start()                             — Begin polling both platforms
  getOpportunities(minEdge?)          — Current arb opportunities
  getHistoricalArbs(timeRange?)       — Past opportunities and whether they were captured
  onOpportunity(callback)             — Real-time alert for new arb windows
```

---

### 7. `DataPipeline` — Scheduling & Data Freshness

```
src/prediction-market/features/data-pipeline.ts
```

Coordinates data source polling and ensures freshness.

**Key Methods:**
```
  schedule(source, interval, handler) — Schedule recurring data fetch
  runNow(source)                      — Force immediate refresh
  getStatus()                         — Last fetch time + health for each source
  onDataUpdate(source, callback)      — Subscribe to fresh data arrivals
```

**Default schedules:**
- Polymarket prices: WebSocket (real-time)
- On-chain events: WebSocket (real-time)
- Kalshi prices: 30s polling
- NWS forecasts: 15 min polling
- GFS model runs: Check every 30 min (new runs at 00z/06z/12z/18z)
- NCEI historical: Daily
- FRED economic: Hourly (detect new releases)

---

## Data Storage

**SQLite** (Bun native) for everything. Three databases:

```
data/
  trades.db         — All ingested on-chain trades (OrderFilled events)
  wallets.db        — Wallet profiles, cluster memberships, scores
  signals.db        — Generated signals, executed orders, P&L tracking
```

**Key tables in `trades.db`:**
```sql
trades (
  id, block_number, tx_hash, timestamp,
  maker_address, taker_address,
  market_condition_id, token_id, outcome,
  maker_amount, taker_amount, price_usd,
  exchange_contract
)

-- Indexed on: maker_address, taker_address, market_condition_id, timestamp
```

**Key tables in `wallets.db`:**
```sql
wallets (
  address, first_seen, last_seen,
  total_volume_usd, total_trades, win_rate,
  cluster_id, closure_score,
  label, is_watched
)

clusters (
  id, algorithm, detected_at,
  member_count, total_volume_usd,
  avg_win_rate, coordination_score
)

cluster_members (
  cluster_id, wallet_address, role
)
```

**Key tables in `signals.db`:**
```sql
signals (
  id, strategy, market, token_id,
  direction, confidence, target_price, current_price, edge,
  sizing, reasoning, timestamp,
  executed, order_id, fill_price, pnl
)

orders (
  id, polymarket_order_id, signal_id,
  market, token_id, side, price, size,
  status, fill_price, filled_at,
  created_at
)
```

---

## Observable State (Container-Level)

The container's top-level state provides a dashboard view:

```ts
interface PredictionMarketContainerState extends ContainerState {
  // System health
  polymarketConnected: boolean
  kalshiConnected: boolean
  polygonRpcConnected: boolean
  blockHeight: number

  // Whale intelligence
  trackedWallets: number
  clustersDetected: number
  whaleTradesLast24h: number

  // Trading
  mode: 'paper' | 'live'
  activeStrategies: string[]
  openPositions: number
  totalPnl: number
  dailyPnl: number

  // Data freshness
  lastForecastUpdate: string
  lastOnChainEvent: string
  lastKalshiSync: string
}
```

Because this is Luca, all of this is observable — any UI, REPL session, or agent can `container.state.observe()` and get real-time updates.

---

## Event Bus (Container-Level)

Key events flowing through `container.emit()`:

```
Market Data:
  'priceUpdate'          (market, tokenId, price, source)
  'orderBookUpdate'      (market, tokenId, depth)
  'newMarketDiscovered'  (market)

Whale Intelligence:
  'whaleTrade'           (wallet, market, side, amount)
  'clusterAlert'         (clusterId, market, side, memberCount)
  'newClusterDetected'   (clusterId, members)

Signals & Execution:
  'signalGenerated'      (signal)
  'orderPlaced'          (order)
  'orderFilled'          (order, fillPrice)
  'positionClosed'       (market, pnl)

Risk:
  'drawdownWarning'      (currentDrawdown, limit)
  'dailyLimitReached'    (volume, limit)
  'emergencyStop'        (reason)

Data Pipeline:
  'dataUpdate'           (source, timestamp)
  'dataStale'            (source, lastUpdate, threshold)
```

---

## Implementation Phases

### Phase 0: Foundation (Week 1)
- [ ] Scaffold `PredictionMarketContainer` and file structure
- [ ] Implement `PolymarketClient` (Gamma API for market data, CLOB for order books)
- [ ] Implement `PolygonRpcClient` (subscribe to OrderFilled events)
- [ ] Set up SQLite databases with schema
- [ ] Basic REPL commands: `container.polymarket.listMarkets()`, `container.polygon.subscribeOrderFilled()`

### Phase 1: Whale Intelligence (Week 2)
- [ ] Implement `WhaleTracker` — ingest trades, build wallet profiles
- [ ] Implement `ClusterDetector` — transaction graph, Louvain clustering, closure scores
- [ ] Backfill historical trade data (Dune Analytics export or historical block scanning)
- [ ] REPL: `container.whaleTracker.getTopWallets('volume', 20)`, `container.clusterDetector.getClusters()`

### Phase 2: Weather Strategy (Week 3)
- [ ] Implement `NoaaClient` — NWS forecasts + NCEI historical
- [ ] Implement `MarketScanner` — filter weather markets
- [ ] Implement `WeatherEdgeStrategy` — model-implied probabilities vs market prices
- [ ] Implement `StrategyRunner` — register and run strategies
- [ ] Implement `TradeExecutor` in **paper mode only**
- [ ] REPL: `container.strategyRunner.runOnce('weatherEdge')` → see signals

### Phase 3: Cluster Following + Arb (Week 4)
- [ ] Implement `WhaleFollowStrategy` — follow cluster consensus
- [ ] Implement `KalshiClient` — market data + order books
- [ ] Implement `ArbitrageDetector` — cross-platform price comparison
- [ ] Implement `CrossPlatformArbStrategy`
- [ ] Implement `DataPipeline` — coordinate all polling/streaming schedules

### Phase 4: Live Trading + Dashboard (Week 5+)
- [ ] Live trading mode with full risk controls
- [ ] Performance tracking and strategy comparison
- [ ] Express server with WebSocket push for real-time dashboard
- [ ] Web UI showing: whale activity feed, cluster map, active signals, P&L curve
- [ ] Alert system (Telegram/Discord via webhooks)

---

## Key Dependencies (new)

```json
{
  "ethers": "^6.x",             // or "viem" — Polygon RPC + contract event decoding
  "graphology": "^0.25",        // Graph data structure
  "graphology-communities-louvain": "^2.x",  // Louvain community detection
  "better-sqlite3": "^11.x",   // SQLite (or use Bun's built-in bun:sqlite)
  "ws": "already a dep",       // WebSocket (already in Luca)
  "axios": "already a dep"     // HTTP (already in Luca)
}
```

---

## REPL Experience

Because this is Luca, the REPL is a first-class interface. Example session:

```ts
// Explore available markets
const markets = await container.polymarket.listMarkets({ category: 'weather' })
// → [{ title: "NYC high temp on Feb 11?", outcomes: ["30-34", "35-39", ...], volume: 42000 }, ...]

// Check what whales are doing
const whales = await container.whaleTracker.getTopWallets('profit', 10)
// → [{ address: "0xabc...", totalPnl: 847000, winRate: 0.72, trades: 1204 }, ...]

// See detected clusters
const clusters = await container.clusterDetector.getClusters(5)
// → [{ id: "cluster_17", members: 8, totalVolume: 2400000, avgWinRate: 0.68, coordinationScore: 0.91 }, ...]

// What is cluster_17 betting on right now?
const consensus = await container.clusterDetector.getClusterConsensus('some-market-id')
// → { direction: 'YES', totalAmount: 45000, membersBetting: 6, avgPrice: 0.62 }

// Run weather strategy
const signals = await container.strategyRunner.runOnce('weatherEdge')
// → [{ market: "NYC high Feb 11", direction: 'buy', token: '35-39F', edge: 0.12, confidence: 0.78, reasoning: "GFS 12z run shows 37F median, market prices 35-39 bucket at 22%, model says 34%" }]

// Paper trade it
await container.tradeExecutor.executeSignal(signals[0])
// → { orderId: "paper_001", market: "NYC high Feb 11", side: "buy", price: 0.22, size: 50 }

// Check P&L
container.tradeExecutor.state.get('totalPnl')
// → 0 (just started!)
```

---

## Agentic AI Integration

Because `PredictionMarketContainer` is a Luca container, it inherits everything needed for the AGI vision:

- An AI agent with access to the container can **introspect** all available clients, features, strategies, their methods, state, and events
- It can **run strategies**, **analyze whale clusters**, **generate new strategy code at runtime** using the VM feature
- It can **observe state changes** and react to whale alerts, arb opportunities, or risk events autonomously
- The REPL + MCP server means Claude (or any LLM agent) can interact with the full system through tool use

A future `PredictionMarketAGIContainer` could extend both `AGIContainer` and `PredictionMarketContainer` patterns to create a self-improving trading agent that literally writes and tests new strategies, monitors their performance, and promotes the best ones to live trading.

---

## Risk & Legal Disclaimer

- **Paper trading mode is the default.** Live trading requires explicit opt-in.
- Polymarket is not available to US persons. This tool does not encourage or facilitate violation of any applicable laws.
- Prediction market trading involves financial risk. Position sizing and risk controls exist to limit downside.
- This is a tool for analysis and research. Users are responsible for their own trading decisions and legal compliance.
