/**
 * Master Cron — Business Suite
 * Runs all scheduled jobs: reminders, agenda, task reminders, dashboard refresh
 */
const cron = require("node-cron");
const logger = require("../../../core/logger");
const { runTaskReminders } = require("../task/task.service");
const { runAgendaReminders } = require("../agenda/agenda.service");
const { refreshDashboardCache } = require("../dashboard/dashboard.service");
const prisma = require("../../../config/prisma");

function start() {
  // 9:00 AM — Debt & Receivable reminders via Prisma
  cron.schedule("0 9 * * *", async () => {
    logger.info("[CRON] 09:00 — Debt/Receivable reminders");
    try {
      const today = new Date();

      const dueDebts = await prisma.debtCard.findMany({
        where: {
          dueDate: { lte: today },
          status: { not: "PAID" },
        },
      });

      for (let i = 0; i < dueDebts.length; i += 1) {
        const debt = dueDebts[i];
        logger.info(`[CRON] Debt due reminder for Party ${debt.partyId} (ID: ${debt.id})`);
      }

      const dueReceivables = await prisma.receivableCard.findMany({
        where: {
          dueDate: { lte: today },
          status: { not: "PAID" },
        },
      });

      for (let i = 0; i < dueReceivables.length; i += 1) {
        const receivable = dueReceivables[i];
        logger.info(`[CRON] Receivable due reminder for Party ${receivable.partyId} (ID: ${receivable.id})`);
      }
    } catch (e) {
      logger.error("[CRON] Debt/Receivable reminders failed", e);
    }
  });

  // Every hour — Task reminders
  cron.schedule("0 * * * *", async () => {
    logger.info("[CRON] Hourly — Task reminders");
    try {
      await runTaskReminders();
    } catch (e) {
      logger.error("[CRON] Task reminders failed", e);
    }
  });

  // Every 15 minutes — Agenda reminders
  cron.schedule("*/15 * * * *", async () => {
    logger.info("[CRON] Every 15min — Agenda reminders");
    try {
      await runAgendaReminders();
    } catch (e) {
      logger.error("[CRON] Agenda reminders failed", e);
    }
  });

  // 2:00 AM — Refresh all dashboard caches
  cron.schedule("0 2 * * *", async () => {
    logger.info("[CRON] 02:00 — Refreshing all dashboard caches");
    try {
      const parties = await prisma.party.findMany({ select: { id: true } });
      for (let i = 0; i < parties.length; i += 1) {
        const item = parties[i];

        try {
          await refreshDashboardCache(item.id);
        } catch (e) {
          logger.error(`[CRON] Dashboard refresh failed for ${item.id}`, e);
        }
      }
    } catch (e) {
      logger.error("[CRON] Dashboard batch refresh failed", e);
    }
  });

  // 6:00 PM — Inventory low stock check via InventoryCard
  cron.schedule("0 18 * * *", async () => {
    logger.info("[CRON] 18:00 — Inventory low stock check");
    try {
      const lowStockCards = await prisma.inventoryCard.findMany({
        where: { currentStock: { lte: 5 } },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, sku: true } },
        },
      });

      for (let i = 0; i < lowStockCards.length; i += 1) {
        const card = lowStockCards[i];
        const productName = card.product?.name || "Unknown Product";
        logger.warn(
          `[CRON] Low stock alert: ${productName} (Party: ${card.partyId}, Current Stock: ${card.currentStock})`
        );
      }
    } catch (e) {
      logger.error("[CRON] Inventory check failed", e);
    }
  });

  logger.info("[CRON] All business suite crons scheduled");
}

module.exports = { start };