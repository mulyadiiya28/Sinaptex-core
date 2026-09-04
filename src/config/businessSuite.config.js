/**
 * Business Suite configuration (MVP)
 * Party-scoped: contacts, cash, debt/receivable cards, inventory card,
 * tasks, agenda, dashboard.
 *
 * Marketplace catalog/cart/order lives in marketplace.config.js — not here.
 */
module.exports = {
  masterData: {
    maxCustomersPerParty: Number(process.env.BS_MAX_CUSTOMERS || 1000),
    maxSuppliersPerParty: Number(process.env.BS_MAX_SUPPLIERS || 500),
    maxDebtorsPerParty: Number(process.env.BS_MAX_DEBTORS || 500),
    maxCreditorsPerParty: Number(process.env.BS_MAX_CREDITORS || 500),
  },

  cashBook: {
    enabled: process.env.BS_CASHBOOK_ENABLED !== 'false',
    defaultCurrency: process.env.BS_CASHBOOK_CURRENCY || 'IDR',
    categories: (
      process.env.BS_CASHBOOK_CATEGORIES ||
      'PENJUALAN,PEMBELIAN,OPERASIONAL,Gaji,Transport,Utilitas,Marketing,Lainnya'
    ).split(','),
  },

  debtBook: {
    enabled: process.env.BS_DEBTBOOK_ENABLED !== 'false',
    defaultCurrency: process.env.BS_DEBTBOOK_CURRENCY || 'IDR',
    reminderDaysBefore: Number(process.env.BS_DEBT_REMINDER_DAYS_BEFORE || 3),
    reminderDaysAfter: Number(process.env.BS_DEBT_REMINDER_DAYS_AFTER || 1),
    maxReminders: Number(process.env.BS_DEBT_MAX_REMINDERS || 3),
  },

  receivableBook: {
    enabled: process.env.BS_RECEIVABLE_ENABLED !== 'false',
    defaultCurrency: process.env.BS_RECEIVABLE_CURRENCY || 'IDR',
    reminderDaysBefore: Number(process.env.BS_RECEIVABLE_REMINDER_DAYS_BEFORE || 3),
    reminderDaysAfter: Number(process.env.BS_RECEIVABLE_REMINDER_DAYS_AFTER || 1),
    maxReminders: Number(process.env.BS_RECEIVABLE_MAX_REMINDERS || 3),
  },

  inventory: {
    enabled: process.env.BS_INVENTORY_ENABLED !== 'false',
    lowStockThreshold: Number(process.env.BS_INVENTORY_LOW_STOCK || 5),
    criticalStockThreshold: Number(process.env.BS_INVENTORY_CRITICAL_STOCK || 2),
    autoNotifyLowStock: process.env.BS_INVENTORY_AUTO_NOTIFY !== 'false',
  },

  task: {
    enabled: process.env.BS_TASK_ENABLED !== 'false',
    maxTasksPerParty: Number(process.env.BS_MAX_TASKS || 1000),
    defaultReminderDays: Number(process.env.BS_TASK_REMINDER_DAYS || 1),
  },

  agenda: {
    enabled: process.env.BS_AGENDA_ENABLED !== 'false',
    maxItemsPerParty: Number(process.env.BS_MAX_AGENDA || 500),
    defaultReminderMinutes: Number(process.env.BS_AGENDA_REMINDER_MIN || 15),
  },

  dashboard: {
    enabled: process.env.BS_DASHBOARD_ENABLED !== 'false',
    cacheTtlSeconds: Number(process.env.BS_DASHBOARD_CACHE_TTL || 300),
    defaultRangeDays: Number(process.env.BS_DASHBOARD_RANGE_DAYS || 30),
  },
};
