/**
 * Master Cron — Business Suite
 * Runs all scheduled jobs: reminders, agenda, task reminders, dashboard refresh
 */
const cron = require('node-cron');
const logger = require('../../../core/logger');
const { runDailyReminders: runDebtReminders } = require('../../marketplace/reminder/reminder.service');
const { runTaskReminders } = require('../task/task.service');
const { runAgendaReminders } = require('../agenda/agenda.service');
const { refreshDashboardCache } = require('../dashboard/dashboard.service');
const prisma = require('../../../config/prisma');

function start() {
  // 9:00 AM — Debt & Receivable reminders
  cron.schedule('0 9 * * *', async () => {
    logger.info('[CRON] 09:00 — Debt/Receivable reminders');
    try { await runDebtReminders(); } catch (e) { logger.error('[CRON] Debt reminders failed', e); }
  });

  // Every hour — Task reminders
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Hourly — Task reminders');
    try { await runTaskReminders(); } catch (e) { logger.error('[CRON] Task reminders failed', e); }
  });

  // Every 15 minutes — Agenda reminders
  cron.schedule('*/15 * * * *', async () => {
    logger.info('[CRON] Every 15min — Agenda reminders');
    try { await runAgendaReminders(); } catch (e) { logger.error('[CRON] Agenda reminders failed', e); }
  });

  // 2:00 AM — Refresh all dashboard caches
  cron.schedule('0 2 * * *', async () => {
    logger.info('[CRON] 02:00 — Refreshing all dashboard caches');
    try {
      const parties = await prisma.party.findMany({ select: { id: true } });
      for (const party of parties) {
        try { await refreshDashboardCache(party.id); } catch (e) {
          logger.error(`[CRON] Dashboard refresh failed for ${party.id}`, e);
        }
      }
    } catch (e) { logger.error('[CRON] Dashboard batch refresh failed', e); }
  });

  // 6:00 PM — Inventory low stock check
  cron.schedule('0 18 * * *', async () => {
    logger.info('[CRON] 18:00 — Inventory low stock check');
    try {
      const { checkAndNotifyLowStock } = require('../../marketplace/inventory/inventory.service');
      const lowStockProducts = await prisma.product.findMany({
        where: { isActive: true, stock: { lte: 5 } },
      });
      for (const product of lowStockProducts) {
        await checkAndNotifyLowStock(product, null, product.stock, product.partyId);
      }
    } catch (e) { logger.error('[CRON] Inventory check failed', e); }
  });

  logger.info('[CRON] All business suite crons scheduled');
}

module.exports = { start };
