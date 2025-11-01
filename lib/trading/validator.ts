import { Position } from "ccxt";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BuyValidationParams {
  symbol: string;
  amount: number;
  leverage: number;
  price: number;
  availableBalance: number;
  currentPositions: Position[];
}

export interface SellValidationParams {
  symbol: string;
  percentage: number;
  currentPositions: Position[];
}

export interface StopLossTakeProfitValidationParams {
  stopLoss?: number;
  takeProfit?: number;
  entryPrice: number;
  side: "long" | "short";
}

/**
 * Validate a BUY order before execution
 */
export function validateBuyOrder(
  params: BuyValidationParams
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { symbol, amount, leverage, price, availableBalance, currentPositions } = params;

  // Check if amount is positive
  if (amount <= 0) {
    errors.push(`Invalid amount: ${amount}. Amount must be greater than 0`);
  }

  // Check minimum position size (Binance minimum is typically 5-10 USDT)
  const MIN_POSITION_SIZE = 5;
  if (amount < MIN_POSITION_SIZE) {
    errors.push(
      `Amount ${amount} USDT is below minimum position size of ${MIN_POSITION_SIZE} USDT`
    );
  }

  // Check leverage limits (Binance perpetuals max is 20x for BTC, varies by symbol)
  const MIN_LEVERAGE = 1;
  const MAX_LEVERAGE = 20;
  if (leverage < MIN_LEVERAGE || leverage > MAX_LEVERAGE) {
    errors.push(
      `Invalid leverage: ${leverage}. Must be between ${MIN_LEVERAGE}x and ${MAX_LEVERAGE}x`
    );
  }

  // Check if price is positive
  if (price <= 0) {
    errors.push(`Invalid price: ${price}. Price must be greater than 0`);
  }

  // Check if sufficient balance (amount / leverage = required margin, with 5% safety buffer)
  const requiredMargin = amount / leverage;
  const safetyBuffer = 1.05; // 5% buffer for fees and price slippage
  const requiredBalance = requiredMargin * safetyBuffer;

  if (availableBalance < requiredBalance) {
    errors.push(
      `Insufficient balance: Need ${requiredBalance.toFixed(2)} USDT (including 5% buffer), but only ${availableBalance.toFixed(2)} USDT available`
    );
  }

  // Warn if using high leverage (>10x)
  if (leverage > 10) {
    warnings.push(
      `High leverage detected: ${leverage}x. This increases liquidation risk.`
    );
  }

  // Check if position already exists for this symbol (current system only supports 1 position per symbol)
  const existingPosition = currentPositions.find((pos) => pos.symbol === symbol && pos.contracts !== 0);
  if (existingPosition) {
    errors.push(
      `Position already exists for ${symbol}. Current system only supports one position per symbol. Close existing position before opening a new one.`
    );
  }

  // Warn if position size is large relative to account (>20% of balance)
  const positionSizePercent = (requiredMargin / availableBalance) * 100;
  if (positionSizePercent > 20) {
    warnings.push(
      `Large position size: ${positionSizePercent.toFixed(1)}% of available balance. Consider reducing size for better risk management.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a SELL order before execution
 */
export function validateSellOrder(
  params: SellValidationParams
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { symbol, percentage, currentPositions } = params;

  // Check if percentage is valid
  if (percentage <= 0 || percentage > 100) {
    errors.push(
      `Invalid percentage: ${percentage}. Must be between 0 and 100 (exclusive of 0, inclusive of 100)`
    );
  }

  // Check if position exists for this symbol
  const existingPosition = currentPositions.find(
    (pos) => pos.symbol === symbol && pos.contracts !== 0
  );

  if (!existingPosition) {
    errors.push(
      `No open position found for ${symbol}. Cannot sell a position that doesn't exist.`
    );
  }

  // Warn if trying to sell only a small portion (<10%)
  if (percentage > 0 && percentage < 10) {
    warnings.push(
      `Selling only ${percentage}% of position. Consider selling a larger portion or holding the position.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate stop loss and take profit levels
 */
export function validateStopLossTakeProfit(
  params: StopLossTakeProfitValidationParams
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { stopLoss, takeProfit, entryPrice, side } = params;

  // At least one of stop loss or take profit must be provided
  if (!stopLoss && !takeProfit) {
    errors.push("Must provide at least one of stopLoss or takeProfit");
    return { valid: false, errors, warnings };
  }

  const MIN_DISTANCE_PERCENT = 0.5; // Minimum 0.5% distance to prevent immediate trigger

  if (side === "long") {
    // For long positions:
    // Stop Loss must be BELOW entry price
    // Take Profit must be ABOVE entry price
    if (stopLoss !== undefined) {
      if (stopLoss >= entryPrice) {
        errors.push(
          `Stop loss ${stopLoss} must be below entry price ${entryPrice} for long positions`
        );
      }

      // Check minimum distance (0.5%)
      const distancePercent = ((entryPrice - stopLoss) / entryPrice) * 100;
      if (distancePercent < MIN_DISTANCE_PERCENT) {
        errors.push(
          `Stop loss too close to entry price (${distancePercent.toFixed(2)}%). Minimum distance is ${MIN_DISTANCE_PERCENT}%`
        );
      }

      // Warn if stop loss is too far (>15% loss)
      if (distancePercent > 15) {
        warnings.push(
          `Stop loss is ${distancePercent.toFixed(1)}% below entry price. This represents a large potential loss.`
        );
      }
    }

    if (takeProfit !== undefined) {
      if (takeProfit <= entryPrice) {
        errors.push(
          `Take profit ${takeProfit} must be above entry price ${entryPrice} for long positions`
        );
      }

      // Check minimum distance (0.5%)
      const distancePercent = ((takeProfit - entryPrice) / entryPrice) * 100;
      if (distancePercent < MIN_DISTANCE_PERCENT) {
        errors.push(
          `Take profit too close to entry price (${distancePercent.toFixed(2)}%). Minimum distance is ${MIN_DISTANCE_PERCENT}%`
        );
      }
    }
  } else if (side === "short") {
    // For short positions:
    // Stop Loss must be ABOVE entry price
    // Take Profit must be BELOW entry price
    if (stopLoss !== undefined) {
      if (stopLoss <= entryPrice) {
        errors.push(
          `Stop loss ${stopLoss} must be above entry price ${entryPrice} for short positions`
        );
      }

      // Check minimum distance (0.5%)
      const distancePercent = ((stopLoss - entryPrice) / entryPrice) * 100;
      if (distancePercent < MIN_DISTANCE_PERCENT) {
        errors.push(
          `Stop loss too close to entry price (${distancePercent.toFixed(2)}%). Minimum distance is ${MIN_DISTANCE_PERCENT}%`
        );
      }

      // Warn if stop loss is too far (>15% loss)
      if (distancePercent > 15) {
        warnings.push(
          `Stop loss is ${distancePercent.toFixed(1)}% above entry price. This represents a large potential loss.`
        );
      }
    }

    if (takeProfit !== undefined) {
      if (takeProfit >= entryPrice) {
        errors.push(
          `Take profit ${takeProfit} must be below entry price ${entryPrice} for short positions`
        );
      }

      // Check minimum distance (0.5%)
      const distancePercent = ((entryPrice - takeProfit) / entryPrice) * 100;
      if (distancePercent < MIN_DISTANCE_PERCENT) {
        errors.push(
          `Take profit too close to entry price (${distancePercent.toFixed(2)}%). Minimum distance is ${MIN_DISTANCE_PERCENT}%`
        );
      }
    }
  }

  // Check risk/reward ratio if both are provided
  if (stopLoss !== undefined && takeProfit !== undefined) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = reward / risk;

    if (riskRewardRatio < 1) {
      warnings.push(
        `Risk/Reward ratio is ${riskRewardRatio.toFixed(2)}:1. Consider setting take profit further from entry for better risk/reward (recommended > 1.5:1)`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
