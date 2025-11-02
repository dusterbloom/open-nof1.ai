import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const totalCount = await prisma.trading.count()
console.log('')
console.log('=== TRADING TABLE SUMMARY ===')
console.log('Total Trading records: ' + totalCount)

const opStats = await prisma.trading.groupBy({
  by: ['operation'],
  _count: true,
})
console.log('')
console.log('=== BY OPERATION ===')
opStats.forEach(o => {
  console.log('  ' + o.operation + ': ' + o._count)
})

const symStats = await prisma.trading.groupBy({
  by: ['symbol'],
  _count: true,
})
console.log('')
console.log('=== BY SYMBOL ===')
symStats.forEach(s => {
  console.log('  ' + s.symbol + ': ' + s._count)
})

const succStats = await prisma.trading.groupBy({
  by: ['success'],
  _count: true,
})
console.log('')
console.log('=== BY SUCCESS STATUS ===')
succStats.forEach(s => {
  const label = s.success ? 'Successful' : 'Failed'
  console.log('  ' + label + ': ' + s._count)
})

const buyCount = await prisma.trading.count({
  where: { operation: 'Buy', success: true }
})
const sellCount = await prisma.trading.count({
  where: { operation: 'Sell', success: true }
})
const holdCount = await prisma.trading.count({
  where: { operation: 'Hold', success: true }
})

console.log('')
console.log('=== POSITION STATUS ===')
console.log('Successful Buy trades: ' + buyCount)
console.log('Successful Sell trades: ' + sellCount)
console.log('Successful Hold trades: ' + holdCount)
console.log('Open positions estimate: ' + Math.max(0, buyCount - sellCount))

const withPosId = await prisma.trading.count({
  where: { positionId: { not: null } }
})
console.log('')
console.log('=== POSITION TRACKING ===')
console.log('Trades with positionId: ' + withPosId)

const failedTrades = await prisma.trading.findMany({
  where: { success: false },
  orderBy: { createdAt: 'desc' },
  take: 3
})
console.log('')
console.log('=== SAMPLE FAILED TRADES ===')
failedTrades.forEach((trade, pos) => {
  const time = new Date(trade.createdAt).toLocaleString()
  console.log((pos + 1) + '. [' + time + '] ' + trade.operation + ' ' + trade.symbol)
  console.log('   Error: ' + trade.errorMessage)
})

console.log('')
console.log('=== PRICE RANGES ===')
const allWithPrices = await prisma.trading.findMany({
  where: { pricing: { not: null } },
  select: { pricing: true },
  orderBy: { pricing: 'asc' }
})
if (allWithPrices.length > 0) {
  const prices = allWithPrices.map(t => t.pricing)
  console.log('Lowest price: $' + Math.min(...prices))
  console.log('Highest price: $' + Math.max(...prices))
  console.log('Avg price: $' + (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2))
}

await prisma.$disconnect()
