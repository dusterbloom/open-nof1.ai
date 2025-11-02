import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

console.log('')
console.log('=== BUY/SELL PAIRS ANALYSIS ===')

const buyTrades = await prisma.trading.findMany({
  where: { operation: 'Buy', success: true },
  orderBy: { createdAt: 'desc' }
})

console.log('Total successful Buy trades: ' + buyTrades.length)

let pairedCount = 0
let pairedExamples = []

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
    if (pairedExamples.length < 5) {
      pairedExamples.push({ buyTrade, sellTrade })
    }
  }
}

console.log('Paired buy/sell trades: ' + pairedCount)
console.log('Open positions: ' + (buyTrades.length - pairedCount))

console.log('')
console.log('=== EXAMPLE COMPLETED TRADES ===')
pairedExamples.forEach((pair, pos) => {
  const buyTime = new Date(pair.buyTrade.createdAt).toLocaleString()
  const sellTime = new Date(pair.sellTrade.createdAt).toLocaleString()
  const pnl = (pair.sellTrade.pricing - pair.buyTrade.pricing) * (pair.buyTrade.amount / pair.buyTrade.pricing)
  const pnlPercent = ((pair.sellTrade.pricing - pair.buyTrade.pricing) / pair.buyTrade.pricing * 100).toFixed(2)
  
  console.log('')
  console.log((pos + 1) + '. ' + pair.buyTrade.symbol + ' - Position ID: ' + (pair.buyTrade.positionId || 'legacy'))
  console.log('   Entry [' + buyTime + ']:')
  console.log('     Price: $' + pair.buyTrade.pricing)
  console.log('     Amount: ' + pair.buyTrade.amount + ' USDT')
  console.log('     Leverage: ' + pair.buyTrade.leverage + 'x')
  console.log('   Exit [' + sellTime + ']:')
  console.log('     Price: $' + pair.sellTrade.pricing)
  console.log('   PnL: $' + pnl.toFixed(2) + ' (' + pnlPercent + '%)')
})

console.log('')
console.log('=== OPEN POSITIONS ===')
const openPositions = buyTrades.slice(0, 5).filter(buy => {
  return !pairedExamples.some(pair => pair.buyTrade.id === buy.id)
})

if (openPositions.length === 0) {
  const allBuys = await prisma.trading.findMany({
    where: { operation: 'Buy', success: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  
  for (const buy of allBuys) {
    let hasSell = false
    if (buy.positionId) {
      const sell = await prisma.trading.findFirst({
        where: { operation: 'Sell', positionId: buy.positionId, success: true }
      })
      hasSell = sell !== null
    }
    if (!hasSell) {
      const time = new Date(buy.createdAt).toLocaleString()
      console.log('  ' + buy.symbol + ' - Entry at $' + buy.pricing + ' [' + time + ']')
      if (buy.stopLoss) console.log('    Stop Loss: $' + buy.stopLoss)
      if (buy.takeProfit) console.log('    Take Profit: $' + buy.takeProfit)
    }
  }
}

await prisma.$disconnect()
