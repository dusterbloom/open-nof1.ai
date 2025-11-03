"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type TradeOperation = "Buy" | "Sell" | "Hold";
type TradeSymbol = "BTC" | "ETH" | "BNB" | "SOL" | "DOGE";

interface Trade {
  id: string;
  symbol: TradeSymbol;
  operation: TradeOperation;
  amount: number | null;
  pricing: number | null;
  leverage: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  positionId: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  chat?: {
    reasoning: string;
    chat: string;
  };
}

interface TradeDetailModalProps {
  trade: Trade | null;
  allTrades?: Trade[]; // Optional: needed for PnL calculation on closed positions
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeDetailModal({
  trade,
  allTrades,
  open,
  onOpenChange,
}: TradeDetailModalProps) {
  if (!trade) return null;

  // Calculate PnL for closed positions
  let linkedTrade: Trade | undefined;
  let pnl: number | null = null;
  let pnlPercentage: number | null = null;

  if (trade.positionId && allTrades) {
    if (trade.operation === "Sell") {
      // Find the Buy trade
      linkedTrade = allTrades.find(
        (t) => t.positionId === trade.positionId && t.operation === "Buy"
      );
      if (linkedTrade && linkedTrade.pricing && trade.pricing && linkedTrade.amount && linkedTrade.leverage) {
        const positionValue = linkedTrade.amount * linkedTrade.leverage;
        const priceDiff = trade.pricing - linkedTrade.pricing;
        pnl = (priceDiff / linkedTrade.pricing) * positionValue;
        pnlPercentage = (priceDiff / linkedTrade.pricing) * 100 * linkedTrade.leverage;
      }
    } else if (trade.operation === "Buy") {
      // Find the Sell trade
      linkedTrade = allTrades.find(
        (t) => t.positionId === trade.positionId && t.operation === "Sell"
      );
      if (linkedTrade && linkedTrade.pricing && trade.pricing && trade.amount && trade.leverage) {
        const positionValue = trade.amount * trade.leverage;
        const priceDiff = linkedTrade.pricing - trade.pricing;
        pnl = (priceDiff / trade.pricing) * positionValue;
        pnlPercentage = (priceDiff / trade.pricing) * 100 * trade.leverage;
      }
    }
  }

  const operationColor =
    trade.operation === "Buy"
      ? "bg-green-500/10 text-green-500 border-green-500/20"
      : trade.operation === "Sell"
      ? "bg-red-500/10 text-red-500 border-red-500/20"
      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Trade Details</span>
            <Badge className={operationColor}>{trade.operation}</Badge>
            <Badge variant="outline">
              {trade.symbol} {trade.leverage}x
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {new Date(trade.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Trade Parameters */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Trade Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Symbol</p>
                  <p className="text-sm font-mono font-bold">{trade.symbol}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Operation</p>
                  <p className="text-sm font-mono font-bold">{trade.operation}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-sm font-mono font-bold">
                    {trade.amount ? `${trade.amount} ${trade.symbol}` : "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Entry Price</p>
                  <p className="text-sm font-mono font-bold">
                    {trade.pricing ? `$${trade.pricing.toLocaleString()}` : "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Leverage</p>
                  <p className="text-sm font-mono font-bold">
                    {trade.leverage ? `${trade.leverage}x` : "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Position ID</p>
                  <p className="text-sm font-mono text-xs">
                    {trade.positionId ? trade.positionId.slice(0, 12) + "..." : "N/A"}
                  </p>
                </div>
                {trade.stopLoss && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                    <p className="text-sm font-mono font-bold text-red-500">
                      ${trade.stopLoss.toLocaleString()}
                    </p>
                  </div>
                )}
                {trade.takeProfit && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Take Profit</p>
                    <p className="text-sm font-mono font-bold text-green-500">
                      ${trade.takeProfit.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="pt-2">
                <div className="flex items-center gap-2">
                  <Badge variant={trade.success ? "default" : "destructive"}>
                    {trade.success ? "Success" : "Failed"}
                  </Badge>
                  {trade.errorMessage && (
                    <span className="text-xs text-red-500">{trade.errorMessage}</span>
                  )}
                </div>
              </div>
            </div>

            {/* PnL Section for Closed Positions */}
            {pnl !== null && (
              <div className="space-y-3 p-4 rounded-lg border-2 bg-muted/30" style={{
                borderColor: pnl >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                backgroundColor: pnl >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'
              }}>
                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{
                  color: pnl >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                }}>
                  Position Closed - Profit & Loss
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Entry Price</p>
                    <p className="text-sm font-mono font-bold">
                      {trade.operation === "Sell" && linkedTrade?.pricing
                        ? `$${linkedTrade.pricing.toLocaleString()}`
                        : trade.operation === "Buy" && trade.pricing
                        ? `$${trade.pricing.toLocaleString()}`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Exit Price</p>
                    <p className="text-sm font-mono font-bold">
                      {trade.operation === "Sell" && trade.pricing
                        ? `$${trade.pricing.toLocaleString()}`
                        : trade.operation === "Buy" && linkedTrade?.pricing
                        ? `$${linkedTrade.pricing.toLocaleString()}`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Realized PnL</p>
                    <p className={`text-lg font-mono font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">ROI (with {trade.leverage || linkedTrade?.leverage}x leverage)</p>
                    <p className={`text-lg font-mono font-bold ${pnlPercentage && pnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pnlPercentage && pnlPercentage >= 0 ? '+' : ''}{pnlPercentage?.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {trade.chat?.reasoning && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  AI Reasoning
                </h3>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {trade.chat.reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* Full AI Chat */}
            {trade.chat?.chat && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Complete AI Analysis
                </h3>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <ScrollArea className="max-h-[300px]">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono">
                      {trade.chat.chat}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Metadata
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Trade ID</p>
                  <p className="text-xs font-mono">{trade.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created At</p>
                  <p className="text-xs font-mono">
                    {new Date(trade.createdAt).toISOString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Updated At</p>
                  <p className="text-xs font-mono">
                    {new Date(trade.updatedAt).toISOString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
