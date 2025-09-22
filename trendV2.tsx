import {
  Aster,
  AsterDepth,
  AsterTicker,
  AsterKline,
  AsterOrder,
  AsterAccountSnapshot,
} from "./exchanges/aster";
import "dotenv/config";
import React, { useEffect, useState } from "react";
import { render, Box, Text } from "ink";
import type { TextProps } from "ink";
import Table from "ink-table";
import { EventEmitter } from "events";
import {
  TRADE_SYMBOL,
  TRADE_AMOUNT,
  LOSS_LIMIT,
  TRAILING_PROFIT,
} from "./config";
import {
  toPrice1Decimal,
  isOperating,
  unlockOperating,
  placeStopLossOrder,
  marketClose,
  calcStopLossPrice,
  calcTrailingActivationPrice,
  placeTrailingStopOrder,
  placeMarketOrder
} from "./utils/order";
import { logTrade, TradeLogItem } from "./utils/log";
import { getPosition, getSMA30 } from "./utils/helper";

const aster = new Aster(
  process.env.ASTER_API_KEY!,
  process.env.ASTER_API_SECRET!
);

// 快照数据
let accountSnapshot: AsterAccountSnapshot | null = null;
let openOrders: AsterOrder[] = [];
let depthSnapshot: AsterDepth | null = null;
let tickerSnapshot: AsterTicker | null = null;
let klineSnapshot: AsterKline[] = [];

// 交易统计
let tradeLog: TradeLogItem[] = [];
let totalProfit = 0;
let totalTrades = 0;
// 多类型订单锁
let orderTypeLocks: { [key: string]: boolean } = {};
let orderTypePendingOrderId: { [key: string]: string | null } = {};
let orderTypeUnlockTimer: { [key: string]: NodeJS.Timeout | null } = {};

const STATUS_EVENT = "update";

interface StatusPayload {
  ticker: AsterTicker;
  ob: AsterDepth;
  sma: number | null;
  trend: string;
  openOrder: { side: "BUY" | "SELL"; price: number; amount: number } | null;
  closeOrder: { side: "BUY" | "SELL"; price: number; amount: number } | null;
  stopOrder: { side: "BUY" | "SELL"; stopPrice: number } | null;
  pos: { positionAmt: number; entryPrice: number; unrealizedProfit: number };
  pnl: number;
  unrealized: number;
  tradeLog: TradeLogItem[];
  totalProfit: number;
  totalTrades: number;
  openOrders: AsterOrder[];
}

const statusEmitter = new EventEmitter();

