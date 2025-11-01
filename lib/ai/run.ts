import { generateObject } from "ai";
import { generateUserPrompt, tradingPrompt } from "./prompt";
import { getCurrentMarketState } from "../trading/current-market-state";
import { z } from "zod";
import { deepseek } from "./model";
import { getAccountInformationAndPerformance } from "../trading/account-information-and-performance";
import { prisma } from "../prisma";
import { operation, Symbol } from "@prisma/client";
import { buy } from "../trading/buy";
import { sell } from "../trading/sell";

// Map of supported trading symbols
const SUPPORTED_SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "DOGE/USDT"] as const;
const SYMBOL_TO_ENUM: Record<string, Symbol> = {
  "BTC/USDT": Symbol.BTC,
  "ETH/USDT": Symbol.ETH,
  "SOL/USDT": Symbol.SOL,
  "BNB/USDT": Symbol.BNB,
  "DOGE/USDT": Symbol.DOGE,
};

/**
 * you can interval trading using cron job
 */
export async function run(initialCapital: number) {
  // Fetch market data for all supported cryptocurrencies
  const marketStates = await Promise.all(
    SUPPORTED_SYMBOLS.map(async (symbol) => ({
      symbol,
      data: await getCurrentMarketState(symbol),
    }))
  );

  const accountInformationAndPerformance =
    await getAccountInformationAndPerformance(initialCapital);
  // Count previous Chat entries to provide an invocation counter in the prompt
  const invocationCount = await prisma.chat.count();

  // Get the start time from the first trade or first chat entry
  const firstTrade = await prisma.trading.findFirst({
    orderBy: { createdAt: "asc" },
  });
  const startTime = firstTrade?.createdAt || new Date();

  const userPrompt = generateUserPrompt({
    currentMarketState: marketStates[0].data, // Keep for backward compatibility
    marketStates, // New: all market states
    accountInformationAndPerformance,
    startTime,
    invocationCount,
  });

  const { object, reasoning } = await generateObject({
    model: deepseek,
    system: tradingPrompt,
    prompt: userPrompt,
    output: "object",
    schemaName: "TradingDecision",
    schemaDescription: "A structured trading decision with operation type, analysis, and optional buy/sell parameters",
    schema: z.object({
      operation: z.nativeEnum(operation),
      symbol: z
        .enum(["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "DOGE/USDT"])
        .describe("The cryptocurrency symbol to trade. Choose based on market analysis and opportunities."),
      buy: z
        .object({
          pricing: z.number().describe("The pricing of you want to buy in."),
          amount: z.number(),
          leverage: z.number().min(1).max(20),
        })
        .optional()
        .describe("If operation is buy, generate object"),
      sell: z
        .object({
          percentage: z
            .number()
            .min(0)
            .max(100)
            .describe("Percentage of position to sell"),
        })
        .optional()
        .describe("If operation is sell, generate object"),
      adjustProfit: z
        .object({
          stopLoss: z
            .number()
            .nullable()
            .optional()
            .describe("The stop loss of you want to set."),
          takeProfit: z
            .number()
            .nullable()
            .optional()
            .describe("The take profit of you want to set."),
        })
        .optional()
        .describe(
          "If operation is hold and you want to adjust the profit, generate object"
        ),
      chat: z
        .string()
        .describe(
          "The reason why you do this operation, and tell me your anlyaise, for example: Currently holding all my positions in ETH, SOL, XRP, BTC, DOGE, and BNB as none of my invalidation conditions have been triggered, though XRP and BNB are showing slight unrealized losses. My overall account is up 10.51% with $4927.64 in cash, so I'll continue to monitor my existing trades."
        ),
    }),
  });

  if (object.operation === operation.Buy && object.buy) {
    // Execute buy order
    const buyResult = await buy({
      symbol: object.symbol,
      size: object.buy.amount,
      leverage: object.buy.leverage,
      price: object.buy.pricing,
    });

    // Save to database
    await prisma.chat.create({
      data: {
        reasoning: reasoning || "<no reasoning>",
        chat: object.chat || "<no chat>",
        userPrompt,
        tradings: {
          createMany: {
            data: {
              symbol: SYMBOL_TO_ENUM[object.symbol],
              operation: object.operation,
              pricing: buyResult.success ? buyResult.price : object.buy.pricing,
              amount: object.buy.amount,
              leverage: object.buy.leverage,
            },
          },
        },
      },
    });

    if (!buyResult.success) {
      console.error(`[TRADING] Buy order failed: ${buyResult.error}`);
    } else {
      console.log(`[TRADING] Buy order executed successfully at ${buyResult.price}`);
    }
  }

  if (object.operation === operation.Sell && object.sell) {
    // Execute sell order
    const sellResult = await sell({
      symbol: object.symbol,
      percentage: object.sell.percentage,
    });

    // Save to database
    await prisma.chat.create({
      data: {
        reasoning: reasoning || "<no reasoning>",
        chat: object.chat || "<no chat>",
        userPrompt,
        tradings: {
          createMany: {
            data: {
              symbol: SYMBOL_TO_ENUM[object.symbol],
              operation: object.operation,
              pricing: sellResult.success ? sellResult.price : undefined,
            },
          },
        },
      },
    });

    if (!sellResult.success) {
      console.error(`[TRADING] Sell order failed: ${sellResult.error}`);
    } else {
      console.log(
        `[TRADING] Sell order executed successfully at ${sellResult.price}, PnL: ${sellResult.pnl?.toFixed(2)} USDT`
      );
    }
  }

  if (object.operation === operation.Hold) {
    const shouldAdjustProfit =
      object.adjustProfit?.stopLoss && object.adjustProfit?.takeProfit;
    await prisma.chat.create({
      data: {
        reasoning: reasoning || "<no reasoning>",
        chat: object.chat || "<no chat>",
        userPrompt,
        tradings: {
          createMany: {
            data: {
              symbol: SYMBOL_TO_ENUM[object.symbol],
              operation: object.operation,
              stopLoss: shouldAdjustProfit
                ? object.adjustProfit?.stopLoss
                : undefined,
              takeProfit: shouldAdjustProfit
                ? object.adjustProfit?.takeProfit
                : undefined,
            },
          },
        },
      },
    });
  }
}
