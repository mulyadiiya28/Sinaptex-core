const prisma = require('../../../config/prisma');
const cache = require('../../../core/cache');
const logger = require('../../../core/logger');
const config = require('../../../config/businessSuite.config');

async function getDashboard(partyId, { dateRange = '30d' } = {}) {
  if (!config.dashboard.enabled) {
    return getRealtimeDashboard(partyId, dateRange);
  }

  // Check cache
  const cacheKey = `dashboard:${partyId}:${dateRange}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const dashboard = await buildDashboard(partyId, dateRange);
  await cache.set(cacheKey, dashboard, config.dashboard.cacheTtlSeconds);
  return dashboard;
}

async function getRealtimeDashboard(partyId, dateRange) {
  return buildDashboard(partyId, dateRange);
}

async function buildDashboard(partyId, dateRange) {
  const { startDate, endDate } = parseDateRange(dateRange);

  const [
    financial,
    operational,
    contacts,
    tasks,
    inventory,
    recentActivity,
  ] = await Promise.all([
    getFinancialSummary(partyId, startDate, endDate),
    getOperationalSummary(partyId, startDate, endDate),
    getContactsSummary(partyId),
    getTasksSummary(partyId),
    getInventorySummary(partyId),
    getRecentActivity(partyId),
  ]);

  return {
    partyId,
    dateRange,
    generatedAt: new Date(),
    financial,
    operational,
    contacts,
    tasks,
    inventory,
    recentActivity,
  };
}

function parseDateRange(range) {
  const end = new Date();
  const start = new Date();
  const days = parseInt(range) || 30;
  start.setDate(start.getDate() - days);
  return { startDate: start, endDate: end };
}

async function getFinancialSummary(partyId, startDate, endDate) {
  const cashBook = await prisma.cashBook.findUnique({ where: { partyId } });
  const cashEntries = await prisma.cashEntry.findMany({
    where: {
      partyId,
      createdAt: { gte: startDate, lte: endDate },
      status: 'CONFIRMED',
    },
  });

  const income = cashEntries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const expense = cashEntries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);

  const receivableCards = await prisma.receivableCard.findMany({ where: { partyId } });
  const totalReceivable = receivableCards.reduce((s, c) => s + c.currentBalance, 0);

  const debtCards = await prisma.debtCard.findMany({ where: { partyId } });
  const totalDebt = debtCards.reduce((s, c) => s + c.currentBalance, 0);

  const inventoryCards = await prisma.inventoryCard.findMany({ where: { partyId } });
  const totalInventoryValue = inventoryCards.reduce((s, c) => {
    return s + (c.currentStock * (c.avgUnitCost || 0));
  }, 0);

  return {
    balance: cashBook?.balance || 0,
    income,
    expense,
    netCashFlow: income - expense,
    totalReceivable,
    totalDebt,
    totalInventoryValue,
    equity: (cashBook?.balance || 0) + totalReceivable - totalDebt + totalInventoryValue,
  };
}

async function getOperationalSummary(partyId, startDate, endDate) {
  const [totalProducts, lowStockProducts, totalOrders, orderStats] = await Promise.all([
    prisma.product.count({ where: { partyId, isActive: true } }),
    prisma.product.count({
      where: { partyId, isActive: true, stock: { lte: config.inventory.lowStockThreshold } },
    }),
    prisma.order.count({ where: { subOrders: { some: { sellerPartyId: partyId } } } }),
    prisma.orderSub.groupBy({
      by: ['status'],
      where: { sellerPartyId: partyId, createdAt: { gte: startDate, lte: endDate } },
      _count: { status: true },
    }),
  ]);

  const orderMap = {};
  for (const s of orderStats) orderMap[s.status] = s._count.status;

  return {
    totalProducts,
    lowStockProducts,
    totalOrders,
    pendingOrders: orderMap['PENDING_PAYMENT'] || 0,
    processingOrders: orderMap['PROCESSING'] || 0,
    shippedOrders: orderMap['SHIPPED'] || 0,
    completedOrders: orderMap['COMPLETED'] || 0,
    cancelledOrders: orderMap['CANCELLED'] || 0,
  };
}

async function getContactsSummary(partyId) {
  const [customers, suppliers, debtors, creditors] = await Promise.all([
    prisma.contact.count({ where: { partyId, type: 'CUSTOMER' } }),
    prisma.contact.count({ where: { partyId, type: 'SUPPLIER' } }),
    prisma.contact.count({ where: { partyId, type: 'DEBTOR' } }),
    prisma.contact.count({ where: { partyId, type: 'CREDITOR' } }),
  ]);

  return { customers, suppliers, debtors, creditors };
}

async function getTasksSummary(partyId) {
  const [total, overdue, completed, byPriority] = await Promise.all([
    prisma.task.count({ where: { partyId } }),
    prisma.task.count({ where: { partyId, targetDate: { lt: new Date() }, status: { not: 'DONE' } } }),
    prisma.task.count({ where: { partyId, status: 'DONE' } }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { partyId, status: { not: 'DONE' } },
      _count: { priority: true },
    }),
  ]);

  const priorityMap = {};
  for (const p of byPriority) priorityMap[p.priority] = p._count.priority;

  return { total, overdue, completed, byPriority: priorityMap };
}

async function getInventorySummary(partyId) {
  const cards = await prisma.inventoryCard.findMany({
    where: { partyId },
    include: { product: { select: { name: true } } },
    orderBy: { currentStock: 'asc' },
    take: 10,
  });

  return {
    lowStockItems: cards.filter((c) => c.currentStock <= config.inventory.lowStockThreshold),
    criticalStockItems: cards.filter((c) => c.currentStock <= config.inventory.criticalStockThreshold),
    topMovingItems: cards.slice(0, 5),
  };
}

async function getRecentActivity(partyId) {
  const [recentOrders, recentCash, recentTasks] = await Promise.all([
    prisma.orderSub.findMany({
      where: { sellerPartyId: partyId },
      include: { order: { select: { invoiceNumber: true, buyerId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.cashEntry.findMany({
      where: { partyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.task.findMany({
      where: { partyId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  return { recentOrders, recentCash, recentTasks };
}

async function refreshDashboardCache(partyId) {
  const ranges = ['7d', '30d', '90d', '1y'];
  for (const range of ranges) {
    const dashboard = await buildDashboard(partyId, range);
    const cacheKey = `dashboard:${partyId}:${range}`;
    await cache.set(cacheKey, dashboard, config.dashboard.cacheTtlSeconds);
  }
  logger.info('Dashboard cache refreshed', { partyId });
}

module.exports = {
  getDashboard,
  getRealtimeDashboard,
  refreshDashboardCache,
};
