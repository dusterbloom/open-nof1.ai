#!/usr/bin/env node

/**
 * Cron Daemon - Automatically triggers trading and metrics collection
 *
 * This script runs continuously and triggers the cron endpoints at their
 * designated intervals:
 * - Metrics: Every 20 seconds
 * - Trading: Every 3 minutes
 */

const jwt = require('jsonwebtoken');

const CRON_SECRET = process.env.CRON_SECRET_KEY || '1234';
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3001';

const METRICS_INTERVAL = 20 * 1000; // 20 seconds
const TRADING_INTERVAL = 3 * 60 * 1000; // 3 minutes

let metricsCount = 0;
let tradingCount = 0;

async function triggerMetricsCron() {
  try {
    const token = jwt.sign({}, CRON_SECRET);
    const response = await fetch(
      `${BASE_URL}/api/cron/20-seconds-metrics-interval?token=${token}`
    );
    const text = await response.text();
    metricsCount++;
    console.log(`[${new Date().toISOString()}] 📊 Metrics #${metricsCount}: ${text}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Metrics cron failed:`, error.message);
  }
}

async function triggerTradingCron() {
  try {
    const token = jwt.sign({}, CRON_SECRET);
    const response = await fetch(
      `${BASE_URL}/api/cron/3-minutes-run-interval?token=${token}`
    );
    const text = await response.text();
    tradingCount++;
    console.log(`[${new Date().toISOString()}] 🤖 Trading #${tradingCount}: ${text}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Trading cron failed:`, error.message);
  }
}

console.log('🚀 Starting Cron Daemon...');
console.log(`   BASE_URL: ${BASE_URL}`);
console.log(`   Metrics interval: ${METRICS_INTERVAL / 1000}s`);
console.log(`   Trading interval: ${TRADING_INTERVAL / 1000}s\n`);

// Start both intervals
setInterval(triggerMetricsCron, METRICS_INTERVAL);
setInterval(triggerTradingCron, TRADING_INTERVAL);

// Trigger immediately on start
triggerMetricsCron();
triggerTradingCron();

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\n👋 Cron Daemon stopped');
  console.log(`   Total metrics collected: ${metricsCount}`);
  console.log(`   Total trading decisions: ${tradingCount}`);
  process.exit(0);
});

console.log('✅ Cron Daemon running. Press Ctrl+C to stop.\n');
