# aster-bot Documentation

## Project Overview

aster-bot is a bot for automated trading and monitoring on the AsterDex exchange. The project supports multiple automated trading strategies, including trend and market-making strategies, suitable for quantitative trading, arbitrage, and other scenarios in the cryptocurrency market.

**Register with my referral link to get a 20% fee discount + extra points reward: [asterdex](https://www.asterdex.com/en/referral/375926)**

## Project Principles

This project interacts with the AsterDex API to achieve the following core functions:

- Real-time market monitoring: Obtain the latest prices and order book depth of trading pairs via WebSocket.
- Automated order placement: Automatically place buy and sell orders on AsterDex based on preset strategies.
- Strategy execution: Supports custom trading strategies such as arbitrage, trend following, and market making.
- Risk control & logging: Built-in basic risk control logic, records all operation logs for tracking and review.

API Documentation Reference:
- [AsterDex API Docs (Chinese)](https://github.com/asterdex/api-docs/blob/master/aster-finance-api_CN.md)
- [Bitget API Docs (Chinese)](https://www.bitget.com/zh-CN/api-doc/)

## Installation & Running

### Prerequisites

- Node.js 16 or above
- pnpm package manager

### Install Dependencies

```bash
pnpm install
```

### Configuration

Configure relevant parameters in the `.env` file, such as API Key, Secret, and trading pairs to monitor. Refer to the `env.example` file.

```env
BITGET_API_KEY=Your_Bitget_API_Key
BITGET_SECRET=Your_Bitget_Secret
ASTER_API_KEY=Your_AsterDex_API_Key
ASTER_API_SECRET=Your_AsterDex_API_Secret
# Other configuration items
```

### Start the Bot

#### 1. Start Trend Strategy (trend & recommended trendv2)

The trend strategy is based on SMA30 breakout, automatically determines long/short positions, and dynamically manages stop loss and take profit.

**It is recommended to use the new trendv2 strategy, which is more complete, has stronger risk control, and supports advanced features such as multiple order locks, dynamic stop loss, and trailing take profit.**

```bash
pnpm start
# or
pnpm trendV2
# or
npx tsx trendV2.tsx
```

> The old trend.ts is still available, but it is recommended to use trendv2.

#### Main advantages of trendv2:
- Multiple order locks to prevent risk control issues caused by concurrent orders
- Advanced risk control such as stop loss, trailing take profit, and automatic stop loss movement after profit
- Real-time market snapshots and order status tracking, automatically cancels invalid pending orders
- Clearer strategy logic and more detailed log output
- Compatible with the original SMA30 trend breakout logic, easy to migrate

### 2. Start Market Making Strategy (maker)

The market-making strategy automatically places both buy and sell orders on the order book. After a trade is executed, only the closing direction order is placed, with risk control stop loss.

```bash
pnpm maker
# or
npx tsx maker.ts
```

#### 3. Start Dual Exchange Hedging Strategy (bitget/aster)

```bash
pnpm cli:start
```

### Run Tests

```bash
pnpm test
```

## Main File Descriptions

- `bot.ts`: Main bot logic, including market monitoring, order placement, strategies, and other core functions.
- `trend.ts`: Trend strategy, based on SMA30 breakout for automatic long/short, supports dynamic stop loss and take profit.
- `maker.ts`: Market-making strategy, automatically places orders, after execution only places closing direction order, with risk control stop loss.
- `config.ts`: Configuration file, trading parameters.

## Strategy Descriptions

### 1. Trend Strategy (trend.ts & trendv2)

- Real-time monitoring of order book and prices, calculates SMA30.
- Automatically goes long when price crosses above SMA30, short when below.
- After holding a position, automatically places stop loss and dynamic take profit orders, supports moving stop loss after profit.
- Supports risk control, automatically closes position if loss exceeds limit.
- Console outputs current status, position, cumulative profit, and recent trade records in real time.

### 2. Market Making Strategy (maker.ts)

- When no position, automatically places buy/sell orders at best bid/ask; after execution, only places closing direction order.
- Automatically cancels non-closing direction orders to ensure risk control.
- Automatically closes position if loss exceeds limit.
- Real-time output of order status, position changes, and P&L.

### 3. Hedging Strategy (bot.ts)

- Trades simultaneously on bitget and asterdex, hedging via price difference.
- Automatically buys and sells on bitget and asterdex based on price difference.

## Usage

1. Configure API keys and other parameters.
2. Choose the appropriate strategy script (trend.ts or maker.ts) to start the bot.
3. Observe log output to confirm connection and strategy operation.
4. To customize strategies, modify the logic in the corresponding ts file.
5. Run test scripts to ensure functionality.

## Notes

- Keep your API keys safe to avoid leaks.
- The bot involves real funds; please verify strategy safety in a test environment first.
- Refer to official API documentation to ensure correct API usage.
- It is recommended to run on a cloud server or a local stable network environment.

## CopyRight

Made by [RitMEX](https://ritmex.one) with love.
