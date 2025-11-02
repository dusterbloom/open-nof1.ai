import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

console.log('\n' + '='.repeat(60))
console.log('TRADING TABLE DATABASE INVESTIGATION REPORT')
console.log('='.repeat(60))

console.log('\n1. TOTAL RECORDS COUNT')
console.log('-'.repeat(60))
const totalCount = await prisma.trading.count()
console.log('   Total Trading records: ' + totalCount)

console.log('\n2. BREAKDOWN BY OPERATION')
console.log('-'.repeat(60))
const opStats = await prisma.trading.groupBy({
  by: ['operation'],
  _count: true,
})
let totalOps = 0
opStats.forEach(o => {
  totalOps += o._count
  const percent = (o._count / totalCount * 100).toFixed(1)
  console.log('   ' + o.operation + ': ' + o._count + ' (' + percent + '%)')
})

console.log('\n3. BREAKDOWN BY SYMBOL')
console.log('-'.repeat(60))
const symStats = await prisma.trading.groupBy({
  by: ['symbol'],
  _count: true,
})
symStats.forEach(s => {
  const percent = (s._count / totalCount * 100).toFixed(1)
  console.log('   ' + s.symbol + ': ' + s._count + ' (' + percent + '%)')
})

console.log('\n4. SUCCESS/FAILURE STATUS')
console.log('-'.repeat(60))
const succStats = await prisma.trading.groupBy({
  by: ['success'],
  _count: true,
})
succStats.forEach(s => {
  const label = s.success ? 'Successful' : 'Failed'
  const percent = (s._count / totalCount * 100).toFixed(1)
  console.log('   ' + label + ': ' + s._count + ' (' + percent + '%)')
})

console.log('\n5. LAST 10 TRADES')
console.log('-'.repeat(60))
const last10 = await prisma.trading.findMany({
  take: 10,
  orderBy: { createdAt: 'desc' }
})
last10.forEach((trade, pos) => {
  const time = new Date(trade.createdAt).toLocaleString()
  const status = trade.success ? 'OK' : 'FAIL'
  const price = trade.pricing ? '$' + trade.pricing : 'N/A'
  console.log('   ' + (pos + 1) + '. [' + time + '] ' + status + ' | ' + trade.operation.padEnd(4) + ' ' + trade.symbol.padEnd(4) + ' @ ' + price)
})

console.log('\n6. ENTRY AND EXIT PRICES')
console.log('-'.repeat(60))
const buyTrades = await prisma.trading.findMany({
  where: { operation: 'Buy', success: true },
})
const sellTrades = await prisma.trading.findMany({
  where: { operation: 'Sell', success: true },
})

let pairedCount = 0
let totalPnL = 0
const exampleTrades = []

for (const buyTrade of buyTrades) {
  let sellTrade = null
  
  if (buyTrade.positionId) {
    sellTrade = await prisma.trading.findFirst({
      where: {
        operation: 'Sell',
        positionId: buyTrade.positionId,
        success: true,
      },
    })
  } else {
    sellTrade = await prisma.trading.findFirst({
      where: {
        operation: 'Sell',
        symbol: buyTrade.symbol,
        success: true,
        createdAt: { gt: buyTrade.createdAt },
      },
      orderBy: { createdAt: 'asc' },
    })
  }
  
  if (sellTrade) {
    pairedCount++
    const contracts = buyTrade.amount / buyTrade.pricing
    const pnl = (sellTrade.pricing - buyTrade.pricing) * contracts
    totalPnL += pnl
    if (exampleTrades.length < 3) {
      exampleTrades.push({ 
        symbol: buyTrade.symbol,
        entry: buyTrade.pricing, 
        exit: sellTrade.pricing,
        amount: buyTrade.amount,
        leverage: buyTrade.leverage,
        pnl: pnl
      })
    }
  }
}

console.log('   Total completed trades (Buy/Sell pairs): ' + pairedCount)
console.log('   Total PnL on closed positions: $' + totalPnL.toFixed(2))

if (exampleTrades.length > 0) {
  console.log('\n   Example completed trades:')
  exampleTrades.forEach((trade, pos) => {
    const pnlPercent = ((trade.exit - trade.entry) / trade.entry * 100).toFixed(2)
    console.log('   ' + (pos + 1) + '. ' + trade.symbol + ': Entry $' + trade.entry + ' -> Exit $' + trade.exit + ' | PnL: $' + trade.pnl.toFixed(2) + ' (' + pnlPercent + '%)')
  })
}

console.log('\n7. POSITION TRACKING')
console.log('-'.repeat(60))
const withPosId = await prisma.trading.count({
  where: { positionId: { not: null } }
})
const uniquePosIds = await prisma.trading.findMany({
  where: { positionId: { not: null } },
  select: { positionId: true },
  distinct: ['positionId']
})
console.log('   Trades with positionId: ' + withPosId)
console.log('   Unique positions tracked: ' + uniquePosIds.length)
console.log('   Open positions: ' + Math.max(0, buyTrades.length - pairedCount))

console.log('\n8. FAILED TRADES SUMMARY')
console.log('-'.repeat(60))
const failedCount = await prisma.trading.count({
  where: { success: false }
})
console.log('   Total failed trades: ' + failedCount)

const failedByOp = await prisma.trading.groupBy({
  by: ['operation'],
  where: { success: false },
  _count: true,
})
console.log('   Failed by operation:')
failedByOp.forEach(op => {
  console.log('     ' + op.operation + ': ' + op._count)
})

const sampleFailed = await prisma.trading.findMany({
  where: { success: false },
  orderBy: { createdAt: 'desc' },
  take: 3
})
console.log('   Sample failure reasons:')
sampleFailed.forEach((trade, pos) => {
  const symbol = trade.symbol
  const op = trade.operation
  const error = trade.errorMessage ? trade.errorMessage.substring(0, 50) : 'Unknown'
  console.log('     ' + (pos + 1) + '. ' + op + ' ' + symbol + ': ' + error + '...')
})

console.log('\n9. TIMESTAMPS')
console.log('-'.repeat(60))
const oldest = await prisma.trading.findFirst({
  orderBy: { createdAt: 'asc' }
})
const newest = await prisma.trading.findFirst({
  orderBy: { createdAt: 'desc' }
})
console.log('   First trade: ' + (oldest ? new Date(oldest.createdAt).toLocaleString() : 'N/A'))
console.log('   Last trade: ' + (newest ? new Date(newest.createdAt).toLocaleString() : 'N/A'))

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
const tradesLastHour = await prisma.trading.count({
  where: { createdAt: { gte: oneHourAgo } }
})
console.log('   Trades in last hour: ' + tradesLastHour)

console.log('\n' + '='.repeat(60))
console.log('\nKEY FINDINGS:')
console.log('  - ' + totalCount + ' total trading records')
console.log('  - ' + sellTrades.length + ' successful Buy trades, ' + sellTrades.length + ' Sell trades')
console.log('  - ' + pairedCount + ' completed round-trip trades')
console.log('  - ' + Math.max(0, buyTrades.length - pairedCount) + ' open positions')
console.log('  - ' + failedCount + ' failed trades (' + (failedCount / totalCount * 100).toFixed(1) + '%)')
console.log('  - BTC dominates with ' + symStats.find(s => s.symbol === 'BTC')?._count + ' trades (' + (symStats.find(s => s.symbol === 'BTC')?._count / totalCount * 100).toFixed(1) + '%)')
console.log('\n' + '='.repeat(60) + '\n')

await prisma.$disconnect()