const TrendApp = () => {
  const [status, setStatus] = useState<StatusPayload | null>(null);

  useEffect(() => {
    const handler = (payload: StatusPayload) => setStatus(payload);
    statusEmitter.on(STATUS_EVENT, handler as (...args: any[]) => void);
    return () => {
      statusEmitter.off(STATUS_EVENT, handler as (...args: any[]) => void);
    };
  }, []);

  if (!status) {
    return (
      <Box flexDirection="column">
        <Text color="cyanBright">趋势策略机器人</Text>
        <Text color="gray">正在加载行情与账户数据...</Text>
        <Text color="gray">按 Ctrl+C 退出</Text>
      </Box>
    );
  }

  const hasPosition = Math.abs(status.pos.positionAmt) > 0.00001;
  const direction = status.pos.positionAmt > 0 ? "多" : "空";
  const openOrdersRows = status.openOrders.map((order) => ({
    id: order.orderId,
    side: order.side,
    type: order.type,
    price: order.price,
    qty: order.origQty,
    filled: order.executedQty,
    status: order.status
  }));
  const recentLogs = status.tradeLog.slice(-10);
  const logColors: Record<string, TextProps["color"]> = {
    open: "green",
    close: "blue",
    stop: "red",
    order: "yellow",
    error: "redBright"
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color="cyanBright" bold>
          趋势策略机器人
        </Text>
        <Text color="yellow">
          最新价格: {status.ticker?.lastPrice ?? "-"} | SMA30: {status.sma !== null ? status.sma.toFixed(2) : "-"}
        </Text>
        <Text color="green">
          盘口 买一: {status.ob?.bids?.[0]?.[0] ?? "-"} 卖一: {status.ob?.asks?.[0]?.[0] ?? "-"}
        </Text>
        <Text color="magenta">当前趋势: {status.trend}</Text>
      </Box>

      {status.openOrder && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="blue">当前开仓挂单: {status.openOrder.side} @ {status.openOrder.price} 数量: {status.openOrder.amount}</Text>
        </Box>
      )}
      {status.closeOrder && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="blueBright">当前平仓挂单: {status.closeOrder.side} @ {status.closeOrder.price} 数量: {status.closeOrder.amount}</Text>
        </Box>
      )}
      {status.stopOrder && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="red">止损单: {status.stopOrder.side} STOP_MARKET @ {status.stopOrder.stopPrice}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {hasPosition ? (
          <Text bold>
            持仓: {direction} 开仓价: {status.pos.entryPrice} 当前浮盈亏: {status.pnl.toFixed(4)} USDT 账户浮盈亏: {status.unrealized.toFixed(4)}
          </Text>
        ) : (
          <Text color="gray">当前无持仓</Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>累计交易次数: {status.totalTrades} 累计收益: {status.totalProfit.toFixed(4)} USDT</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>最近交易/挂单记录：</Text>
        {recentLogs.length > 0 ? (
          recentLogs.map((log, index) => {
            const color = logColors[log.type] ?? "white";
            return (
              <Text color={color}>
                [{log.time}] [{log.type}] {log.detail}
              </Text>
            );
          })
        ) : (
          <Text color="gray">暂无记录</Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>当前挂单：</Text>
        {openOrdersRows.length > 0 ? (
          <Table data={openOrdersRows} />
        ) : (
          <Text color="gray">无挂单</Text>
        )}
      </Box>

      <Text color="gray">按 Ctrl+C 退出</Text>
    </Box>
  );
};

function updateStatus(payload: StatusPayload) {
  statusEmitter.emit(STATUS_EVENT, payload);
}

render(<TrendApp />);

// 订阅所有推送
aster.watchAccount((data) => {
  accountSnapshot = data;
  // 账户更新不再直接解锁
});
aster.watchOrder((orders: AsterOrder[]) => {
  // 针对每种类型分别判断pendingOrderId是否需要解锁
  Object.keys(orderTypePendingOrderId).forEach(type => {
    const pendingOrderId = orderTypePendingOrderId[type];
    if (pendingOrderId) {
      const pendingOrder = orders.find(o => String(o.orderId) === String(pendingOrderId));
      if (pendingOrder) {
        if (pendingOrder.status && pendingOrder.status !== "NEW") {
          unlockOperating(orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, type);
        }
      } else {
        // orders 里没有 pendingOrderId 对应的订单，说明已成交或撤销
        unlockOperating(orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, type);
      }
    }
  });
  // 过滤掉 market 类型订单再赋值给 openOrders
  openOrders = Array.isArray(orders) ? orders.filter(o => o.type !== 'MARKET') : [];
});
aster.watchDepth(TRADE_SYMBOL, (depth: AsterDepth) => {
  depthSnapshot = depth;
});
aster.watchTicker(TRADE_SYMBOL, (ticker: AsterTicker) => {
  tickerSnapshot = ticker;
});
aster.watchKline(TRADE_SYMBOL, "1m", (klines: AsterKline[]) => {
  klineSnapshot = klines;
});

// 新增：工具函数
function isReady() {
  return accountSnapshot && tickerSnapshot && depthSnapshot && klineSnapshot.length;
}

function isNoPosition(pos: any) {
  return Math.abs(pos.positionAmt) < 0.00001;
}

async function handleOpenPosition(lastPrice: number | null, lastSMA30: number, price: number, openOrders: AsterOrder[], orderTypeLocks: any, aster: Aster, TRADE_SYMBOL: string, TRADE_AMOUNT: number, tradeLog: TradeLogItem[], logTrade: any, lastOpenOrder: any) {
  // 撤销所有普通挂单和止损单
  if (openOrders.length > 0) {
    isOperating(orderTypeLocks, "MARKET");
    await aster.cancelAllOrders({ symbol: TRADE_SYMBOL });
  }
  // 仅在价格穿越SMA30时下市价单
  if (lastPrice !== null) {
    if (lastPrice > lastSMA30 && price < lastSMA30) {
      isOperating(orderTypeLocks, "MARKET");
      await placeMarketOrder(
        aster,
        openOrders,
        orderTypeLocks,
        orderTypeUnlockTimer,
        orderTypePendingOrderId,
        "SELL",
        TRADE_AMOUNT,
        (type: any, detail: any) => logTrade(tradeLog, type, detail)
      );
      logTrade(tradeLog, "open", `下穿SMA30，市价开空: SELL @ ${price}`);
      lastOpenOrder.side = "SELL";
      lastOpenOrder.price = price;
    } else if (lastPrice < lastSMA30 && price > lastSMA30) {
      isOperating(orderTypeLocks, "MARKET");
      await placeMarketOrder(
        aster,
        openOrders,
        orderTypeLocks,
        orderTypeUnlockTimer,
        orderTypePendingOrderId,
        "BUY",
        TRADE_AMOUNT,
        (type: any, detail: any) => logTrade(tradeLog, type, detail)
      );
      logTrade(tradeLog, "open", `上穿SMA30，市价开多: BUY @ ${price}`);
      lastOpenOrder.side = "BUY";
      lastOpenOrder.price = price;
    }
  }
}

async function handlePositionManagement(pos: any, price: number, lastSMA30: number, openOrders: AsterOrder[], orderTypeLocks: any, orderTypeUnlockTimer: any, orderTypePendingOrderId: any, tickerSnapshot: any, aster: Aster, TRADE_SYMBOL: string, LOSS_LIMIT: number, TRAILING_PROFIT: number, tradeLog: TradeLogItem[], logTrade: any, lastCloseOrder: any, lastStopOrder: any, marketClose: any, placeStopLossOrder: any, placeTrailingStopOrder: any, toPrice1Decimal: any) {
  let direction = pos.positionAmt > 0 ? "long" : "short";
  let pnl = (direction === "long" ? price - pos.entryPrice : pos.entryPrice - price) * Math.abs(pos.positionAmt);
  let stopSide: "SELL" | "BUY" = direction === "long" ? "SELL" : "BUY";
  let stopPrice = calcStopLossPrice(pos.entryPrice, Math.abs(pos.positionAmt), direction as "long" | "short", LOSS_LIMIT);
  let activationPrice = calcTrailingActivationPrice(pos.entryPrice, Math.abs(pos.positionAmt), direction as "long" | "short", TRAILING_PROFIT);
  let hasStop = openOrders.some((o: AsterOrder) => o.type === "STOP_MARKET" && o.side === stopSide);
  let hasTrailing = openOrders.some((o: AsterOrder) => o.type === "TRAILING_STOP_MARKET" && o.side === stopSide);
  let profitMove = 0.05;
  let profitMoveStopPrice = direction === "long" ? toPrice1Decimal(pos.entryPrice + profitMove / Math.abs(pos.positionAmt)) : toPrice1Decimal(pos.entryPrice - profitMove / Math.abs(pos.positionAmt));
  let currentStopOrder = openOrders.find((o: AsterOrder) => o.type === "STOP_MARKET" && o.side === stopSide);
  if (pnl > 0.1 || pos.unrealizedProfit > 0.1) {
    if (!currentStopOrder) {
      isOperating(orderTypeLocks, "MARKET");
      await placeStopLossOrder(aster, openOrders, orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, tickerSnapshot, stopSide, profitMoveStopPrice, (type: any, detail: any) => logTrade(tradeLog, type, detail));
      hasStop = true;
      logTrade(tradeLog, "stop", `盈利大于0.1u，挂盈利0.05u止损单: ${stopSide} @ ${profitMoveStopPrice}`);
    } else {
      let curStopPrice = parseFloat(currentStopOrder.stopPrice);
      if (Math.abs(curStopPrice - profitMoveStopPrice) > 0.01) {
        isOperating(orderTypeLocks, "MARKET");
        await aster.cancelOrder({ symbol: TRADE_SYMBOL, orderId: currentStopOrder.orderId });
        isOperating(orderTypeLocks, "MARKET");
        await placeStopLossOrder(aster, openOrders, orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, tickerSnapshot, stopSide, profitMoveStopPrice, (type: any, detail: any) => logTrade(tradeLog, type, detail));
        logTrade(tradeLog, "stop", `盈利大于0.1u，移动止损单到盈利0.05u: ${stopSide} @ ${profitMoveStopPrice}`);
        hasStop = true;
      }
    }
  }
  if (!hasStop) {
    isOperating(orderTypeLocks, "MARKET");
    await placeStopLossOrder(aster, openOrders, orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, tickerSnapshot, stopSide, toPrice1Decimal(stopPrice), (type: any, detail: any) => logTrade(tradeLog, type, detail));
  }
  if (!hasTrailing) {
    isOperating(orderTypeLocks, "MARKET");
    await placeTrailingStopOrder(aster, openOrders, orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, stopSide, toPrice1Decimal(activationPrice), Math.abs(pos.positionAmt), (type: any, detail: any) => logTrade(tradeLog, type, detail));
  }
  if (pnl < -LOSS_LIMIT || pos.unrealizedProfit < -LOSS_LIMIT) {
    if (openOrders.length > 0) {
      isOperating(orderTypeLocks, "MARKET");
      const orderIdList = openOrders.map(o => o.orderId);
      await aster.cancelOrders({ symbol: TRADE_SYMBOL, orderIdList });
    }
    isOperating(orderTypeLocks, "MARKET");
    await marketClose(aster, openOrders, orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, direction === "long" ? "SELL" : "BUY", (type: any, detail: any) => logTrade(tradeLog, type, detail));
    lastCloseOrder.side = null;
    lastCloseOrder.price = null;
    lastStopOrder.side = null;
    lastStopOrder.price = null;
    logTrade(tradeLog, "close", `止损平仓: ${direction === "long" ? "SELL" : "BUY"}`);
    return { closed: true, pnl };
  }
  // 平仓逻辑略，保留原有
  return { closed: false, pnl };
}

async function trendStrategy() {
  let lastSMA30: number | null = null;
  let lastPrice: number | null = null;
  let lastOpenOrder = { side: null as "BUY" | "SELL" | null, price: null as number | null };
  let lastCloseOrder = { side: null as "BUY" | "SELL" | null, price: null as number | null };
  let lastStopOrder = { side: null as "BUY" | "SELL" | null, price: null as number | null };
  while (true) {
    await new Promise((r) => setTimeout(r, 500));
    if (!isReady()) continue;
    lastSMA30 = getSMA30(klineSnapshot);
    if (lastSMA30 === null) continue;
    const ob = depthSnapshot;
    const ticker = tickerSnapshot;
    const price = parseFloat(ticker!.lastPrice);
    const pos = getPosition(accountSnapshot, TRADE_SYMBOL);
    let trend = "无信号";
    if (price < lastSMA30) trend = "做空";
    if (price > lastSMA30) trend = "做多";
    let pnl = 0;
    if (isNoPosition(pos)) {
      await handleOpenPosition(lastPrice, lastSMA30, price, openOrders, orderTypeLocks, aster, TRADE_SYMBOL, TRADE_AMOUNT, tradeLog, logTrade, lastOpenOrder);
      lastStopOrder.side = null;
      lastStopOrder.price = null;
    } else {
      const result = await handlePositionManagement(pos, price, lastSMA30, openOrders, orderTypeLocks, orderTypeUnlockTimer, orderTypePendingOrderId, ticker!, aster, TRADE_SYMBOL, LOSS_LIMIT, TRAILING_PROFIT, tradeLog, logTrade, lastCloseOrder, lastStopOrder, marketClose, placeStopLossOrder, placeTrailingStopOrder, toPrice1Decimal);
      pnl = result.pnl;
      if (result.closed) {
        totalTrades++;
        totalProfit += pnl;
        continue;
      }
    }
    updateStatus({
      ticker: ticker!,
      ob: ob!,
      sma: lastSMA30,
      trend,
      openOrder: isNoPosition(pos) && lastOpenOrder.side && lastOpenOrder.price ? { side: lastOpenOrder.side, price: lastOpenOrder.price, amount: TRADE_AMOUNT } : null,
      closeOrder: !isNoPosition(pos) && lastCloseOrder.side && lastCloseOrder.price ? { side: lastCloseOrder.side, price: lastCloseOrder.price, amount: Math.abs(pos.positionAmt) } : null,
      stopOrder: !isNoPosition(pos) && lastStopOrder.side && lastStopOrder.price ? { side: lastStopOrder.side, stopPrice: lastStopOrder.price } : null,
      pos,
      pnl,
      unrealized: pos.unrealizedProfit,
      tradeLog,
      totalProfit,
      totalTrades,
      openOrders
    });
    lastPrice = price;
  }
}

trendStrategy();
