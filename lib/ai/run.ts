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
import { validateBuyOrder, validateSellOrder, validateStopLossTakeProfit } from "../trading/validator";
import { setStopLossTakeProfit } from "../trading/set-stop-loss-take-profit";
import { randomUUID } from "crypto";
import { isDryRunMode, dryRunWallet } from "../trading/dry-run-wallet";
import { restoreDryRunWallet } from "../trading/restore-dry-run-wallet";
import { collectMetrics } from "../metrics/collect-metrics";

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
  // In dry-run mode, ALWAYS restore wallet state from database to ensure consistency
  // This guarantees accurate state even after container restarts or server crashes
  if (isDryRunMode()) {
    console.log("[RUN] Dry-run mode: Restoring wallet state from database...");
    const beforeState = {
      balance: dryRunWallet.getBalance(),
      pnl: dryRunWallet.getTotalPnL(),
      positions: dryRunWallet.getPositions().length,
    };

    await restoreDryRunWallet();

    const afterState = {
      balance: dryRunWallet.getBalance(),
      pnl: dryRunWallet.getTotalPnL(),
      positions: dryRunWallet.getPositions().length,
    };

    console.log(`[RUN] Restoration complete: ${beforeState.balance} → ${afterState.balance} USDT, P&L: ${afterState.pnl.toFixed(2)} USDT`);
  }

  // Fetch market data for all supported cryptocurrencies
  // CRITICAL: forceFresh=true ensures trading decisions use real-time prices, not cached data
  const marketStates = await Promise.all(
    SUPPORTED_SYMBOLS.map(async (symbol) => ({
      symbol,
      data: await getCurrentMarketState(symbol, true), // forceFresh=true for trading
    }))
  );

  const accountInformationAndPerformance =
    await getAccountInformationAndPerformance(initialCapital);

  // ========================================
  // CRITICAL: LIQUIDATION PROTECTION
  // ========================================
  // Check all positions for liquidation risk BEFORE AI decision
  // If any position is within 10% of liquidation, force-close it immediately
  const LIQUIDATION_SAFETY_THRESHOLD = 10; // Close if within 10% of liquidation

  for (const position of accountInformationAndPerformance.positions) {
    const liquidationDistance = position.info?.liquidationDistance as number || 100;

    if (liquidationDistance <= LIQUIDATION_SAFETY_THRESHOLD && liquidationDistance > 0) {
      console.warn(`
⚠️  LIQUIDATION PROTECTION TRIGGERED ⚠️
Symbol: ${position.symbol}
Current Price: ${position.markPrice} USDT
Liquidation Price: ${position.liquidationPrice} USDT
Distance to Liquidation: ${liquidationDistance.toFixed(2)}%
Action: EMERGENCY FORCE-CLOSE
      `);

      // Force-close the position immediately (100% sell)
      try {
        const sellResult = await sell({
          symbol: position.symbol as string,
          percentage: 100, // Close entire position
        });

        if (sellResult.success) {
          // Record the emergency liquidation protection action
          await prisma.chat.create({
            data: {
              reasoning: `EMERGENCY LIQUIDATION PROTECTION: Position ${position.symbol} was ${liquidationDistance.toFixed(2)}% from liquidation. Auto-closed to prevent total loss.`,
              chat: `🚨 LIQUIDATION PROTECTION: Force-closed ${position.symbol} position at ${sellResult.price} USDT (was ${liquidationDistance.toFixed(2)}% from liquidation at ${position.liquidationPrice} USDT). PnL: ${sellResult.pnl?.toFixed(2)} USDT`,
              userPrompt: "EMERGENCY_LIQUIDATION_PROTECTION",
              tradings: {
                create: {
                  symbol: SYMBOL_TO_ENUM[position.symbol as string],
                  operation: operation.Sell,
                  pricing: sellResult.price,
                  amount: position.contracts,
                  leverage: position.leverage,
                  positionId: null,
                  success: true,
                  errorMessage: null,
                },
              },
            },
          });

          console.log(`✅ Position closed successfully. PnL: ${sellResult.pnl?.toFixed(2)} USDT`);

          // Collect metrics after emergency close
          await collectMetrics({
            initialCapital,
            reason: "LIQUIDATION_PROTECTION",
          });
        } else {
          console.error(`❌ Failed to close position: ${sellResult.error}`);
        }
      } catch (error) {
        console.error(`❌ Emergency close failed for ${position.symbol}:`, error);
      }
    }
  }

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
        .optional()
        .describe("The cryptocurrency symbol to trade (required for Buy/Sell operations, optional for Hold when no positions exist)."),
      buy: z
        .object({
          pricing: z.number().describe("The pricing of you want to buy in."),
          amount: z.number(),
          leverage: z.number().min(1).max(20),
          stopLoss: z.number().optional().describe("Optional stop loss price to protect the position"),
          takeProfit: z.number().optional().describe("Optional take profit price to secure gains"),
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
            .optional()
            .describe("The stop loss of you want to set."),
          takeProfit: z
            .number()
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
    // Ensure symbol is present for Buy operations
    if (!object.symbol) {
      console.error("[TRADING] Buy operation requires a symbol");
      return;
    }

    // Validate buy order BEFORE execution
    const validation = validateBuyOrder({
      symbol: object.symbol,
      amount: object.buy.amount,
      leverage: object.buy.leverage,
      price: object.buy.pricing,
      availableBalance: accountInformationAndPerformance.availableCash,
      currentPositions: accountInformationAndPerformance.positions,
    });

    // Log validation warnings
    if (validation.warnings.length > 0) {
      console.warn(`[TRADING] Validation warnings: ${validation.warnings.join(", ")}`);
    }

    // If validation failed, reject the trade and save audit trail
    if (!validation.valid) {
      console.error(`[TRADING] Buy validation failed: ${validation.errors.join(", ")}`);

      await prisma.chat.create({
        data: {
          reasoning: reasoning || "<no reasoning>",
          chat: `REJECTED: ${validation.errors.join(", ")}`,
          userPrompt,
          tradings: {
            createMany: {
              data: {
                symbol: SYMBOL_TO_ENUM[object.symbol],
                operation: object.operation,
                pricing: object.buy.pricing,
                amount: object.buy.amount,
                leverage: object.buy.leverage,
                success: false,
                errorMessage: validation.errors.join("; "),
              },
            },
          },
        },
      });
      return; // Exit without executing the trade
    }

    // Execute buy order
    const buyResult = await buy({
      symbol: object.symbol,
      size: object.buy.amount,
      leverage: object.buy.leverage,
      price: object.buy.pricing,
    });

    // Save to database ONLY after checking execution result
    if (buyResult.success) {
      // Generate unique position ID for tracking this position
      const positionId = randomUUID();

      // Set stop loss and take profit if provided by AI
      if (object.buy.stopLoss || object.buy.takeProfit) {
        if (!buyResult.price) {
          console.error("[TRADING] Cannot set SL/TP: Buy result has no price");
        } else {
          // Validate SL/TP levels before setting
          const slTpValidation = validateStopLossTakeProfit({
            stopLoss: object.buy.stopLoss,
            takeProfit: object.buy.takeProfit,
            entryPrice: buyResult.price,
            side: "long", // BUY orders are always long positions
          });

          if (slTpValidation.valid) {
            const slTpResult = await setStopLossTakeProfit({
              symbol: object.symbol,
              stopLoss: object.buy.stopLoss,
              takeProfit: object.buy.takeProfit,
              positionSize: object.buy.amount / object.buy.leverage, // Contract size
              side: "long",
            });

            if (!slTpResult.success) {
              console.error(`[TRADING] Failed to set SL/TP: ${slTpResult.error}`);
            } else {
              console.log(`[TRADING] Stop loss/take profit set successfully`);
            }
          } else {
            console.warn(`[TRADING] Invalid SL/TP levels: ${slTpValidation.errors.join(", ")}`);
          }
        }
      }

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
                pricing: buyResult.price,
                amount: object.buy.amount,
                leverage: object.buy.leverage,
                stopLoss: object.buy.stopLoss,
                takeProfit: object.buy.takeProfit,
                positionId: positionId, // Link this trade to the position
                success: true,
                errorMessage: null,
              },
            },
          },
        },
      });
      console.log(`[TRADING] Buy order executed successfully at ${buyResult.price}, Position ID: ${positionId}`);

      // Collect metrics snapshot immediately after successful trade
      await collectMetrics({
        initialCapital: initialCapital,
        reason: "trade",
        tradeId: positionId,
      });
    } else {
      // Trade execution failed - save with error details
      console.error(`[TRADING] Buy order failed: ${buyResult.error}`);

      await prisma.chat.create({
        data: {
          reasoning: reasoning || "<no reasoning>",
          chat: `FAILED: ${buyResult.error}`,
          userPrompt,
          tradings: {
            createMany: {
              data: {
                symbol: SYMBOL_TO_ENUM[object.symbol],
                operation: object.operation,
                pricing: object.buy.pricing,
                amount: object.buy.amount,
                leverage: object.buy.leverage,
                success: false,
                errorMessage: buyResult.error,
              },
            },
          },
        },
      });
    }
  }

  if (object.operation === operation.Sell && object.sell) {
    // Ensure symbol is present for Sell operations
    if (!object.symbol) {
      console.error("[TRADING] Sell operation requires a symbol");
      return;
    }

    // Validate sell order BEFORE execution
    const validation = validateSellOrder({
      symbol: object.symbol,
      percentage: object.sell.percentage,
      currentPositions: accountInformationAndPerformance.positions,
    });

    // Log validation warnings
    if (validation.warnings.length > 0) {
      console.warn(`[TRADING] Validation warnings: ${validation.warnings.join(", ")}`);
    }

    // If validation failed, reject the trade and save audit trail
    if (!validation.valid) {
      console.error(`[TRADING] Sell validation failed: ${validation.errors.join(", ")}`);

      await prisma.chat.create({
        data: {
          reasoning: reasoning || "<no reasoning>",
          chat: `REJECTED: ${validation.errors.join(", ")}`,
          userPrompt,
          tradings: {
            createMany: {
              data: {
                symbol: SYMBOL_TO_ENUM[object.symbol],
                operation: object.operation,
                success: false,
                errorMessage: validation.errors.join("; "),
              },
            },
          },
        },
      });
      return; // Exit without executing the trade
    }

    // Find the open position's positionId for linking and get original trade data
    const openPosition = await prisma.trading.findFirst({
      where: {
        symbol: SYMBOL_TO_ENUM[object.symbol],
        operation: "Buy",
        success: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        positionId: true,
        amount: true,
        leverage: true,
      },
    });

    // Execute sell order
    const sellResult = await sell({
      symbol: object.symbol,
      percentage: object.sell.percentage,
    });

    // Save to database ONLY after checking execution result
    if (sellResult.success) {
      // Calculate actual amount sold based on percentage and original position
      const amountSold = openPosition?.amount
        ? (openPosition.amount * object.sell.percentage) / 100
        : null;

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
                pricing: sellResult.price,
                amount: amountSold, // Store calculated amount sold
                leverage: openPosition?.leverage || null, // Inherit leverage from Buy trade
                positionId: openPosition?.positionId || null, // Link to the position
                success: true,
                errorMessage: null,
              },
            },
          },
        },
      });
      console.log(
        `[TRADING] Sell order executed successfully at ${sellResult.price}, Amount: ${amountSold?.toFixed(4)} (${object.sell.percentage}% of position), Leverage: ${openPosition?.leverage}x, PnL: ${sellResult.pnl?.toFixed(2)} USDT`
      );

      // Collect metrics snapshot immediately after successful trade
      await collectMetrics({
        initialCapital: initialCapital,
        reason: "trade",
        tradeId: openPosition?.positionId || undefined,
      });
    } else {
      // Trade execution failed - save with error details
      console.error(`[TRADING] Sell order failed: ${sellResult.error}`);

      // Calculate intended amount to sell for the failed record
      const amountSold = openPosition?.amount
        ? (openPosition.amount * object.sell.percentage) / 100
        : null;

      await prisma.chat.create({
        data: {
          reasoning: reasoning || "<no reasoning>",
          chat: `FAILED: ${sellResult.error}`,
          userPrompt,
          tradings: {
            createMany: {
              data: {
                symbol: SYMBOL_TO_ENUM[object.symbol],
                operation: object.operation,
                amount: amountSold, // Store calculated amount even for failed trades
                leverage: openPosition?.leverage || null, // Inherit leverage from Buy trade
                success: false,
                errorMessage: sellResult.error,
              },
            },
          },
        },
      });
    }
  }

  if (object.operation === operation.Hold) {
    const shouldAdjustProfit =
      object.adjustProfit?.stopLoss || object.adjustProfit?.takeProfit;

    if (shouldAdjustProfit) {
      // Ensure symbol is present for SL/TP adjustment
      if (!object.symbol) {
        console.error("[TRADING] Hold with SL/TP adjustment requires a symbol");
        return;
      }

      // Find the position for the symbol
      const position = accountInformationAndPerformance.positions.find(
        (p) => p.symbol === object.symbol && p.contracts !== 0
      );

      if (!position) {
        console.error(`[TRADING] Cannot set SL/TP: No open position found for ${object.symbol}`);

        await prisma.chat.create({
          data: {
            reasoning: reasoning || "<no reasoning>",
            chat: `REJECTED: Cannot set stop loss/take profit without open position for ${object.symbol}`,
            userPrompt,
            tradings: {
              createMany: {
                data: {
                  symbol: SYMBOL_TO_ENUM[object.symbol],
                  operation: object.operation,
                  stopLoss: object.adjustProfit?.stopLoss,
                  takeProfit: object.adjustProfit?.takeProfit,
                  success: false,
                  errorMessage: `No open position for ${object.symbol}`,
                },
              },
            },
          },
        });
        return; // Exit without setting SL/TP
      }

      // Validate SL/TP levels
      const slTpValidation = validateStopLossTakeProfit({
        stopLoss: object.adjustProfit?.stopLoss ?? undefined,
        takeProfit: object.adjustProfit?.takeProfit ?? undefined,
        entryPrice: position.entryPrice || position.markPrice || 0,
        side: position.side === "long" ? "long" : "short",
      });

      if (!slTpValidation.valid) {
        console.error(`[TRADING] Invalid SL/TP levels: ${slTpValidation.errors.join(", ")}`);

        await prisma.chat.create({
          data: {
            reasoning: reasoning || "<no reasoning>",
            chat: `REJECTED: ${slTpValidation.errors.join(", ")}`,
            userPrompt,
            tradings: {
              createMany: {
                data: {
                  symbol: SYMBOL_TO_ENUM[object.symbol],
                  operation: object.operation,
                  stopLoss: object.adjustProfit?.stopLoss,
                  takeProfit: object.adjustProfit?.takeProfit,
                  success: false,
                  errorMessage: slTpValidation.errors.join("; "),
                },
              },
            },
          },
        });
        return; // Exit without setting invalid SL/TP
      }

      // Set stop loss and take profit on the exchange
      const slTpResult = await setStopLossTakeProfit({
        symbol: object.symbol,
        stopLoss: object.adjustProfit?.stopLoss ?? undefined,
        takeProfit: object.adjustProfit?.takeProfit ?? undefined,
        positionSize: position.contracts || 0,
        side: position.side === "long" ? "long" : "short",
      });

      if (slTpResult.success) {
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
                  stopLoss: object.adjustProfit?.stopLoss,
                  takeProfit: object.adjustProfit?.takeProfit,
                  success: true,
                  errorMessage: null,
                },
              },
            },
          },
        });
        console.log(`[TRADING] Stop loss/take profit adjusted successfully for ${object.symbol}`);
      } else {
        console.error(`[TRADING] Failed to set SL/TP: ${slTpResult.error}`);

        await prisma.chat.create({
          data: {
            reasoning: reasoning || "<no reasoning>",
            chat: `FAILED: ${slTpResult.error}`,
            userPrompt,
            tradings: {
              createMany: {
                data: {
                  symbol: SYMBOL_TO_ENUM[object.symbol],
                  operation: object.operation,
                  stopLoss: object.adjustProfit?.stopLoss,
                  takeProfit: object.adjustProfit?.takeProfit,
                  success: false,
                  errorMessage: slTpResult.error,
                },
              },
            },
          },
        });
      }
    } else {
      // HOLD without SL/TP adjustment - just log the decision
      await prisma.chat.create({
        data: {
          reasoning: reasoning || "<no reasoning>",
          chat: object.chat || "<no chat>",
          userPrompt,
          tradings: {
            createMany: {
              data: {
                symbol: object.symbol ? SYMBOL_TO_ENUM[object.symbol] : null,
                operation: object.operation,
                success: true,
                errorMessage: null,
              },
            },
          },
        },
      });
      console.log(
        object.symbol
          ? `[TRADING] Holding ${object.symbol} position, no action taken`
          : `[TRADING] Hold operation - no positions, waiting for opportunities`
      );
    }
  }
}
