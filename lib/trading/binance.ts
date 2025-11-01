import ccxt from "ccxt";
import { isDryRunMode } from "./dry-run-wallet";

/**
 * Binance CCXT Exchange Instance
 *
 * In dry-run mode:
 * - API keys can be empty strings (public endpoints still work)
 * - Market data (prices, OHLCV) fetched normally via public API
 * - Orders are simulated, not sent to exchange
 *
 * In live mode:
 * - Requires valid API keys
 * - All operations interact with real exchange
 */
export const binance = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY || "",
  secret: process.env.BINANCE_API_SECRET || "",
  options: {
    defaultType: "swap", // Perpetual futures (fapi.binance.com), not delivery (dapi.binance.com)
  },
});

// Sandbox mode is deprecated for Binance futures
// Only set it if not in dry-run mode and explicitly enabled
if (!isDryRunMode() && process.env.BINANCE_USE_SANDBOX === "true") {
  try {
    binance.setSandboxMode(true);
    console.log("[BINANCE] Sandbox mode enabled (note: may not work for futures)");
  } catch (error) {
    console.warn("[BINANCE] Sandbox mode failed:", error);
  }
}

if (isDryRunMode()) {
  console.log("[BINANCE] Dry-run mode enabled - trades will be simulated");
}
