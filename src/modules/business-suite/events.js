/**
 * Business Suite Event Constants
 * For event-driven architecture / microservices prep
 */
module.exports = {
  CONTACT_CREATED: 'bs:contact:created',
  CONTACT_UPDATED: 'bs:contact:updated',
  CONTACT_DELETED: 'bs:contact:deleted',

  TASK_CREATED: 'bs:task:created',
  TASK_UPDATED: 'bs:task:updated',
  TASK_DELETED: 'bs:task:deleted',

  CASH_ENTRY_CREATED: 'bs:cash:entry:created',
  CASH_ENTRY_DELETED: 'bs:cash:entry:deleted',

  RECEIVABLE_ENTRY_CREATED: 'bs:receivable:entry:created',
  DEBT_ENTRY_CREATED: 'bs:debt:entry:created',

  INVENTORY_MOVEMENT: 'bs:inventory:movement',

  DASHBOARD_REFRESH_NEEDED: 'bs:dashboard:refresh:needed',
};
